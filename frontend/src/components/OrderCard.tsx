import { AlertCircle, Bike, Clock3, MoreHorizontal, ChevronRight } from 'lucide-react';
import type { Order } from '../data';
import { formatRupiah } from '../data';

type Props = {
  order: Order;
  onClick: () => void;
  onPay?: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
};

export default function OrderCard({ order, onClick, onPay, onDragStart, onDragEnd, isDragging }: Props) {
  const total = order.items.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <article className={`order-card ${isDragging ? 'dragging' : ''}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick}>
      <div className="card-topline">
        <span className="order-id">ID: {order.id.slice(-6).toUpperCase()}</span>
        <button className="card-menu" aria-label={`Opsi`} onClick={(event) => event.stopPropagation()}><MoreHorizontal size={17} /></button>
      </div>
      <h4>{order.vehicle}</h4>
      <div className={`plate-line ${!order.plate ? 'muted-italic' : ''}`}><Bike size={14} /> {order.plate || 'Tanpa plat'}</div>
      <div className="card-meta">
        <div className="mechanic">
          <span className="mechanic-avatar" style={{ backgroundColor: order.mechanic?.color || '#ccc' }}>{order.mechanic?.initials || '?'}</span>
          <span>{order.mechanic?.name || 'Belum ditugaskan'}</span>
        </div>
        <span className="time-line"><Clock3 size={13} /> {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <p className="issue-line">{order.issue}</p>
      
      {order.status === 'APPROVAL' && (
        <div className="approval-row">
          <span><AlertCircle size={14} /> Menunggu pelanggan</span>
          <strong>Biaya tambahan</strong>
        </div>
      )}
      {order.status === 'READY' && (
        <div className="ready-row">
          <strong>{formatRupiah(total)}</strong>
          <button onClick={(event) => { event.stopPropagation(); onPay?.(); }} >Bayar <ChevronRight size={13} /></button>
        </div>
      )}
    </article>
  );
}