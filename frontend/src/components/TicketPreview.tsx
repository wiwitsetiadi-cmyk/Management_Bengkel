import { useState } from 'react';
import { X, Bike, FileText, Printer, Check } from 'lucide-react';
import type { Order } from '../data';

function TicketQr() {
  const cells = [0, 1, 2, 5, 7, 8, 10, 12, 13, 14, 16, 18, 19, 20, 22, 23, 24, 26, 28, 29, 30, 32, 34, 35, 36, 38, 39, 40, 42, 44, 45, 46, 48, 49, 50, 52, 54, 56, 57, 58, 60, 62, 64, 65, 66, 68, 70, 72, 73, 74, 76, 78, 80, 81, 82];
  return (
    <svg className="ticket-qr-svg" viewBox="0 0 90 90" role="img" aria-label="QR code tracking tiket">
      {cells.map((cell) => <rect key={cell} x={(cell % 9) * 10} y={Math.floor(cell / 9) * 10} width="8" height="8" />)}
      <rect x="5" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5" />
      <rect x="60" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5" />
      <rect x="5" y="60" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}

export default function TicketPreview({ order, onClose }: { order: Order; onClose: () => void }) {
  const [paperWidth, setPaperWidth] = useState<'58' | '80'>('80');
  const [copied, setCopied] = useState(false);
  const trackingUrl = `${window.location.origin}/tracking/${order.trackingToken}`;
  
  const copyTrackingLink = async () => {
    await navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };
  
  return (
    <div className="ticket-preview-backdrop" onClick={onClose}>
      <section className="ticket-preview-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="ticket-preview-controls">
          <div>
            <span className="drawer-eyebrow">PREVIEW STRUK AWAL</span>
            <h2>Preview Tiket Pesanan</h2>
            <p>Siap dicetak dan diberikan kepada pelanggan.</p>
          </div>
          <button className="close-button" aria-label="Tutup preview tiket" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="ticket-actions">
          <div className="paper-switch" role="group" aria-label="Pilih lebar kertas">
            <span>Lebar kertas</span>
            <button className={paperWidth === '58' ? 'selected' : ''} onClick={() => setPaperWidth('58')}>58mm</button>
            <button className={paperWidth === '80' ? 'selected' : ''} onClick={() => setPaperWidth('80')}>80mm</button>
          </div>
          <div className="ticket-action-buttons">
            <a className="secondary-button" href={trackingUrl} target="_blank" rel="noopener noreferrer"><Bike size={15} /> Buka Tracking</a>
            <button className="secondary-button" onClick={copyTrackingLink}><FileText size={15} /> {copied ? 'Link tersalin' : 'Salin Link'}</button>
            <button className="primary-button" onClick={() => window.print()}><Printer size={16} /> Cetak</button>
          </div>
        </div>
        <div className="ticket-stage">
          <article className={`print-ticket paper-${paperWidth}`}>
            <header className="receipt-header"><strong>BENGKEL MVP</strong><span>Jl. Kemang Raya No. 18, Jakarta</span><span>Telp. 0812-3456-7890</span></header>
            <div className="receipt-rule" />
            <div className="receipt-order-title"><span>TIKET PESANAN</span><strong>{order.id.slice(-8).toUpperCase()}</strong></div>
            <div className="receipt-lines">
              <div><span>Tanggal</span><strong>{new Date(order.createdAt).toLocaleDateString('id-ID')} · {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</strong></div>
              <div><span>Model</span><strong>{order.vehicle}</strong></div>
              <div><span>Plat</span><strong>{order.plate || '-'}</strong></div>
            </div>
            <div className="receipt-service-line"><span>Keluhan / servis</span><strong>{order.issue}</strong></div>
            <div className="receipt-qr"><TicketQr /><strong>{trackingUrl}</strong><span>Scan untuk pantau progres servis Anda.<br />Tanpa instal, tanpa login.</span></div>
            <div className="receipt-rule" />
            <p className="receipt-note">Simpan tiket ini untuk pengambilan kendaraan.</p>
            <footer>Terima kasih telah mempercayakan motor Anda.</footer>
          </article>
        </div>
        <div className="ticket-preview-footer">
          <span><Check size={14} /> Tidak ada rincian harga pada tiket awal</span>
          <button className="secondary-button" onClick={onClose}>Tutup</button>
        </div>
      </section>
    </div>
  );
}