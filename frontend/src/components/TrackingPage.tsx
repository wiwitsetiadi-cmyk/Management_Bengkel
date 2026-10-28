import { useEffect, useState } from 'react';
import { AlertCircle, Bike, Check, Clock3, MessageCircle, ShieldCheck, Wrench, X } from 'lucide-react';
import type { Order } from '../data';

const API_BASE = 'http://localhost:3000';

const steps = [
  { id: 'QUEUE', label: 'Antrean' },
  { id: 'WORKING', label: 'Dikerjakan' },
  { id: 'APPROVAL', label: 'Konfirmasi' },
  { id: 'READY', label: 'Siap Bayar' },
];

const statusMessages: Record<string, string> = {
  QUEUE: 'Kendaraan Anda sedang dalam antrean.',
  WORKING: 'Mekanik kami sedang mengerjakan kendaraan Anda.',
  APPROVAL: 'Mekanik menemukan kebutuhan tambahan pada kendaraan Anda.',
  READY: 'Servis selesai! Silakan menuju kasir untuk melakukan pembayaran.',
};

const formatCurrency = (amount: number) => `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`;

export default function TrackingPage({ code, onApprove }: { code: string; onApprove: (accepted: boolean) => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [decisionMessage, setDecisionMessage] = useState('');

  useEffect(() => {
    // Fetch data berdasarkan trackingToken (code)
    fetch(`${API_BASE}/api/tracking/${code}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setOrder(data))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) return <div style={{ textAlign: 'center', padding: 50 }}>Memuat data...</div>;
  if (!order) return <main className="tracking-shell"><section className="tracking-not-found"><div className="tracking-brand"><Wrench size={18} /> BENGKEL MVP</div><div className="tracking-empty-icon"><AlertCircle size={28} /></div><h1>Tiket tidak valid</h1><p>Periksa kembali link pada tiket pesanan Anda.</p></section></main>;

  const currentIndex = steps.findIndex((step) => step.id === order.status);
  const total = order.items.reduce((sum, line) => sum + line.price * line.qty, 0);
  const additionalItems = order.items.filter(i => i.isAdditional);

  const decideExtra = (accepted: boolean) => {
    onApprove(accepted); 
    setDecisionMessage(accepted ? 'Persetujuan diterima. Mekanik akan melanjutkan servis.' : 'Biaya tambahan ditolak. Mekanik akan melanjutkan tanpa item tambahan.');
  };

  return <main className="tracking-shell customer-tracking-page">
    <section className="tracking-header customer-tracking-header">
      <div className="tracking-brand"><Wrench size={18} /> BENGKEL MVP</div>
      <span className="tracking-label">PELACAKAN SERVIS</span>
      <h1>{order.vehicle}</h1>
      <div className="tracking-vehicle"><Bike size={17} /> {order.plate || 'Tanpa plat nomor'}</div>
      <p className="customer-tracking-issue">{order.issue}</p>
    </section>
    
    <section className="tracking-card customer-tracking-card">
      <div className="tracking-card-heading">
        <div><span className="tracking-eyebrow">STATUS PESANAN</span><h2>{steps[currentIndex]?.label}</h2></div>
        <span className={`tracking-status-dot ${order.status.toLowerCase()}`} />
      </div>
      
      <div className="tracking-stepper customer-tracking-stepper">
        {steps.map((step, index) => (
          <div className={`tracking-step ${index <= currentIndex ? 'complete' : ''} ${index === currentIndex ? 'current' : ''}`} key={step.id}>
            <div className="tracking-step-marker">{index < currentIndex ? <Check size={14} /> : index + 1}</div>
            <strong>{step.label}</strong><span>{index < currentIndex ? 'Selesai' : index === currentIndex ? 'Saat ini' : 'Menunggu'}</span>
          </div>
        ))}
      </div>
      
      <div className={`customer-status-banner ${order.status.toLowerCase()}`}>
        <span className="customer-status-icon">{order.status === 'READY' ? <Check size={17} /> : order.status === 'APPROVAL' ? <AlertCircle size={17} /> : <Clock3 size={17} />}</span>
        <p>{order.status === 'WORKING' && order.mechanic ? `Mekanik kami (${order.mechanic.name}) sedang mengerjakan kendaraan Anda.` : statusMessages[order.status]}</p>
      </div>
      
      {order.status === 'APPROVAL' && (
        <div className="customer-approval-box">
          <div className="customer-approval-title"><AlertCircle size={19} /><strong>Menunggu Persetujuan Anda!</strong></div>
          <p>Mekanik menemukan kerusakan tambahan.</p>
          {additionalItems.map(item => (
            <div className="customer-extra-line" key={item.id}>
              <span>{item.name} (x{item.qty})</span><strong>{formatCurrency(item.price * item.qty)}</strong>
            </div>
          ))}
          <div className="customer-approval-actions">
            <button className="customer-approve-button" onClick={() => decideExtra(true)}><Check size={16} /> Setuju & Lanjutkan</button>
            <button className="customer-reject-button" onClick={() => decideExtra(false)}><X size={16} /> Tolak</button>
          </div>
        </div>
      )}
      
      {decisionMessage && <div className="customer-decision-message"><Check size={15} /> {decisionMessage}</div>}
      
      <div className="customer-cost-section">
        <div className="customer-section-heading"><div><span className="tracking-eyebrow">RINCIAN BIAYA</span><h2>Estimasi tagihan</h2></div><span>{order.items.length} item</span></div>
        <div className="customer-cost-table">
          <div className="customer-cost-head"><span>Item</span><span>Qty</span><span>Harga</span><span>Subtotal</span></div>
          {order.items.map((line) => <div className="customer-cost-row" key={line.id}><span>{line.name}</span><span>{line.qty}</span><span>{formatCurrency(line.price)}</span><strong>{formatCurrency(line.price * line.qty)}</strong></div>)}
          <div className="customer-cost-total"><span>Total Tagihan</span><strong>{formatCurrency(total)}</strong></div>
        </div>
      </div>
    </section>
    <a className="customer-whatsapp-fab" href="https://wa.me/6281234567890" target="_blank" rel="noreferrer" aria-label="Hubungi Admin"><MessageCircle size={22} /><span>Hubungi Admin</span></a>
    <p className="tracking-footer customer-tracking-footer"><span><i /> Halaman ini read-only</span><small><ShieldCheck size={12} /> Sistem Bengkel MVP</small></p>
  </main>;
}