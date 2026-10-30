import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Buat Data Mekanik
  const mechanicBudi = await prisma.mechanic.create({
    data: { code: 'MK-001', name: 'Budi', initials: 'BU', color: '#F7E9D5', isActive: true }
  });
  
  const mechanicRizky = await prisma.mechanic.create({
    data: { code: 'MK-002', name: 'Rizky', initials: 'RZ', color: '#DCEBE9', isActive: true }
  });

  // 2. Buat Data Sparepart
  const partOli = await prisma.sparepart.create({
    data: { code: 'SP-001', name: 'Oli Mesin MPX 2T', category: 'Oli & Cairan', stock: 12, minStock: 6, price: 58000 }
  });

  const partBelt = await prisma.sparepart.create({
    data: { code: 'SP-002', name: 'V-Belt Honda Beat', category: 'CVT', stock: 5, minStock: 2, price: 110000 }
  });

  // 3. Buat Contoh Pesanan (State Machine: QUEUE)
  await prisma.order.create({
    data: {
      trackingToken: 'token-rahasia-001',
      vehicle: 'Honda Beat',
      plate: 'B 1234 XYZ',
      issue: 'Servis CVT',
      status: 'QUEUE',
      color: '#F7E9D5',
      mechanicId: mechanicBudi.id, // Relasi ke Budi
      items: {
        create: [
          {
            type: 'SPAREPART',
            name: 'V-Belt Honda Beat',
            price: 110000,
            qty: 1,
            sparepartId: partBelt.id, // Relasi ke Sparepart (untuk potong stok nanti)
          },
          {
            type: 'JASA',
            name: 'Biaya Jasa CVT',
            price: 50000,
            qty: 1,
            // sparepartId null karena ini Jasa
          }
        ]
      }
    }
  });

  // 4. Buat Katalog Servis
  await prisma.service.createMany({
    data: [
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
    ],
    skipDuplicates: true,
  });
  
  console.log('✅ Data Master Mekanik, Sparepart, dan Order berhasil dimasukkan!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });