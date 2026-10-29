import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

// ==========================================
// 1. KONFIGURASI AUTENTIKASI
// ==========================================
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@bengkelmvp.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin Raka';
const JWT_SECRET = process.env.JWT_SECRET || 'bengkel-mvp-secret-change-me';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 jam

function signToken(payload: { email: string; name: string; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string | undefined) {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// MIDDLEWARE: Penjaga pintu untuk endpoint Admin
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : header;
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Akses ditolak. Silakan login.' });
  }
  next(); // Lanjutkan ke endpoint jika token valid
};

app.use(cors());
app.use(express.json());

// ==========================================
// 2. STATE MACHINE & HELPER KOMISI
// ==========================================
// Aturan perpindahan status yang SAH
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  QUEUE: ['WORKING'],
  WORKING: ['APPROVAL', 'READY'],
  APPROVAL: ['READY', 'WORKING'], // Bisa kembali ke WORKING jika pelanggan menolak
  READY: [] 
};

async function calculateCommission(mechanicId: string | undefined, serviceAmount: number, partsAmount: number): Promise<number> {
  let svcPct = 10;
  let ptsPct = 0;

  const setting = await prisma.commissionSetting.findUnique({ where: { id: 'global' } });
  if (setting) {
    svcPct = setting.servicePercent;
    ptsPct = setting.partsPercent;
  }

  if (mechanicId) {
    const override = await prisma.commissionOverride.findUnique({ where: { mechanicId } });
    if (override) {
      if (override.servicePercent !== null) svcPct = override.servicePercent;
      if (override.partsPercent !== null) ptsPct = override.partsPercent;
    }
  }

  return Math.round((serviceAmount * svcPct) / 100) + Math.round((partsAmount * ptsPct) / 100);
}

// ==========================================
// 3. ENDPOINT AUTENTIKASI
// ==========================================
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email?.toLowerCase() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Email atau kata sandi salah.' });
  }
  const token = signToken({ email: ADMIN_EMAIL, name: ADMIN_NAME, exp: Date.now() + TOKEN_TTL_MS });
  res.json({ success: true, token, user: { email: ADMIN_EMAIL, name: ADMIN_NAME } });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: { email: ADMIN_EMAIL, name: ADMIN_NAME } });
});

// ==========================================
// 4. ENDPOINT MEKANIK
// ==========================================
app.get('/api/mechanics', requireAuth, async (req, res) => {
  const mechanics = await prisma.mechanic.findMany({ orderBy: { code: 'asc' } });
  res.json(mechanics);
});

app.post('/api/mechanics', requireAuth, async (req, res) => {
  try {
    const { code, name, initials, color } = req.body;
    const mechanic = await prisma.mechanic.create({ data: { code, name, initials, color } });
    res.json(mechanic);
  } catch (error) {
    res.status(400).json({ error: 'Kode mekanik mungkin sudah dipakai.' });
  }
});

app.put('/api/mechanics/:id', requireAuth, async (req, res) => {
  try {
    // FIX TYPESCRIPT: Tambahkan 'as string'
    const id = req.params.id as string;
    const { name, isActive } = req.body;
    const mechanic = await prisma.mechanic.update({
      where: { id },
      data: { name, isActive }
    });
    res.json(mechanic);
  } catch (error) {
    res.status(500).json({ error: 'Gagal update mekanik.' });
  }
});

// ==========================================
// 5. ENDPOINT SPAREPART
// ==========================================
app.get('/api/spareparts', requireAuth, async (req, res) => {
  const parts = await prisma.sparepart.findMany({ orderBy: { code: 'asc' } });
  res.json(parts);
});

app.post('/api/spareparts', requireAuth, async (req, res) => {
  try {
    const { code, name, category, price, stock, minStock } = req.body;
    const part = await prisma.sparepart.create({ data: { code, name, category, price, stock, minStock } });
    res.status(201).json(part);
  } catch (error) {
    res.status(400).json({ error: 'Kode sparepart sudah dipakai.' });
  }
});

app.put('/api/spareparts/:id', requireAuth, async (req, res) => {
  try {
    // FIX TYPESCRIPT: Tambahkan 'as string'
    const id = req.params.id as string;
    const { code, name, category, price, stock, minStock } = req.body;
    const part = await prisma.sparepart.update({
      where: { id }, data: { code, name, category, price, stock, minStock }
    });
    res.json(part);
  } catch (error) {
    res.status(500).json({ error: 'Gagal update sparepart.' });
  }
});

app.post('/api/spareparts/:id/restock', requireAuth, async (req, res) => {
  try {
    // FIX TYPESCRIPT: Tambahkan 'as string'
    const id = req.params.id as string;
    const { qty } = req.body;
    const part = await prisma.sparepart.update({
      where: { id }, data: { stock: { increment: qty } }
    });
    res.json(part);
  } catch (error) {
    res.status(500).json({ error: 'Gagal restock.' });
  }
});

// ==========================================
// 6. ENDPOINT ORDER (KANBAN & STATE MACHINE)
// ==========================================
app.get('/api/orders', requireAuth, async (req, res) => {
  // Ambil pesanan beserta item dan mekaniknya
  const orders = await prisma.order.findMany({
    include: {
      items: { include: { sparepart: true } },
      mechanic: true
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(orders);
});

app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const { vehicle, plate, issue, color, mechanicId, items } = req.body;
    
    // Generate Token Rahasia untuk Pelanggan
    const trackingToken = crypto.randomUUID();

    const newOrder = await prisma.order.create({
      data: {
        trackingToken,
        vehicle,
        plate,
        issue,
        color,
        status: 'QUEUE', // Selalu mulai dari QUEUE
        mechanicId,
        items: {
          // Nested write: Prisma otomatis membuat OrderItem
          create: items.map((item: any) => ({
            type: item.type, // 'JASA' atau 'SPAREPART'
            name: item.name,
            price: item.price,
            qty: item.qty,
            sparepartId: item.sparepartId || null,
            isAdditional: false
          }))
        }
      },
      include: { items: true }
    });
    res.json(newOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuat pesanan.' });
  }
});

// ENDPOINT UPDATE STATUS (Menerapkan State Machine)
app.put('/api/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { status: newStatus, additionalItems } = req.body;

    const currentOrder = await prisma.order.findUnique({ where: { id } });
    if (!currentOrder) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });

    // 1. VALIDASI STATE MACHINE
    if (!ALLOWED_TRANSITIONS[currentOrder.status]?.includes(newStatus)) {
      return res.status(400).json({ 
        error: `Transisi ilegal: Tidak bisa pindah dari ${currentOrder.status} ke ${newStatus}` 
      });
    }

    // 2. SIMPAN ITEM TAMBAHAN (Jika ada dan transisi dari WORKING)
    // Kita simpan baik mau ke APPROVAL (remote) maupun langsung ke READY (di tempat)
    if (currentOrder.status === 'WORKING' && additionalItems?.length > 0) {
      // Hapus dulu item tambahan lama (jika admin sempat mengedit) agar tidak duplikat
      await prisma.orderItem.deleteMany({
        where: { orderId: id, isAdditional: true }
      });
      
      // Buat item tambahan yang baru
      await prisma.orderItem.createMany({
        data: additionalItems.map((item: any) => ({
          orderId: id,
          type: item.type,
          name: item.name,
          price: item.price,
          qty: item.qty,
          sparepartId: item.sparepartId || null,
          isAdditional: true
        }))
      });
    }

    // 3. UPDATE STATUS
    const updatedOrder = await prisma.order.update({ 
      where: { id }, 
      data: { status: newStatus },
      include: { items: true }
    });
    
    res.json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal update status pesanan.' });
  }
});

// ==========================================
// 7. ENDPOINT TRACKING (PUBLIK - BERDASARKAN TOKEN)
// ==========================================
app.get('/api/tracking/:token', async (req, res) => {
  // FIX TYPESCRIPT: Tambahkan 'as string'
  const token = req.params.token as string;
  
  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    include: { items: true, mechanic: true }
  });
  
  if (!order) return res.status(404).json({ error: 'Tiket tidak valid' });
  res.json(order);
});

app.put('/api/tracking/:token/approve', async (req, res) => {
  try {
    // FIX TYPESCRIPT: Tambahkan 'as string'
    const token = req.params.token as string;
    const { accepted } = req.body; // boolean

    const order = await prisma.order.findUnique({ where: { trackingToken: token } });
    if (!order || order.status !== 'APPROVAL') {
      return res.status(400).json({ error: 'Pesanan tidak dalam status menunggu konfirmasi.' });
    }

    // Jika pelanggan menolak, hapus semua item tambahan
    if (!accepted) {
      await prisma.orderItem.deleteMany({
        where: { orderId: order.id, isAdditional: true }
      });
    }

    // Kembalikan ke WORKING (lanjut servis dengan/tanpa tambahan)
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'WORKING' }
    });

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: 'Gagal memproses persetujuan.' });
  }
});

// ==========================================
// 8. ENDPOINT CHECKOUT (TRANSAKSI ACID)
// ==========================================
app.post('/api/checkout', requireAuth, async (req, res) => {
  try {
    const { orderId, mode, lines } = req.body; 
    // mode: 'service' atau 'parts'
    // lines: array berisi { id, type, qty, price } dari frontend

    // 1. Hitung nominal
    const serviceAmount = lines.filter((l: any) => l.type === 'JASA').reduce((sum: number, l: any) => sum + (l.price * l.qty), 0);
    const partsAmount = lines.filter((l: any) => l.type === 'SPAREPART').reduce((sum: number, l: any) => sum + (l.price * l.qty), 0);
    const total = serviceAmount + partsAmount;

    // 2. Dapatkan data order (untuk mekanik)
    const order = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
    const mechanicId = order?.mechanicId || undefined;

    // 3. Hitung komisi sesuai database
    const commission = await calculateCommission(mechanicId, serviceAmount, partsAmount);

    // 4. JALANKAN TRANSAKSI ACID (Semua sukses, atau semua batal)
    const result = await prisma.$transaction(async (tx) => {
      
      // 4a. Validasi & Potong Stok
      for (const line of lines) {
        if (line.type === 'SPAREPART' && line.id) {
          const part = await tx.sparepart.findUnique({ where: { id: line.id } });
          if (!part || part.stock < line.qty) {
            throw new Error(`Stok ${line.name} tidak cukup!`);
          }
          await tx.sparepart.update({
            where: { id: line.id },
            data: { stock: { decrement: line.qty } }
          });
        }
      }

      // 4b. Simpan Transaksi
      const newTx = await tx.transaction.create({
        data: {
          orderId: order?.id,
          type: mode === 'service' ? 'Servis' : 'Sparepart',
          method: 'TUNAI',
          total,
          serviceAmount,
          partsAmount,
          commission,
          mechanicId
        }
      });

      // 4c. Hapus Order dari Kanban (jika ini pesanan servis)
      if (mode === 'service' && orderId) {
        await tx.order.delete({ where: { id: orderId } });
      }

      return newTx;
    });

    res.json({ success: true, transaction: result });
  } catch (error: any) {
    console.error('Checkout Error:', error);
    // Jika error dilempar dari dalam transaksi (misal stok kurang)
    res.status(400).json({ error: error.message || 'Gagal memproses pembayaran' });
  }
});

// ==========================================
// 9. ENDPOINT LAPORAN & KOMISI
// ==========================================
app.get('/api/transactions', requireAuth, async (req, res) => {
  const txs = await prisma.transaction.findMany({
    include: { mechanic: true },
    orderBy: { date: 'desc' }
  });
  res.json(txs);
});

app.get('/api/commission', requireAuth, async (req, res) => {
  let setting = await prisma.commissionSetting.findUnique({ where: { id: 'global' } });
  if (!setting) {
    setting = await prisma.commissionSetting.create({ data: { id: 'global', servicePercent: 10, partsPercent: 0 } });
  }
  const overrideRows = await prisma.commissionOverride.findMany();
  const overrides: Record<string, any> = {};
  for (const row of overrideRows) {
    overrides[row.mechanicId] = { service: row.servicePercent, parts: row.partsPercent };
  }
  res.json({ servicePercent: setting.servicePercent, partsPercent: setting.partsPercent, overrides });
});

app.put('/api/commission', requireAuth, async (req, res) => {
  const { servicePercent, partsPercent, overrides } = req.body;
  
  await prisma.$transaction(async (tx) => {
    await tx.commissionSetting.upsert({
      where: { id: 'global' },
      update: { servicePercent, partsPercent },
      create: { id: 'global', servicePercent, partsPercent }
    });
    
    await tx.commissionOverride.deleteMany({});
    
    if (overrides) {
      for (const [mechanicId, raw] of Object.entries(overrides)) {
        const v = raw as any;
        if (v.service === undefined && v.parts === undefined) continue;
        await tx.commissionOverride.create({
          data: { mechanicId, servicePercent: v.service ?? null, partsPercent: v.parts ?? null }
        });
      }
    }
  });

  res.json({ success: true });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
});

// ==========================================
// JALANKAN SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Server backend berjalan di http://localhost:${PORT}`);
});