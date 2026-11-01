// src/data/index.ts

export type OrderStatus = 'QUEUE' | 'WORKING' | 'APPROVAL' | 'READY';
export type OrderMode = 'service' | 'parts';
export type ItemType = 'JASA' | 'SPAREPART';

export type Mechanic = {
  id: string;
  code: string;
  name: string;
  initials: string;
  color: string;
  isActive: boolean;
};

export type Sparepart = {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
};

export type Service = {
  id: string;
  name: string;
  price: number;
};

export type OrderItem = {
  id: string;
  type: ItemType;
  name: string;
  price: number;
  qty: number;
  sparepartId?: string | null;
  isAdditional: boolean;
};

export type Order = {
  id: string;
  trackingToken: string;
  vehicle: string;
  plate?: string;
  customerName?: string;
  customerPhone?: string;
  issue: string;
  status: OrderStatus;
  color: string;
  createdAt: string;
  mechanicId?: string;
  mechanic?: Mechanic;
  items: OrderItem[];
};

export type Transaction = {
  id: string;
  orderId?: string;
  date: string;
  type: string;
  method: 'TUNAI' | 'QRIS' | 'SPLIT';
  total: number;
  serviceAmount: number;
  partsAmount: number;
  commission: number;
  mechanicId?: string;
  mechanic?: Mechanic;
};

export type CashierLine = {
  id: string;
  name: string;
  type: ItemType;
  qty: number;
  price: number;
};

export type PaymentEntry = {
  id: number;
  method: string;
  amount: number;
};

export type CashierSelection = {
  mode: 'service' | 'parts';
  order?: Order;
  lines: CashierLine[];
  total: number;
  payments?: PaymentEntry[];
  change?: number;
};

export type CartItem = Sparepart & { qty: number };

export type AdditionalItemPayload = {
  id?: string;
  name: string;
  type: ItemType;
  qty: number;
  price: number;
  sparepartId?: string | null;
};

// ============================================================
// ✅ DITAMBAH: Logika Stok dipindah ke sini (dari StockPage.tsx)
// ============================================================
export type StockStatus = 'aman' | 'menipis' | 'habis';

export const getStockStatus = (part: Sparepart): StockStatus => {
  if (part.stock === 0) return 'habis';
  if (part.stock <= part.minStock) return 'menipis';
  return 'aman';
};

export function getStockAlerts(parts: Sparepart[]): Sparepart[] {
  const order: Record<StockStatus, number> = { habis: 0, menipis: 1, aman: 2 };
  return parts
    .filter((p) => getStockStatus(p) !== 'aman')
    .sort((a, b) => order[getStockStatus(a)] - order[getStockStatus(b)]);
}

// ============================================================
// ATURAN & KONSTANTA
// ============================================================
export const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  QUEUE: ['WORKING'],
  WORKING: ['APPROVAL', 'READY'],
  APPROVAL: ['READY', 'WORKING'],
  READY: [],
};

export const columns: { id: OrderStatus; title: string; shortTitle: string; tone: string }[] = [
  { id: 'QUEUE', title: 'Antrean', shortTitle: 'Antrean', tone: 'teal' },
  { id: 'WORKING', title: 'Dikerjakan', shortTitle: 'Dikerjakan', tone: 'blue' },
  { id: 'APPROVAL', title: 'Tunggu Konfirmasi', shortTitle: 'Konfirmasi', tone: 'amber' },
  { id: 'READY', title: 'Siap Bayar', shortTitle: 'Siap Bayar', tone: 'green' },
];

// ============================================================
// HELPER
// ============================================================
export const formatRupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

export const getLocalDateISO = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getLocalTimeHM = (date: Date = new Date()): string => {
  const h = String(date.getHours()).padStart(2, '0');
  const i = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${i}`;
};