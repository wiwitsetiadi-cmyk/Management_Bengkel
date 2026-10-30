import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Edit3, Package, Plus, Search, X, Wrench, Trash2 } from 'lucide-react';
import type { Sparepart, Service } from '../data';
import { fetchApi } from '../api';

type StockStatus = 'aman' | 'menipis' | 'habis';

const formatRupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

const getStockStatus = (part: Sparepart): StockStatus => {
  if (part.stock === 0) return 'habis';
  if (part.stock <= part.minStock) return 'menipis';
  return 'aman';
};

const categories = ['CVT', 'Oli & Cairan', 'Rem', 'Ignition', 'Ban', 'Rantai', 'Filter', 'Lainnya'];

const nextPartCode = (parts: Sparepart[]) => {
  const maxNum = parts.reduce((max, p) => {
    const match = p.code.match(/^SP-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `SP-${String(maxNum + 1).padStart(3, '0')}`;
};

export function getStockAlerts(parts: Sparepart[]) {
  return parts
    .filter((p) => getStockStatus(p) !== 'aman')
    .sort((a, b) => {
      const order = { habis: 0, menipis: 1, aman: 2 };
      return order[getStockStatus(a)] - order[getStockStatus(b)];
    });
}

type PartPayload = { name: string; code: string; category: string; price: number; stock: number; minStock: number; };
type ServicePayload = { name: string; price: number; };

export default function StockPage({
  parts,
  setParts,
  services,
  refreshData,
  showToast,
}: {
  parts: Sparepart[];
  setParts: React.Dispatch<React.SetStateAction<Sparepart[]>>;
  services: Service[];
  refreshData: () => void;
  showToast: (message: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'sparepart' | 'service'>('sparepart');

  // === STATE SPAREPART ===
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'menipis' | 'habis'>('all');
  const [editingPart, setEditingPart] = useState<Sparepart | null>(null);
  const [showPartModal, setShowPartModal] = useState(false);
  const [restockPart, setRestockPart] = useState<Sparepart | null>(null);

  // === STATE SERVICE ===
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [saving, setSaving] = useState(false);

  const alerts = useMemo(() => getStockAlerts(parts), [parts]);
  const lowCount = alerts.filter((a) => getStockStatus(a) === 'menipis').length;
  const outCount = alerts.filter((a) => getStockStatus(a) === 'habis').length;

  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      const status = getStockStatus(p);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'menipis' && status === 'menipis') ||
        (filter === 'habis' && status === 'habis');
      return matchesSearch && matchesFilter;
    });
  }, [parts, search, filter]);

  const refreshParts = async () => {
    try {
      const res = await fetchApi('/api/spareparts');
      if (res.ok) {
        const data = (await res.json()) as Sparepart[];
        setParts(data);
      }
    } catch {}
  };

  const savePart = async (data: PartPayload) => {
    setSaving(true);
    try {
      let res;
      if (editingPart) {
        res = await fetchApi(`/api/spareparts/${editingPart.id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        res = await fetchApi('/api/spareparts', { method: 'POST', body: JSON.stringify(data) });
      }
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error || 'Gagal menyimpan sparepart');
        return;
      }
      
      showToast(editingPart ? 'Data sparepart diperbarui' : 'Sparepart baru ditambahkan');
      await refreshParts();
      setShowPartModal(false);
    } catch {
      showToast('Tidak dapat terhubung ke server');
    } finally {
      setSaving(false);
    }
  };

  const addStock = async (part: Sparepart, qty: number, note: string) => {
    setSaving(true);
    try {
      const res = await fetchApi(`/api/spareparts/${part.id}/restock`, { method: 'POST', body: JSON.stringify({ qty, note }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error || 'Gagal menambah stok');
        return;
      }
      await refreshParts();
      setRestockPart(null);
      showToast(`Stok ${part.name} bertambah ${qty} pcs${note ? ` · ${note}` : ''}`);
    } catch {
      showToast('Tidak dapat terhubung ke server');
    } finally {
      setSaving(false);
    }
  };

  // === SIMPAN SERVICE ===
  const saveService = async (data: ServicePayload) => {
    setSaving(true);
    try {
      let res;
      if (editingService) {
        res = await fetchApi(`/api/services/${editingService.id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        res = await fetchApi('/api/services', { method: 'POST', body: JSON.stringify(data) });
      }
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.error || 'Gagal menyimpan servis');
        return;
      }
      
      showToast(editingService ? 'Data servis diperbarui' : 'Servis baru ditambahkan');
      await refreshData(); // Refresh state global di App.tsx
      setShowServiceModal(false);
    } catch {
      showToast('Tidak dapat terhubung ke server');
    } finally {
      setSaving(false);
    }
  };

  const deleteService = async (id: string) => {
    if (!confirm('Hapus katalog servis ini?')) return;
    try {
      const res = await fetchApi(`/api/services/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Servis dihapus');
        refreshData();
      }
    } catch {}
  };

  const filterToLow = () => {
    setFilter('menipis');
    setSearch('');
  };

  const filters: { id: 'all' | 'menipis' | 'habis'; label: string }[] = [
    { id: 'all', label: 'Semua' },
    { id: 'menipis', label: 'Menipis' },
    { id: 'habis', label: 'Habis' },
  ];

  return (
    <div className="stock-page">
      <div className="stock-heading">
        <div>
          <div className="eyebrow"><span className="live-dot" /> INVENTARIS & LAYANAN</div>
          <h1>Stok & Katalog</h1>
          <p>Kelola ketersediaan suku cadang dan daftar harga jasa.</p>
        </div>
      </div>

      {/* TABS NAVIGASI */}
      <div className="settings-tabs" style={{ marginBottom: '20px' }}>
        <button className={`settings-tab ${activeTab === 'sparepart' ? 'active' : ''}`} onClick={() => setActiveTab('sparepart')}>
          <Package size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }}/> Stok Sparepart
        </button>
        <button className={`settings-tab ${activeTab === 'service' ? 'active' : ''}`} onClick={() => setActiveTab('service')}>
          <Wrench size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }}/> Katalog Servis
        </button>
      </div>

      {activeTab === 'sparepart' ? (
        <>
          {alerts.length > 0 && (
            <div className="stock-alert-banner fade-in">
              <AlertTriangle size={20} />
              <div className="stock-alert-copy">
                <strong>{lowCount} sparepart stok menipis{outCount > 0 ? `, ${outCount} habis` : ''}</strong>
                <span>Lengkapi stok sebelum mengganggu layanan servis.</span>
              </div>
              <button className="secondary-button stock-alert-action" onClick={filterToLow}>Lihat yang menipis</button>
            </div>
          )}

          <div className="stock-toolbar">
            <div className="stock-search">
              <Search size={18} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode atau nama sparepart…" />
            </div>
            <div className="stock-filter-chips" role="group" aria-label="Filter stok">
              {filters.map((f) => (
                <button key={f.id} className={`stock-filter-chip ${filter === f.id ? 'selected' : ''}`} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <button className="primary-button stock-add-btn" onClick={() => { setEditingPart(null); setShowPartModal(true); }}>
              <Plus size={16} /> Tambah Sparepart
            </button>
          </div>

          <div className="stock-table-card">
            <div className="stock-table">
              <div className="stock-table-head">
                <span>Kode</span><span>Nama</span><span>Kategori</span><span>Stok</span>
                <span className="right">Min. Stok</span><span className="right">Harga Jual</span><span className="right">Aksi</span>
              </div>
              {filteredParts.length === 0 ? (
                <div className="stock-empty-row"><Package size={22} /><span>Tidak ada sparepart yang cocok.</span></div>
              ) : filteredParts.map((part) => {
                const status = getStockStatus(part);
                return (
                  <div key={part.id} className={`stock-table-row ${status === 'menipis' ? 'low-stock' : ''} ${status === 'habis' ? 'out-stock' : ''}`}>
                    <span className="stock-code">{part.code}</span>
                    <span className="stock-name">{part.name}</span>
                    <span className="stock-category">{part.category}</span>
                    <span className="stock-qty-cell">
                      <strong className="tabular-nums">{part.stock}</strong>
                      <span className={`stock-badge ${status}`}>{status === 'aman' ? 'Aman' : status === 'menipis' ? 'Menipis' : 'Habis'}</span>
                    </span>
                    <span className="right tabular-nums">{part.minStock}</span>
                    <span className="right tabular-nums">{formatRupiah(part.price)}</span>
                    <span className="right stock-row-actions">
                      <button className="stock-action-btn edit" onClick={() => { setEditingPart(part); setShowPartModal(true); }}><Edit3 size={14} /> Edit</button>
                      <button className="stock-action-btn restock" onClick={() => setRestockPart(part)}><Plus size={14} /> Stok</button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="stock-toolbar">
            <div style={{ flex: 1 }} />
            <button className="primary-button stock-add-btn" onClick={() => { setEditingService(null); setShowServiceModal(true); }}>
              <Plus size={16} /> Tambah Servis
            </button>
          </div>

          <div className="stock-table-card">
            <div className="stock-table">
              {/* Override Grid Template khusus untuk tabel servis */}
              <div className="stock-table-head" style={{ gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px' }}>
                <span>Nama Layanan / Jasa</span><span className="right">Harga Jasa</span><span className="right">Aksi</span>
              </div>
              {services.length === 0 ? (
                <div className="stock-empty-row"><Wrench size={22} /><span>Belum ada katalog servis.</span></div>
              ) : services.map((service) => (
                <div key={service.id} className="stock-table-row" style={{ gridTemplateColumns: 'minmax(200px, 1fr) 150px 120px' }}>
                  <span className="stock-name" style={{ fontWeight: 600 }}>{service.name}</span>
                  <span className="right tabular-nums">{formatRupiah(service.price)}</span>
                  <span className="right stock-row-actions">
                    <button className="stock-action-btn edit" onClick={() => { setEditingService(service); setShowServiceModal(true); }}><Edit3 size={14} /> Edit</button>
                    <button className="stock-action-btn" style={{ color: 'var(--danger)' }} onClick={() => deleteService(service.id)}><Trash2 size={14} /></button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showPartModal && (
        <PartModal part={editingPart} newCode={nextPartCode(parts)} categories={categories} saving={saving} onClose={() => setShowPartModal(false)} onSave={savePart} />
      )}
      {restockPart && (
        <RestockModal part={restockPart} saving={saving} onClose={() => setRestockPart(null)} onSave={addStock} />
      )}
      {showServiceModal && (
        <ServiceModal service={editingService} saving={saving} onClose={() => setShowServiceModal(false)} onSave={saveService} />
      )}
    </div>
  );
}

// =========================================================
// MODAL: SERVICE (TAMBAH / EDIT KATALOG JASA)
// =========================================================
function ServiceModal({ service, saving, onClose, onSave }: { service: Service | null; saving: boolean; onClose: () => void; onSave: (data: ServicePayload) => void; }) {
  const [name, setName] = useState(service?.name || '');
  const [price, setPrice] = useState(String(service?.price ?? ''));

  const canSave = !saving && name.trim().length > 0 && price !== '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="settings-modal stock-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <div><span className="drawer-eyebrow">{service ? 'EDIT SERVIS' : 'TAMBAH SERVIS'}</span><h2>{service ? 'Edit Servis' : 'Tambah Servis'}</h2></div>
          <button className="close-button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="settings-modal-body" style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="settings-form-field">
            <span>Nama Layanan / Jasa *</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Servis CVT" />
          </label>
          <label className="settings-form-field">
            <span>Harga Jasa (Rp) *</span>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric" />
          </label>
        </div>
        <div className="dialog-footer">
          <button className="secondary-button" onClick={onClose} disabled={saving}>Batal</button>
          <button className="primary-button" disabled={!canSave} onClick={() => onSave({ name: name.trim(), price: Number(price) || 0 })}><Check size={16} /> {saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </section>
    </div>
  );
}

// =========================================================
// MODAL: TAMBAH / EDIT SPAREPART
// =========================================================
function PartModal({ part, newCode, categories, saving, onClose, onSave }: { part: Sparepart | null; newCode: string; categories: string[]; saving: boolean; onClose: () => void; onSave: (data: PartPayload) => void; }) {
  const [name, setName] = useState(part?.name || '');
  const [code, setCode] = useState(part?.code || newCode);
  const [category, setCategory] = useState(part?.category || categories[0]);
  const [price, setPrice] = useState(String(part?.price ?? ''));
  const [stock, setStock] = useState(String(part?.stock ?? ''));
  const [minStock, setMinStock] = useState(String(part?.minStock ?? ''));

  const canSave = !saving && name.trim().length > 0 && code.trim().length > 0 && price !== '' && minStock !== '';

  const handleSave = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), code: code.trim(), category, price: Number(price) || 0, stock: Number(stock) || 0, minStock: Number(minStock) || 0 });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="settings-modal stock-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <div><span className="drawer-eyebrow">{part ? 'EDIT SPAREPART' : 'TAMBAH SPAREPART'}</span><h2>{part ? 'Edit Sparepart' : 'Tambah Sparepart'}</h2></div>
          <button className="close-button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="settings-modal-body stock-modal-body">
          <label className="settings-form-field"><span>Kode sparepart *</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SP-001" /></label>
          <label className="settings-form-field"><span>Nama sparepart *</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: V-Belt Honda Beat" /></label>
          <label className="settings-form-field"><span>Kategori</span><div className="select-wrap"><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div></label>
          <label className="settings-form-field"><span>Harga jual (Rp) *</span><input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric" /></label>
          <label className="settings-form-field"><span>{part ? 'Stok saat ini' : 'Stok awal'}</span><input value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric" /></label>
          <label className="settings-form-field"><span>Stok minimum *</span><input value={minStock} onChange={(e) => setMinStock(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric" /></label>
        </div>
        <div className="dialog-footer">
          <button className="secondary-button" onClick={onClose} disabled={saving}>Batal</button>
          <button className="primary-button" disabled={!canSave} onClick={handleSave}><Check size={16} /> {saving ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </section>
    </div>
  );
}

// =========================================================
// MODAL: RESTOCK (TAMBAH STOK CEPAT)
// =========================================================
function RestockModal({ part, saving, onClose, onSave }: { part: Sparepart; saving: boolean; onClose: () => void; onSave: (part: Sparepart, qty: number, note: string) => void; }) {
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const canSave = !saving && Number(qty) > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="settings-modal stock-restock-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <div><span className="drawer-eyebrow">TAMBAH STOK CEPAT</span><h2>Tambah Stok</h2><p className="modal-subtitle">{part.name} · sisa {part.stock} pcs</p></div>
          <button className="close-button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="settings-modal-body">
          <label className="settings-form-field"><span>Jumlah masuk (pcs) *</span><input autoFocus value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" inputMode="numeric" /></label>
          <label className="settings-form-field"><span>Catatan</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: Beli dari Toko Jaya" /></label>
        </div>
        <div className="dialog-footer">
          <button className="secondary-button" onClick={onClose} disabled={saving}>Batal</button>
          <button className="primary-button" disabled={!canSave} onClick={() => onSave(part, Number(qty), note)}><Check size={16} /> Tambah Stok</button>
        </div>
      </section>
    </div>
  );
}