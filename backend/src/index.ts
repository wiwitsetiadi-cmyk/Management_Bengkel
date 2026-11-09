import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

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
  APPROVAL: ['WORKING'],
  READY: ['PAID'],
  PAID: []
};

// ✅ MVP-1 1.3: Error bisnis yang status HTTP-nya ditentukan pemanggil
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function calculateCommission(mechanicId: string | undefined, serviceAmount: number, partsAmount: number): Promise<number> {
  // ✅ MVP-1 1.3: Komisi 0 bila tidak ada mekanik
  if (!mechanicId) return 0;

  let svcPct = 10;
  let ptsPct = 0;

  const setting = await prisma.commissionSetting.findUnique({ where: { id: 'global' } });
  if (setting) {
    svcPct = setting.servicePercent;
    ptsPct = setting.partsPercent;
  }

  const override = await prisma.commissionOverride.findUnique({ where: { mechanicId } });
  if (override) {
    if (override.servicePercent !== null) svcPct = override.servicePercent;
    if (override.partsPercent !== null) ptsPct = override.partsPercent;
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
// 5. ENDPOINT SPAREPART & SERVICE
// ==========================================
app.get('/api/spareparts', requireAuth, async (req, res) => {
  const parts = await prisma.sparepart.findMany({ orderBy: { code: 'asc' } });
  res.json(parts);
});

app.post('/api/spareparts', requireAuth, async (req, res) => {
  try {
    const { code, name, category, price, stock, minStock } = req.body;
    if (!code?.trim() || !name?.trim() || !category?.trim()) {
      return res.status(400).json({ error: 'Kode, Nama, dan Kategori wajib diisi.' });
    }
    if (Number(price) < 0 || Number(stock) < 0 || Number(minStock) < 0) {
      return res.status(400).json({ error: 'Harga dan stok tidak boleh negatif.' });
    }
    const part = await prisma.sparepart.create({
      data: {
        code: code.trim(), name: name.trim(), category: category.trim(),
        price: Number(price) || 0, stock: Number(stock) || 0, minStock: Number(minStock) || 0
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
    if (!code?.trim() || !name?.trim() || !category?.trim()) {
      return res.status(400).json({ error: 'Kode, Nama, dan Kategori wajib diisi.' });
    }
    if (Number(price) < 0 || Number(stock) < 0 || Number(minStock) < 0) {
      return res.status(400).json({ error: 'Harga dan stok tidak boleh negatif.' });
    }
    const part = await prisma.sparepart.update({
      where: { id },
      data: {
        code: code.trim(), name: name.trim(), category: category.trim(),
        price: Number(price) || 0, stock: Number(stock) || 0, minStock: Number(minStock) || 0
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
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Nama servis wajib diisi.' });
    }
    if (Number(price) < 0) {
      return res.status(400).json({ error: 'Harga servis tidak boleh negatif.' });
    }
    const service = await prisma.service.create({ data: { name: name.trim(), price: Number(price) || 0 } });
    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ error: 'Gagal menambah katalog servis.' });
  }
});

app.put('/api/services/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, price } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Nama servis wajib diisi.' });
    }
    if (Number(price) < 0) {
      return res.status(400).json({ error: 'Harga servis tidak boleh negatif.' });
    }
    const service = await prisma.service.update({
      where: { id }, data: { name: name.trim(), price: Number(price) || 0 }
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
    where: { status: { not: 'PAID' } },
    include: { items: { include: { sparepart: true } }, mechanic: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(orders);
});

app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const { vehicle, plate, issue, color, mechanicId, items } = req.body;
    if (!vehicle?.trim() || !mechanicId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Data pesanan tidak lengkap.' });
    }
    for (const item of items) {
      if (!item.name?.trim() || Number(item.price) < 0 || Number(item.qty) <= 0) {
        return res.status(400).json({ error: 'Data item tidak valid.' });
      }
    }

    const trackingToken = crypto.randomUUID();
    const newOrder = await prisma.order.create({
      data: {
        trackingToken, vehicle: vehicle.trim(), plate: plate?.trim() || null,
        issue: issue?.trim() || 'Servis Kendaraan', color, status: 'QUEUE', mechanicId,
        items: {
          create: items.map((item: any) => ({
            type: item.type, name: item.name.trim(), price: Number(item.price) || 0,
            qty: Number(item.qty) || 1, sparepartId: item.sparepartId || null, isAdditional: false
          }))
        }
      },
      include: { items: true }
    });
    res.json(newOrder);
  } catch (error) {
    res.status(500).json({ error: 'Gagal membuat pesanan.' });
  }
});

// ✅ MVP-1 1.1 + 1.2: Endpoint status — PAID hanya via checkout, additionalItems hanya via APPROVAL,
// klaim status atomik dengan updateMany (409 bila gagal), respons menyertakan mechanic + sparepart.
app.put('/api/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { status: newStatus, additionalItems } = req.body;

    if (!newStatus || !Object.keys(ALLOWED_TRANSITIONS).includes(newStatus)) {
      return res.status(400).json({ error: 'Status tidak valid.' });
    }

    // ✅ MVP-1 1.2: PAID hanya lewat checkout, bukan lewat endpoint status
    if (newStatus === 'PAID') {
      return res.status(400).json({ error: 'Status PAID hanya bisa melalui checkout.' });
    }

    // ✅ MVP-1 1.2: additionalItems hanya boleh dikirim saat mengajukan APPROVAL
    if (newStatus !== 'APPROVAL' && Array.isArray(additionalItems) && additionalItems.length > 0) {
      return res.status(400).json({ error: 'Item tambahan hanya boleh dikirim saat mengajukan konfirmasi (APPROVAL).' });
    }

    const currentOrder = await prisma.order.findUnique({ where: { id } });
    if (!currentOrder) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });

    if (!ALLOWED_TRANSITIONS[currentOrder.status]?.includes(newStatus)) {
      return res.status(400).json({ error: `Transisi ilegal: Tidak bisa pindah dari ${currentOrder.status} ke ${newStatus}` });
    }

    // Wajibkan item tambahan jika mau minta approval
    if (newStatus === 'APPROVAL' && (!additionalItems || additionalItems.length === 0)) {
      return res.status(400).json({ error: 'Harus ada biaya tambahan untuk meminta konfirmasi.' });
    }

    // ✅ MVP-1 1.1: Tolak READY selama masih ada item pending
    if (newStatus === 'READY') {
      const pendingCount = await prisma.orderItem.count({
        where: { orderId: id, isAdditional: true, approvedAt: null },
      });
      if (pendingCount > 0) {
        return res.status(400).json({ error: 'Masih ada biaya tambahan yang menunggu persetujuan pelanggan.' });
      }
    }

    // Validasi item tambahan kalau dikirim (hanya mungkin saat APPROVAL)
    if (newStatus === 'APPROVAL' && additionalItems?.length > 0) {
      for (const item of additionalItems) {
        if (!item.name?.trim() || Number(item.price) < 0 || Number(item.qty) <= 0) {
          return res.status(400).json({ error: 'Data item tambahan tidak valid.' });
        }
      }
    }

    // ✅ MVP-1 1.2: Bungkus dalam transaksi + klaim status atomik
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Klaim status: hanya menang bila status saat ini masih sama dengan yang kita baca
      const claim = await tx.order.updateMany({
        where: { id, status: currentOrder.status },
        data: { status: newStatus },
      });

      if (claim.count !== 1) {
        throw new Error('RACE_CONDITION');
      }

      // Ganti item pending hanya saat mengajukan APPROVAL
      if (newStatus === 'APPROVAL' && additionalItems?.length > 0) {
        await tx.orderItem.deleteMany({ where: { orderId: id, isAdditional: true, approvedAt: null } });
        await tx.orderItem.createMany({
          data: additionalItems.map((item: any) => ({
            orderId: id, type: item.type, name: item.name.trim(), price: Number(item.price) || 0,
            qty: Number(item.qty) || 1, sparepartId: item.sparepartId || null, isAdditional: true
          }))
        });
      }

      // ✅ MVP-1 1.1: Admin membatalkan permintaan konfirmasi → hapus item pending saja
      if (currentOrder.status === 'APPROVAL' && newStatus === 'WORKING') {
        await tx.orderItem.deleteMany({ where: { orderId: id, isAdditional: true, approvedAt: null } });
      }

      // ✅ MVP-1 1.2: Response menyertakan mechanic + sparepart (sama seperti GET /api/orders)
      return tx.order.findUnique({
        where: { id },
        include: { items: { include: { sparepart: true } }, mechanic: true }
      });
    });

    res.json(updatedOrder);
  } catch (error: any) {
    if (error.message === 'RACE_CONDITION') {
      return res.status(409).json({ error: 'Status pesanan sudah berubah, silakan muat ulang.' });
    }
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

// ✅ MVP-1 1.1: Setujui → tandai pending sebagai approvedAt; Tolak → hapus pending saja
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

    if (accepted) {
      await prisma.orderItem.updateMany({
        where: { orderId: order.id, isAdditional: true, approvedAt: null },
        data: { approvedAt: new Date() },
      });
    } else {
      await prisma.orderItem.deleteMany({
        where: { orderId: order.id, isAdditional: true, approvedAt: null },
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id }, data: { status: 'WORKING' },
      include: { items: true, mechanic: true }
    });

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: 'Gagal memproses persetujuan.' });
  }
});

// ==========================================
// 8. ENDPOINT CHECKOUT (TRANSAKSI ACID)
// ==========================================
// ✅ MVP-1 1.3: mode 'service' — validasi paidAmount, klaim status atomik (409),
//    stok atomik (400), TransactionItem snapshot, error bisnis via HttpError.
// ✅ MVP-1 1.4: mode 'parts' — harga dari DB, merge sparepartId, orderId/mechanicId null, komisi 0.
app.post('/api/checkout', requireAuth, async (req, res) => {
  try {
    const { mode, orderId, paidAmount, items } = req.body;

    if (!Number.isInteger(paidAmount) || paidAmount < 0) {
      throw new HttpError(400, 'Nominal pembayaran tidak valid.');
    }

    // =============================================
    // 8a. MODE PARTS — pembelian sparepart langsung
    // =============================================
    if (mode === 'parts') {
      if (!Array.isArray(items) || items.length === 0) {
        throw new HttpError(400, 'Item pembelian tidak boleh kosong.');
      }

      // Validasi + merge sparepartId yang duplikat
      const merged = new Map<string, number>();
      for (const it of items) {
        if (!it?.sparepartId || typeof it.sparepartId !== 'string' || !it.sparepartId.trim()) {
          throw new HttpError(400, 'Data item tidak valid.');
        }
        if (!Number.isInteger(it.qty) || it.qty <= 0) {
          throw new HttpError(400, 'Jumlah item harus bilangan bulat lebih dari 0.');
        }
        merged.set(it.sparepartId, (merged.get(it.sparepartId) || 0) + it.qty);
      }

      const partIds = Array.from(merged.keys());
      const parts = await prisma.sparepart.findMany({ where: { id: { in: partIds } } });
      if (parts.length !== partIds.length) {
        throw new HttpError(400, 'Ada sparepart yang tidak ditemukan.');
      }
      const partMap = new Map(parts.map(p => [p.id, p]));

      // Harga dari DB, bukan dari client
      let partsAmount = 0;
      for (const [id, qty] of merged) {
        partsAmount += partMap.get(id)!.price * qty;
      }
      const total = partsAmount;

      if (paidAmount < total) {
        const kurang = total - paidAmount;
        throw new HttpError(400, `Pembayaran kurang Rp ${kurang.toLocaleString('id-ID')}.`);
      }
      const change = paidAmount - total;

      const result = await prisma.$transaction(async (tx) => {
        // Pengurangan stok atomik (sama seperti mode service)
        for (const [id, qty] of merged) {
          const stockResult = await tx.sparepart.updateMany({
            where: { id, stock: { gte: qty } },
            data: { stock: { decrement: qty } }
          });
          if (stockResult.count !== 1) {
            throw new HttpError(400, `Stok ${partMap.get(id)!.name} tidak cukup!`);
          }
        }

        // Transaksi tanpa Order & tanpa Mekanik
        const newTx = await tx.transaction.create({
          data: {
            orderId: null,
            type: 'Sparepart',
            method: 'TUNAI',
            total,
            serviceAmount: 0,
            partsAmount,
            commission: 0,
            mechanicId: null,
            paidAmount,
            changeAmount: change
          }
        });

        await tx.transactionItem.createMany({
          data: Array.from(merged.entries()).map(([id, qty]) => ({
            transactionId: newTx.id,
            type: 'SPAREPART',
            name: partMap.get(id)!.name,
            price: partMap.get(id)!.price,
            qty,
            sparepartId: id
          }))
        });

        return newTx;
      });

      return res.json({ success: true, transaction: result, change });
    }

    // =============================================
    // 8b. MODE SERVICE — alur checkout pesanan (tidak berubah)
    // =============================================
    if (!orderId) {
      throw new HttpError(400, 'Order ID diperlukan.');
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
    if (!order) {
      throw new HttpError(400, 'Pesanan tidak ditemukan.');
    }
    if (order.status !== 'READY') {
      throw new HttpError(400, 'Pesanan belum siap bayar.');
    }

    // Hitung total dari database — bukan dari client
    const serviceAmount = order.items.filter(i => i.type === 'JASA').reduce((s, i) => s + i.price * i.qty, 0);
    const partsAmount = order.items.filter(i => i.type === 'SPAREPART').reduce((s, i) => s + i.price * i.qty, 0);
    const total = serviceAmount + partsAmount;

    if (paidAmount < total) {
      const kurang = total - paidAmount;
      throw new HttpError(400, `Pembayaran kurang Rp ${kurang.toLocaleString('id-ID')}.`);
    }
    const change = paidAmount - total;

    const mechanicId = order.mechanicId || undefined;
    const commission = await calculateCommission(mechanicId, serviceAmount, partsAmount);

    const result = await prisma.$transaction(async (tx) => {
      // ✅ Klaim status atomik: hanya sukses bila masih READY
      const claim = await tx.order.updateMany({
        where: { id: orderId, status: 'READY' },
        data: { status: 'PAID', paidAt: new Date() }
      });
      if (claim.count !== 1) {
        throw new HttpError(409, 'Pesanan ini sudah dibayar atau tidak siap bayar.');
      }

      // ✅ Tolak bila masih ada item pending (safety — seharusnya sudah dicegah di 1.1)
      const pendingCount = await tx.orderItem.count({
        where: { orderId, isAdditional: true, approvedAt: null }
      });
      if (pendingCount > 0) {
        throw new HttpError(400, 'Masih ada biaya tambahan yang menunggu persetujuan.');
      }

      // ✅ Pengurangan stok atomik
      for (const item of order.items) {
        if (item.type === 'SPAREPART' && item.sparepartId) {
          const stockResult = await tx.sparepart.updateMany({
            where: { id: item.sparepartId, stock: { gte: item.qty } },
            data: { stock: { decrement: item.qty } }
          });
          if (stockResult.count !== 1) {
            throw new HttpError(400, `Stok ${item.name} tidak cukup!`);
          }
        }
      }

      // Buat transaksi
      const newTx = await tx.transaction.create({
        data: {
          orderId: order.id,
          type: mode === 'service' ? 'Servis' : 'Sparepart',
          method: 'TUNAI',
          total, serviceAmount, partsAmount, commission, mechanicId,
          paidAmount, changeAmount: change
        }
      });

      // ✅ Simpan snapshot item ke TransactionItem
      await tx.transactionItem.createMany({
        data: order.items.map(item => ({
          transactionId: newTx.id,
          type: item.type,
          name: item.name,
          price: item.price,
          qty: item.qty,
          sparepartId: item.sparepartId
        }))
      });

      return newTx;
    });

    res.json({ success: true, transaction: result, change });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Checkout Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
  }
});

// ==========================================
// 9. ENDPOINT LAPORAN & KOMISI
// ==========================================
app.get('/api/transactions', requireAuth, async (req, res) => {
  const txs = await prisma.transaction.findMany({
    include: { mechanic: true, items: true },
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
    if (Number(servicePercent) < 0 || Number(servicePercent) > 100 || Number(partsPercent) < 0 || Number(partsPercent) > 100) {
      return res.status(400).json({ error: 'Persentase komisi harus di antara 0 dan 100.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.commissionSetting.upsert({
        where: { id: 'global' },
        update: { servicePercent: Number(servicePercent), partsPercent: Number(partsPercent) },
        create: { id: 'global', servicePercent: Number(servicePercent), partsPercent: Number(partsPercent) }
      });

      if (overrides && Object.keys(overrides).length > 0) {
        await tx.commissionOverride.deleteMany({});
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

// GLOBAL ERROR HANDLER & LISTEN
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server backend berjalan di http://localhost:${PORT}`);
});