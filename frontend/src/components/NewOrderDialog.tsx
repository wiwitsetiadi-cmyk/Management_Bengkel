import type { ReactNode } from 'react';
import { X, Wrench, ShoppingCart, FileText, ChevronDown, Search, Minus, Plus, Trash2, Printer, ChevronRight } from 'lucide-react';
import { formatRupiah } from '../data';
import type { CartItem, OrderMode, Sparepart, Mechanic, Service } from '../data';

function Field({ label, hint, required, error, errorText, children }: { label: string; hint?: string; required?: boolean; error?: boolean; errorText?: string; children: ReactNode }) {
  return (
    <label className={`form-field ${error ? 'has-error' : ''}`}>
      <span>{label}{required && <b>*</b>}{hint && <em>{hint}</em>}</span>
      {children}
      {error && <small>{errorText}</small>}
    </label>
  );
}

export type NewOrderDialogProps = {
  mode: OrderMode;
  serviceForm: { vehicle: string; plate: string; customer: string; phone: string; issue: string; serviceType: string; mechanicId: string };
  mechanicError: boolean;
  partSearch: string;
  filteredParts: Sparepart[];
  cart: CartItem[];
  cartTotal: number;
  mechanics: Mechanic[];
  services: Service[]; // <-- PROP BARU
  onClose: () => void;
  onModeChange: (mode: OrderMode) => void;
  onFieldChange: (field: keyof NewOrderDialogProps['serviceForm'], value: string) => void;
  onMechanicBlur: () => void;
  onPartSearch: (value: string) => void;
  onAddPart: (part: Sparepart) => void;
  onChangeQty: (id: string, amount: number) => void;
  onRemovePart: (id: string) => void;
  onSaveService: () => void;
  onOpenCashier: () => void;
};

export default function NewOrderDialog({ 
  mode, 
  serviceForm, 
  mechanicError, 
  partSearch, 
  filteredParts, 
  cart, 
  cartTotal, 
  mechanics, 
  services, // <-- TERIMA PROP BARU
  onClose, 
  onModeChange, 
  onFieldChange, 
  onMechanicBlur, 
  onPartSearch, 
  onAddPart, 
  onChangeQty, 
  onRemovePart, 
  onSaveService, 
  onOpenCashier 
}: NewOrderDialogProps) {
  const submitParts = () => onOpenCashier();
  const activeMechanics = mechanics.filter(m => m.isActive);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="order-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="drawer-eyebrow">TRANSAKSI BARU</span>
            <h2>Pesanan Baru</h2>
            <p>Catat pesanan dan arahkan ke alur yang tepat.</p>
          </div>
          <button className="close-button" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="modal-meta">
          <div className="mode-switch" role="tablist">
            <button className={mode === 'service' ? 'selected' : ''} onClick={() => onModeChange('service')}><Wrench size={16} /> Servis Kendaraan</button>
            <button className={mode === 'parts' ? 'selected' : ''} onClick={() => onModeChange('parts')}><ShoppingCart size={16} /> Beli Sparepart</button>
          </div>
          <span className="order-number-chip"><FileText size={14} /> No: <strong>OTOMATIS</strong></span>
        </div>
        
        {mode === 'service' ? (
          <div className="dialog-form fade-in">
            <div className="form-grid">
              <Field label="Model kendaraan" required><input autoFocus value={serviceForm.vehicle} onChange={(event) => onFieldChange('vehicle', event.target.value)} placeholder="Contoh: Honda Beat" /></Field>
              <Field label="Plat nomor" hint="Opsional"><input value={serviceForm.plate} onChange={(event) => onFieldChange('plate', event.target.value)} placeholder="B 1234 XYZ" /></Field>
            </div>
            
            <Field label="Jenis keluhan / servis" required>
              <div className="select-wrap">
                <select value={serviceForm.serviceType} onChange={(event) => onFieldChange('serviceType', event.target.value)}>
                  <option value="">Pilih jenis servis</option>
                  {/* PERBAIKAN: Looping data servis dari database */}
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({formatRupiah(service.price)})
                    </option>
                  ))}
                </select>
                <ChevronDown size={17} />
              </div>
            </Field>
            
            <Field label="Mekanik" required error={mechanicError} errorText="Pilih mekanik">
              <div className="select-wrap">
                <select value={serviceForm.mechanicId} onChange={(event) => onFieldChange('mechanicId', event.target.value)} onBlur={onMechanicBlur}>
                  <option value="">Pilih mekanik aktif</option>
                  {activeMechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.code} · {mechanic.name}</option>)}
                </select>
                <ChevronDown size={17} />
              </div>
            </Field>
          </div>
        ) : (
          <div className="parts-form fade-in">
            <div className="part-search-wrap">
              <Search size={18} />
              <input autoFocus value={partSearch} onChange={(event) => onPartSearch(event.target.value)} placeholder="Cari nama sparepart…" />
            </div>
            {partSearch && (
              <div className="part-results">
                {filteredParts.length ? filteredParts.map((part) => (
                  <button key={part.id} className="part-result" onClick={() => onAddPart(part)}>
                    <span><strong>{part.name}</strong><small>Stok {part.stock} pcs</small></span>
                    <b>{formatRupiah(part.price)}</b>
                  </button>
                )) : <div className="no-results">Sparepart tidak ditemukan</div>}
              </div>
            )}
            <div className="cart-heading"><span>Keranjang {cart.length ? `(${cart.length} item)` : ''}</span></div>
            {cart.length ? (
              <div className="cart-list">
                {cart.map((item) => (
                  <div className="cart-row" key={item.id}>
                    <div className="cart-item-copy"><strong>{item.name}</strong><span>{formatRupiah(item.price)} · stok {item.stock}</span></div>
                    <div className="qty-stepper">
                      <button onClick={() => onChangeQty(item.id, -1)}><Minus size={13} /></button>
                      <strong>{item.qty}</strong>
                      <button onClick={() => onChangeQty(item.id, 1)}><Plus size={13} /></button>
                    </div>
                    <strong className="cart-subtotal">{formatRupiah(item.price * item.qty)}</strong>
                    <button className="remove-item" onClick={() => onRemovePart(item.id)}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cart-empty"><ShoppingCart size={24} /><strong>Keranjang masih kosong</strong></div>
            )}
            <div className="cart-total"><span>Total sementara</span><strong>{formatRupiah(cartTotal)}</strong></div>
          </div>
        )}
        
        <div className="dialog-footer">
          <button className="secondary-button" onClick={onClose}>Batal</button>
          {mode === 'service' ? <button className="primary-button" onClick={onSaveService}><Printer size={17} /> Simpan Pesanan</button> : <button className="primary-button" disabled={!cart.length} onClick={submitParts}>Lanjut ke Kasir <ChevronRight size={16} /></button>}
        </div>
      </section>
    </div>
  );
}