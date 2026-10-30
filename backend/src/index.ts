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
  next();
};

app.use(cors());
app.use(express.json());

// ==========================================
// 2. STATE MACHINE & HELPER KOMISI
// ==========================================
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  QUEUE: ['WORKING'],
  WORKING: ['APPROVAL', 'READY'],
  APPROVAL: ['READY', 'WORKING'],
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
    
    // VALIDASI INPUT
    if (!code?.trim() || !name?.trim() || !initials?.trim()) {
      return res.status(400).json({ error: 'Kode, Nama, dan Inisial wajib diisi.' });
    }

    const mechanic = await prisma.mechanic.create({ data: { code: code.trim(), name: name.trim(), initials: initials.trim(), color } });
    res.json(mechanic);
  } catch (error) {
    res.status(400).json({ error: 'Kode mekanik mungkin sudah dipakai.' });
  }
});

app.put('/api/mechanics/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, isActive } = req.body;
    
    // VALIDASI INPUT
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Nama mekanik tidak boleh kosong.' });
    }

    const mechanic = await prisma.mechanic.update({
      where: { id },
      data: { name: name.trim(), isActive }
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
    
    // VALIDASI INPUT
    if (!code?.trim() || !name?.trim() || !category?.trim()) {
      return res.status(400).json({ error: 'Kode, Nama, dan Kategori wajib diisi.' });
    }
    if (Number(price) < 0 || Number(stock) < 0 || Number(minStock) < 0) {
      return res.status(400).json({ error: 'Harga dan stok tidak boleh negatif.' });
    }

    const part = await prisma.sparepart.create({ 
      data: { 
        code: code.trim(), 
        name: name.trim(), 
        category: category.trim(), 
        price: Number(price) || 0, 
        stock: Number(stock) || 0, 
        minStock: Number(minStock) || 0 
      } 
    });
    res.status(201).json(part);
  } catch (error) {
    res.status(400).json({ error: 'Kode sparepart sudah dipakai.' });
  }
});

app.put('/api/spareparts/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { code, name, category, price, stock, minStock } = req.body;
    
    // VALIDASI INPUT
    if (!code?.trim() || !name?.trim() || !category?.trim()) {
      return res.status(400).json({ error: 'Kode, Nama, dan Kategori wajib diisi.' });
    }
    if (Number(price) < 0 || Number(stock) < 0 || Number(minStock) < 0) {
      return res.status(400).json({ error: 'Harga dan stok tidak boleh negatif.' });
    }

    const part = await prisma.sparepart.update({
      where: { id }, 
      data: { 
        code: code.trim(), 
        name: name.trim(), 
        category: category.trim(), 
        price: Number(price) || 0, 
        stock: Number(stock) || 0, 
        minStock: Number(minStock) || 0 
      }
    });
    res.json(part);
  } catch (error) {
    res.status(500).json({ error: 'Gagal update sparepart.' });
  }
});

app.post('/api/spareparts/:id/restock', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { qty } = req.body;
    
    // VALIDASI INPUT
    if (Number(qty) <= 0) {
      return res.status(400).json({ error: 'Jumlah restock harus lebih dari 0.' });
    }

    const part = await prisma.sparepart.update({
      where: { id }, data: { stock: { increment: Number(qty) } }
    });
    res.json(part);
  } catch (error) {
    res.status(500).json({ error: 'Gagal restock.' });
  }
});

// ==========================================
// 5.1 ENDPOINT SERVICE (KATALOG JASA) - BARU
// ==========================================
app.get('/api/services', requireAuth, async (req, res) => {
  try {
    const services = await prisma.service.findMany({ orderBy: { name: 'asc' } });
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data katalog servis.' });
  }
});

app.post('/api/services', requireAuth, async (req, res) => {
  try {
    const { name, price } = req.body;
    
    // VALIDASI INPUT
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Nama servis wajib diisi.' });
    }
    if (Number(price) < 0) {
      return res.status(400).json({ error: 'Harga servis tidak boleh negatif.' });
    }

    const service = await prisma.service.create({ 
      data: { name: name.trim(), price: Number(price) || 0 } 
    });
    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ error: 'Gagal menambah katalog servis.' });
  }
});

app.put('/api/services/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, price } = req.body;
    
    // VALIDASI INPUT
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Nama servis wajib diisi.' });
    }
    if (Number(price) < 0) {
      return res.status(400).json({ error: 'Harga servis tidak boleh negatif.' });
    }

    const service = await prisma.service.update({
      where: { id }, 
      data: { name: name.trim(), price: Number(price) || 0 }
    });
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: 'Gagal update katalog servis.' });
  }
});

app.delete('/api/services/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    await prisma.service.delete({ where: { id } });
    res.json({ success: true, message: 'Servis berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus katalog servis.' });
  }
});

// ==========================================
// 6. ENDPOINT ORDER (KANBAN & STATE MACHINE)
// ==========================================
app.get('/api/orders', requireAuth, async (req, res) => {
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
    
    // VALIDASI INPUT
    if (!vehicle?.trim()) {
      return res.status(400).json({ error: 'Model kendaraan wajib diisi.' });
    }
    if (!mechanicId) {
      return res.status(400).json({ error: 'Mekanik wajib dipilih.' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Pesanan minimal harus memiliki 1 item.' });
    }
    
    // Validasi setiap item
    for (const item of items) {
      if (!item.name?.trim() || Number(item.price) < 0 || Number(item.qty) <= 0) {
        return res.status(400).json({ error: 'Data item tidak valid (nama kosong, harga negatif, atau qty <= 0).' });
      }
    }

    const trackingToken = crypto.randomUUID();

    const newOrder = await prisma.order.create({
      data: {
        trackingToken,
        vehicle: vehicle.trim(),
        plate: plate?.trim() || null,
        issue: issue?.trim() || 'Servis Kendaraan',
        color,
        status: 'QUEUE',
        mechanicId,
        items: {
          create: items.map((item: any) => ({
            type: item.type,
            name: item.name.trim(),
            price: Number(item.price) || 0,
            qty: Number(item.qty) || 1,
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

app.put('/api/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { status: newStatus, additionalItems } = req.body;

    // VALIDASI STATUS
    if (!newStatus || !Object.keys(ALLOWED_TRANSITIONS).includes(newStatus)) {
      return res.status(400).json({ error: 'Status tidak valid.' });
    }

    const currentOrder = await prisma.order.findUnique({ where: { id } });
    if (!currentOrder) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });

    if (!ALLOWED_TRANSITIONS[currentOrder.status]?.includes(newStatus)) {
      return res.status(400).json({ 
        error: `Transisi ilegal: Tidak bisa pindah dari ${currentOrder.status} ke ${newStatus}` 
      });
    }

    if (currentOrder.status === 'WORKING' && additionalItems?.length > 0) {
      // Validasi item tambahan
      for (const item of additionalItems) {
        if (!item.name?.trim() || Number(item.price) < 0 || Number(item.qty) <= 0) {
          return res.status(400).json({ error: 'Data item tambahan tidak valid.' });
        }
      }

      await prisma.orderItem.deleteMany({
        where: { orderId: id, isAdditional: true }
      });
      
      await prisma.orderItem.createMany({
        data: additionalItems.map((item: any) => ({
          orderId: id,
          type: item.type,
          name: item.name.trim(),
          price: Number(item.price) || 0,
          qty: Number(item.qty) || 1,
          sparepartId: item.sparepartId || null,
          isAdditional: true
        }))
      });
    }

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
// 7. ENDPOINT TRACKING (PUBLIK)
// ==========================================
app.get('/api/tracking/:token', async (req, res) => {
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
    const token = req.params.token as string;
    const { accepted } = req.body;

    if (typeof accepted !== 'boolean') {
      return res.status(400).json({ error: 'Parameter accepted harus boolean (true/false).' });
    }

    const order = await prisma.order.findUnique({ where: { trackingToken: token } });
    if (!order || order.status !== 'APPROVAL') {
      return res.status(400).json({ error: 'Pesanan tidak dalam status menunggu konfirmasi.' });
    }

    if (!accepted) {
      await prisma.orderItem.deleteMany({
        where: { orderId: order.id, isAdditional: true }
      });
    }

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
    
    // VALIDASI INPUT
    if (!lines || lines.length === 0) {
      return res.status(400).json({ error: 'Rincian pembayaran tidak boleh kosong.' });
    }

    const serviceAmount = lines.filter((l: any) => l.type === 'JASA').reduce((sum: number, l: any) => sum + (l.price * l.qty), 0);
    const partsAmount = lines.filter((l: any) => l.type === 'SPAREPART').reduce((sum: number, l: any) => sum + (l.price * l.qty), 0);
    const total = serviceAmount + partsAmount;

    const order = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
    const mechanicId = order?.mechanicId || undefined;
    const commission = await calculateCommission(mechanicId, serviceAmount, partsAmount);

    const result = await prisma.$transaction(async (tx) => {
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

      if (mode === 'service' && orderId) {
        await tx.order.delete({ where: { id: orderId } });
      }

      return newTx;
    });

    res.json({ success: true, transaction: result });
  } catch (error: any) {
    console.error('Checkout Error:', error);
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
  try {
    const { servicePercent, partsPercent, overrides } = req.body;
    
    // VALIDASI INPUT KOMISI
    if (Number(servicePercent) < 0 || Number(servicePercent) > 100 || Number(partsPercent) < 0 || Number(partsPercent) > 100) {
      return res.status(400).json({ error: 'Persentase komisi harus di antara 0 dan 100.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.commissionSetting.upsert({
        where: { id: 'global' },
        update: { servicePercent: Number(servicePercent), partsPercent: Number(partsPercent) },
        create: { id: 'global', servicePercent: Number(servicePercent), partsPercent: Number(partsPercent) }
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
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyimpan aturan komisi.' });
  }
});

// GLOBAL ERROR HANDLER
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