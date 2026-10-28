import { useState, useMemo } from 'react';
import { X, Check, FileText, Package, Plus, Trash2, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { formatRupiah, columns } from '../data';
import type { Order, OrderStatus, Sparepart } from '../data';

type DetailItem = {
  id: string;
  name: string;
  type: 'JASA' | 'SPAREPART';
  qty: number;
  price: number;
  additional: boolean;
  locked?: boolean;
  stock?: number;
  sparepartId?: string | null;
};

function CostRow({ item, locked, onRemove }: { item: DetailItem; locked?: boolean; onRemove?: () => void }) {
  return (
    <div className="cost-table-row">
      <span>{item.name}{locked && <small className="row-locked"> terkunci</small>}{!locked && onRemove && <button className="row-remove" onClick={onRemove}><Trash2 size={13} /></button>}</span>
      <span><em className={`type-chip ${item.type === 'JASA' ? 'service' : 'parts'}`}>{item.type}</em></span>
      <span>{item.qty}</span>
      <span>{formatRupiah(item.price)}</span>
      <strong>{formatRupiah(item.price * item.qty)}</strong>
    </div>
  );
}

export default function OrderDrawer({ 
  order, 
  parts, 
  onClose, 
  onStatusChange
}: { 
  order: Order; 
  parts: Sparepart[]; 
  onClose: () => void; 
  onStatusChange: (status: OrderStatus, additionalItems?: any[]) => void; 
  // props showToast sudah dihapus karena tidak dipakai lagi
}) {
  const initialItems = useMemo(() => {
    return (order.items || []).map((item) => {
      const realPart = parts.find((p) => p.id === item.sparepartId);
      return { ...item, additional: item.isAdditional, stock: item.type === 'SPAREPART' ? realPart?.stock : undefined };
    });
  }, [order, parts]);

  const [items, setItems] = useState<DetailItem[]>(initialItems);
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<DetailItem['type']>('SPAREPART');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [itemStock, setItemStock] = useState<number | null>(null);
  const [itemSparepartId, setItemSparepartId] = useState<string | null>(null);
  const [itemError, setItemError] = useState('');
  const [copied, setCopied] = useState(false);
  
  const additionalItems = items.filter((item) => item.additional);
  const baseTotal = items.filter((item) => !item.additional).reduce((total, item) => total + item.price * item.qty, 0);
  const additionalTotal = additionalItems.reduce((total, item) => total + item.price * item.qty, 0);
  const newTotal = baseTotal + additionalTotal;
  const isLocked = order.status === 'APPROVAL' || order.status === 'READY';
  const trackingUrl = `${window.location.origin}/tracking/${order.trackingToken}`;

  const copyTrackingLink = async () => {
    await navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const addDetailItem = () => {
    const price = Number(itemPrice);
    const qty = Number(itemQty);
    if (!itemName.trim() || !price || !qty || isLocked) return;

    let realStock = undefined;
    if (itemType === 'SPAREPART') {
      if (!itemSparepartId) {
        setItemError('Pilih sparepart dari daftar.');
        return;
      }
      if (qty > (itemStock || 0)) {
        setItemError(`Stok tidak cukup. Sisa: ${itemStock} pcs`);
        return;
      }
      realStock = itemStock || 0;
    }

    setItemError('');
    setItems((current) => [
      ...current,
      { id: `extra-${Date.now()}`, name: itemName.trim(), type: itemType, qty, price, additional: true, stock: realStock, sparepartId: itemSparepartId },
    ]);
    setItemName('');
    setItemPrice('');
    setItemQty('1');
    setItemStock(null);
    setItemSparepartId(null);
  };

  const getAdditionalItemsPayload = () => {
    return additionalItems.map(({ additional, locked, stock, ...item }) => item);
  };

  const removeDetailItem = (itemId: string) => {
    if (!isLocked) setItems((current) => current.filter((item) => item.id !== itemId));
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="detail-drawer detail-drawer-wide" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span className="drawer-eyebrow">DETAIL PESANAN</span>
            <h2>{order.vehicle}</h2>
            <span className="drawer-subtitle">{order.plate || 'Tanpa plat nomor'}</span>
          </div>
          <button className="close-button" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="drawer-status">
          <span className={`status-dot ${order.status.toLowerCase()}`} />
          {columns.find((column) => column.id === order.status)?.title}
        </div>
        
        <div className="order-info-grid">
          <div><span>Waktu masuk</span><strong>{new Date(order.createdAt).toLocaleTimeString('id-ID')}</strong></div>
          <div className="info-mechanic"><span>Mekanik</span><strong>{order.mechanic?.name || 'Belum ditugaskan'}</strong></div>
          <div>
            <span>Tracking pelanggan</span>
            <div className="tracking-actions">
              <strong>{order.trackingToken}</strong>
              <button onClick={copyTrackingLink}>{copied ? <Check size={14} /> : <FileText size={14} />}</button>
            </div>
          </div>
        </div>
        
        <div className="drawer-section cost-section">
          <div className="section-heading">
            <div><span className="drawer-label">RINCIAN BIAYA</span><strong>Estimasi transaksi</strong></div>
          </div>
          <div className="cost-table">
            <div className="cost-table-head"><span>Item</span><span>Tipe</span><span>Qty</span><span>Harga</span><span>Subtotal</span></div>
            {items.some((item) => !item.additional) && (
              <>{items.filter((item) => !item.additional).map((item) => <CostRow key={item.id} item={item} />)}</>
            )}
            {additionalItems.length > 0 && (
              <>{additionalItems.map((item) => <CostRow key={item.id} item={item} locked={isLocked} onRemove={() => removeDetailItem(item.id)} />)}</>
            )}
          </div>
        </div>
        
        <div className="add-item-section">
          <div className="section-heading">
            <div><span className="drawer-label">TAMBAH ITEM</span><strong>Biaya tambahan</strong></div>
            {isLocked && <span className="locked-label"><Check size={12} /> Terkunci</span>}
          </div>
          <div className="add-item-grid">
            <div className="autocomplete-field">
              <input disabled={isLocked} value={itemName} onChange={(event) => { setItemName(event.target.value); setItemStock(null); setItemError(''); setItemSparepartId(null); }} placeholder="Nama item / cari stok" />
              {itemName && !isLocked && !itemSparepartId && (
                <div className="item-suggestions">
                  {parts.filter((part) => part.name.toLowerCase().includes(itemName.toLowerCase())).slice(0, 3).map((part) => (
                    <button key={part.id} onClick={() => { setItemName(part.name); setItemPrice(String(part.price)); setItemStock(part.stock); setItemSparepartId(part.id); setItemError(''); }}>
                      <span>{part.name}</span><small>Stok {part.stock}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select disabled={isLocked} value={itemType} onChange={(event) => setItemType(event.target.value as DetailItem['type'])}><option value="SPAREPART">Sparepart</option><option value="JASA">Jasa</option></select>
            <input disabled={isLocked} className="qty-input" value={itemQty} onChange={(event) => setItemQty(event.target.value)} inputMode="numeric" />
            <input disabled={isLocked} className="price-input" value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} placeholder="Harga" inputMode="numeric" />
            <button className="secondary-button add-item-button" disabled={isLocked} onClick={addDetailItem}><Plus size={15} /></button>
          </div>
          {itemError ? (
            <small className="stock-hint" style={{ color: 'var(--danger)' }}><AlertCircle size={12} /> {itemError}</small>
          ) : itemStock !== null ? (
            <small className="stock-hint"><Package size={12} /> Sisa stok: {itemStock} pcs</small>
          ) : null}
        </div>
        
        <div className="cost-summary">
          <div><span>Total item</span><strong>{formatRupiah(baseTotal)}</strong></div>
          <div><span>Total tambahan</span><strong>{formatRupiah(additionalTotal)}</strong></div>
          <div className="grand-total"><span>Total baru</span><strong>{formatRupiah(newTotal)}</strong></div>
        </div>
        
        {/* FOOTER: Logika Fleksibel untuk Admin */}
        <div className="drawer-footer drawer-footer-sticky" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {order.status === 'QUEUE' && (
            <button className="primary-button full-width" onClick={() => onStatusChange('WORKING', [])}>
              Mulai Dikerjakan <ChevronRight size={15} />
            </button>
          )}

          {order.status === 'WORKING' && additionalItems.length > 0 && (
            <>
              <button className="primary-button full-width" onClick={() => onStatusChange('READY', getAdditionalItemsPayload())}>
                <CheckCircle size={16} /> Siap Bayar Langsung
              </button>
              <button className="secondary-button full-width" onClick={() => onStatusChange('APPROVAL', getAdditionalItemsPayload())}>
                Minta Konfirmasi (Kirim Link Web) <ChevronRight size={15} />
              </button>
            </>
          )}

          {order.status === 'WORKING' && additionalItems.length === 0 && (
            <button className="primary-button full-width" onClick={() => onStatusChange('READY', [])}>
              Selesai & Siap Bayar <ChevronRight size={15} />
            </button>
          )}

          {order.status === 'APPROVAL' && (
            <button className="primary-button full-width" onClick={() => onStatusChange('READY', order.items.filter(i => i.isAdditional))}>
              Lanjut ke Siap Bayar <ChevronRight size={15} />
            </button>
          )}

        </div>
      </aside>
    </div>
  );
}