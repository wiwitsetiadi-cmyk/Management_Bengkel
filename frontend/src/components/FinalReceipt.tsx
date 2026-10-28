import { useState } from 'react';
import { X, Plus, Printer, Check } from 'lucide-react';
import { formatRupiah } from '../data';
import type { CashierSelection, CashierLine } from '../data';

function ReceiptLine({ line }: { line: CashierLine }) {
  return (
    <div className="receipt-item-row">
      <div><span>{line.name}</span><small>{line.qty}x {formatRupiah(line.price)}</small></div>
      <strong>{formatRupiah(line.price * line.qty)}</strong>
    </div>
  );
}

export default function FinalReceipt({ selection, onClose, onNewTransaction }: { selection: CashierSelection; onClose: () => void; onNewTransaction: () => void }) {
  const [paperWidth, setPaperWidth] = useState<'58' | '80'>('80');
  const mechanicLabel = selection.mode === 'parts' || !selection.order?.mechanic ? 'Mekanik: -' : `Mekanik: ${selection.order.mechanic.code} · ${selection.order.mechanic.name}`;
  const subtotal = selection.lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const paid = selection.payments?.reduce((sum, p) => sum + p.amount, 0) || selection.total;
  const change = selection.change || Math.max(0, paid - selection.total);

  return (
    <div className="ticket-preview-backdrop" onClick={onClose}>
      <section className="ticket-preview-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="ticket-preview-controls">
          <div>
            <span className="drawer-eyebrow">PREVIEW STRUK FINAL</span>
            <h2>Bukti Pembayaran</h2>
            <p>Transaksi lunas. Cetak struk atau mulai transaksi baru.</p>
          </div>
          <button className="close-button" aria-label="Tutup struk" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="ticket-actions">
          <div className="paper-switch" role="group" aria-label="Pilih lebar kertas">
            <span>Lebar kertas</span>
            <button className={paperWidth === '58' ? 'selected' : ''} onClick={() => setPaperWidth('58')}>58mm</button>
            <button className={paperWidth === '80' ? 'selected' : ''} onClick={() => setPaperWidth('80')}>80mm</button>
          </div>
          <div className="ticket-action-buttons">
            <button className="secondary-button" onClick={onNewTransaction}><Plus size={15} /> Transaksi Baru</button>
            <button className="primary-button" onClick={() => window.print()}><Printer size={16} /> Cetak</button>
          </div>
        </div>
        <div className="ticket-stage">
          <article className={`print-ticket paper-${paperWidth} final-print-ticket`}>
            <header className="receipt-header"><strong>BENGKEL MVP</strong><span>Jl. Kemang Raya No. 18, Jakarta</span><span>Telp. 0812-3456-7890</span></header>
            <div className="receipt-rule" />
            <div className="receipt-order-title receipt-final-title"><span>BUKTI PEMBAYARAN</span><em className="lunas-stamp">LUNAS</em></div>
            <div className="receipt-lines">
              <div><span>No. Pesanan</span><strong>{selection.order?.id.slice(-8).toUpperCase() || '-'}</strong></div>
              <div><span>Tanggal</span><strong>{new Date().toLocaleDateString('id-ID')} · {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</strong></div>
              <div><span>Kasir</span><strong>Admin</strong></div>
              <div><span>Model</span><strong>{selection.order?.vehicle}</strong></div>
              <div><span>Plat</span><strong>{selection.order?.plate || '-'}</strong></div>
            </div>
            <div className="receipt-mechanic-block"><strong>{mechanicLabel}</strong></div>
            <div className="receipt-rule" />
            {selection.lines.filter((line) => line.type === 'JASA').length > 0 && <div className="receipt-section-label">Jasa</div>}
            {selection.lines.filter((line) => line.type === 'JASA').map((line) => <ReceiptLine key={line.id} line={line} />)}
            {selection.lines.filter((line) => line.type === 'SPAREPART').length > 0 && <div className="receipt-section-label">Sparepart</div>}
            {selection.lines.filter((line) => line.type === 'SPAREPART').map((line) => <ReceiptLine key={line.id} line={line} />)}
            <div className="receipt-rule" />
            <div className="receipt-subtotal-row"><span>Subtotal</span><strong>{formatRupiah(subtotal)}</strong></div>
            <div className="receipt-grand-row"><span>TOTAL</span><strong>{formatRupiah(selection.total)}</strong></div>
            <div className="receipt-rule" />
            <div className="receipt-section-label">Pembayaran</div>
            {selection.payments?.map((payment) => <div className="receipt-pay-row" key={payment.id}><span>{payment.method}</span><strong>{formatRupiah(payment.amount)}</strong></div>)}
            <div className="receipt-pay-row receipt-change-row"><span>Kembalian</span><strong>{formatRupiah(change)}</strong></div>
            <div className="receipt-rule" />
            <div className="receipt-warranty-box"><span>GARANSI</span><p>Garansi jasa 7 hari, sparepart sesuai ketentuan pabrik. Bawa struk ini untuk klaim.</p></div>
            <div className="receipt-footer-text">Terima kasih. Hati-hati di jalan!</div>
          </article>
        </div>
        <div className="ticket-preview-footer">
          <span><Check size={14} /> Transaksi lunas dan terkunci permanen</span>
          <button className="secondary-button" onClick={onClose}>Tutup</button>
        </div>
      </section>
    </div>
  );
}