import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ✅ MVP-1 1.9: seed idempoten — aman dijalankan berulang kali.
// Kunci upsert: Mechanic.code, Sparepart.code, Order.trackingToken (semuanya @unique).
// `update: {}` sengaja kosong supaya data yang sudah diubah/dipakai (stok, status pesanan) tidak tertimpa.
async function main() {
  // 1. Data Mekanik
  const mechanicBudi = await prisma.mechanic.upsert({
    where: { code: 'MK-001' },
    update: {},
    create: { code: 'MK-001', name: 'Budi', initials: 'BU', color: '#F7E9D5', isActive: true },
  });

  await prisma.mechanic.upsert({
    where: { code: 'MK-002' },
    update: {},
    create: { code: 'MK-002', name: 'Rizky', initials: 'RZ', color: '#DCEBE9', isActive: true },
  });

  // 2. Data Sparepart
  await prisma.sparepart.upsert({
    where: { code: 'SP-001' },
    update: {},
    create: { code: 'SP-001', name: 'Oli Mesin MPX 2T', category: 'Oli & Cairan', stock: 12, minStock: 6, price: 58000 },
  });

  const partBelt = await prisma.sparepart.upsert({
    where: { code: 'SP-002' },
    update: {},
    create: { code: 'SP-002', name: 'V-Belt Honda Beat', category: 'CVT', stock: 5, minStock: 2, price: 110000 },
  });

  // 3. Contoh Pesanan (QUEUE). Item hanya dibuat saat pesanan baru dibuat (bukan di `update`),
  //    sehingga seed kedua tidak menggandakan item.
  await prisma.order.upsert({
    where: { trackingToken: 'token-rahasia-001' },
    update: {},
    create: {
      trackingToken: 'token-rahasia-001',
      vehicle: 'Honda Beat',
      plate: 'B 1234 XYZ',
      issue: 'Servis CVT',
      status: 'QUEUE',
      color: '#F7E9D5',
      mechanicId: mechanicBudi.id,
      items: {
        create: [
          {
            type: 'SPAREPART',
            name: 'V-Belt Honda Beat',
            price: 110000,
            qty: 1,
            sparepartId: partBelt.id,
          },
          {
            type: 'JASA',
            name: 'Biaya Jasa CVT',
            price: 50000,
            qty: 1,
          },
        ],
      },
    },
  });

  // 4. Katalog Servis.
  // Service.name TIDAK unik di schema, jadi `createMany({ skipDuplicates })` tidak mencegah duplikat.
  // Cek per nama dulu; jangan ubah schema hanya demi seed (admin boleh membuat nama layanan yang sama).
  const services = [
    { name: 'Servis Ringan / Tune Up', price: 50000 },
    { name: 'Ganti Oli Mesin (Jasa)', price: 15000 },
    { name: 'Servis CVT (Matic)', price: 60000 },
    { name: 'Ganti Kampas Rem (Jasa)', price: 25000 },
    { name: 'Pembersihan / Jasa Injeksi', price: 50000 },
    { name: 'Ganti Ban Luar (Jasa)', price: 25000 },
    { name: 'Ganti Gear Set & Rantai (Jasa)', price: 35000 },
    { name: 'Kuras Tangki Bensin', price: 40000 },
    { name: 'Ganti Oli Shockbreaker (Jasa)', price: 50000 },
    { name: 'Servis Besar (Turun Mesin)', price: 250000 },
  ];
  for (const service of services) {
    const exists = await prisma.service.findFirst({ where: { name: service.name } });
    if (!exists) await prisma.service.create({ data: service });
  }

  console.log('✅ Seed selesai (aman dijalankan berulang): Mekanik, Sparepart, Order contoh, Katalog Servis.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });