import { useState } from 'react';
import { CreditCard, ChevronRight, Search, Check, AlertCircle, Bike } from 'lucide-react';
import { formatRupiah } from '../data';
import type { CashierSelection, Order } from '../data';

export default function CashierPage({ selection, orders, onSelectOrder, onPaid }: { selection: CashierSelection | null; orders: Order[]; onSelectOrder: (order: Order) => void; onPaid: (selection: CashierSelection) => void }) {
  const [payments, setPayments] = useState<{ id: number; method: 'Manual'; amount: number }[]>([{ id: 1, method: 'Manual', amount: 0 }]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const total = selection?.total || 0;
  const paid = payments[0]?.amount || 0;
  const change = Math.max(0, paid - total);
  const remaining = Math.max(0, total - paid);
  
  const formatInputValue = (value: number) => value ? formatRupiah(value) : '';
  const updatePayment = (amount: number) => setPayments([{ id: 1, method: 'Manual', amount }]);
  const finishPayment = () => { if (selection) { setConfirmOpen(false); onPaid({ ...selection, payments: payments.filter((p) => p.amount > 0), change }); } };

  if (!selection) return (
    <div className="cashier-empty-page">
      <div className="cashier-page-heading">
        <div><div className="eyebrow"><span className="live-dot" /> KASIR MANUAL</div><h1>Kasir</h1><p>Pilih pesanan yang siap dibayar untuk memulai transaksi.</p></div>
      </div>
      <div className="cashier-picker">
        <div className="cashier-picker-icon"><CreditCard size={25} /></div>
        <strong>Belum ada pesanan dipilih</strong>
        <span>Pilih tombol Bayar dari papan Dasbor atau pilih pesanan di bawah.</span>
        <div className="ready-order-list">
          {orders.filter((order) => order.status === 'READY').map((order) => (
            <button key={order.id} onClick={() => onSelectOrder(order)}>
              <span><strong>{order.vehicle}</strong><small>{order.plate || 'Tanpa plat'} · {order.mechanic?.name}</small></span>
              <b>Bayar <ChevronRight size={14} /></b>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="cashier-page">
      <div className="cashier-page-heading">
        <div><div className="eyebrow"><span className="live-dot" /> KASIR MANUAL</div><h1>Kasir</h1><p>Input nominal pembayaran yang diterima admin secara manual.</p></div>
        <span className={`transaction-mode ${selection.mode}`}>{selection.mode === 'service' ? 'Servis' : 'Sparepart Langsung'}</span>
      </div>
      <div className="cashier-layout">
        <section className="invoice-card">
          <div className="cashier-card-heading">
            <div><span className="drawer-eyebrow">RINCIAN PESANAN</span><h2>{selection.order?.vehicle}</h2></div>
            <button className="secondary-button" onClick={() => window.history.pushState({}, '', '/kasir')}><Search size={15} /> Cari pesanan</button>
          </div>
          <div className="invoice-vehicle">
            <div className="vehicle-icon"><Bike size={27} /></div>
            <div><strong>{selection.order?.vehicle}</strong><span>{selection.order?.plate || 'Tanpa plat nomor'}</span></div>
            <div className="invoice-mechanic"><small>MEKANIK</small><b>{selection.order?.mechanic?.name || '-'}</b></div>
          </div>
          <div className="invoice-table">
            <div className="invoice-table-head"><span>Item</span><span>Tipe</span><span>Qty</span><span>Harga</span><span>Subtotal</span></div>
            {selection.lines.map((line) => (
              <div className="invoice-table-row" key={line.id}>
                <span>{line.name}</span>
                <em className={`type-chip ${line.type === 'JASA' ? 'service' : 'parts'}`}>{line.type}</em>
                <span>{line.qty}</span>
                <span>{formatRupiah(line.price)}</span>
                <strong>{formatRupiah(line.price * line.qty)}</strong>
              </div>
            ))}
          </div>
          <div className="invoice-total"><span>Total tagihan</span><strong>{formatRupiah(total)}</strong></div>
        </section>
        <section className="payment-card">
          <div className="cashier-card-heading">
            <div><span className="drawer-eyebrow">PEMBAYARAN</span><h2>Input pembayaran</h2></div>
            <span className="secure-label"><Check size={13} /> Manual</span>
          </div>
          <div className="payment-list">
            <div className="payment-row">
              <div className="payment-row-top"><span>Nominal pembayaran</span><span className="manual-payment-label">Input manual admin</span></div>
              <div className="payment-input-row manual-payment-input">
                <input value={formatInputValue(payments[0]?.amount || 0)} onChange={(event) => updatePayment(Number(event.target.value.replace(/[^0-9]/g, '')))} placeholder="Rp 0" inputMode="numeric" aria-label="Nominal pembayaran" />
              </div>
            </div>
          </div>
          <div className="payment-summary">
            <div><span>Total</span><strong>{formatRupiah(total)}</strong></div>
            <div><span>Dibayar</span><strong>{formatRupiah(paid)}</strong></div>
            <div className={remaining ? 'due' : 'change'}><span>{remaining ? 'Kurang' : 'Kembalian'}</span><strong>{formatRupiah(remaining || change)}</strong><small>{!remaining && change ? 'Nominal lebih dari total tagihan' : ''}</small></div>
          </div>
          <button className="primary-button full-width settle-button" disabled={paid < total} onClick={() => setConfirmOpen(true)}><Check size={17} /> Lunas & Cetak Struk</button>
        </section>
      </div>
      {confirmOpen && (
        <div className="modal-backdrop confirmation-backdrop">
          <div className="payment-confirm-modal">
            <div className="confirm-icon"><AlertCircle size={22} /></div>
            <h2>Konfirmasi transaksi lunas?</h2>
            <p>Transaksi yang sudah Lunas terkunci permanen dan tidak dapat diubah.</p>
            <div><button className="secondary-button" onClick={() => setConfirmOpen(false)}>Periksa lagi</button><button className="primary-button" onClick={finishPayment}>Ya, Lunas</button></div>
          </div>
        </div>
      )}
    </div>
  );
}