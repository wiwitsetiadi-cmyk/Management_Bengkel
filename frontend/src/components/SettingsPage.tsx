import { useEffect, useState } from 'react';
import { Edit3, Plus, X } from 'lucide-react';
import type { Mechanic } from '../data';
import { fetchApi } from '../api';

type SettingsTab = 'mechanics' | 'commission';

export default function SettingsPage({ showToast, mechanics, setMechanics }: { showToast: (msg: string) => void; mechanics: Mechanic[]; setMechanics: React.Dispatch<React.SetStateAction<Mechanic[]>> }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('mechanics');
  const [showMechanicModal, setShowMechanicModal] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState<Mechanic | null>(null);

  return (
    <div className="settings-page">
      <div className="settings-heading">
        <div><div className="eyebrow"><span className="live-dot" /> KONFIGURASI SISTEM</div><h1>Pengaturan</h1><p>Kelola data mekanik dan komisi.</p></div>
      </div>

      <div className="settings-tabs">
        <button className={`settings-tab ${activeTab === 'mechanics' ? 'active' : ''}`} onClick={() => setActiveTab('mechanics')}>Master Data Mekanik</button>
        <button className={`settings-tab ${activeTab === 'commission' ? 'active' : ''}`} onClick={() => setActiveTab('commission')}>Aturan Komisi</button>
      </div>

      {activeTab === 'mechanics' && <MechanicsTab mechanics={mechanics} setMechanics={setMechanics} onAdd={() => { setEditingMechanic(null); setShowMechanicModal(true); }} onEdit={(m) => { setEditingMechanic(m); setShowMechanicModal(true); }} showToast={showToast} />}
      {activeTab === 'commission' && <CommissionTab showToast={showToast} />}

      {showMechanicModal && <MechanicModal mechanic={editingMechanic} mechanics={mechanics} onClose={() => setShowMechanicModal(false)} showToast={showToast} onSuccess={(updatedMechanic, isEdit) => {
        if (isEdit) {
          setMechanics(curr => curr.map(m => m.id === updatedMechanic.id ? updatedMechanic : m));
        } else {
          setMechanics(curr => [...curr, updatedMechanic]);
        }
        setShowMechanicModal(false);
        showToast(isEdit ? 'Data mekanik diperbarui' : 'Mekanik baru ditambahkan');
      }} />}
    </div>
  );
}

function MechanicsTab({ mechanics, setMechanics, onAdd, onEdit, showToast }: { mechanics: Mechanic[]; setMechanics: React.Dispatch<React.SetStateAction<Mechanic[]>>; onAdd: () => void; onEdit: (m: Mechanic) => void; showToast: (msg: string) => void }) {
  const toggleActive = async (m: Mechanic) => {
    try {
      const res = await fetchApi(`/api/mechanics/${m.id}`, { method: 'PUT', body: JSON.stringify({ name: m.name, isActive: !m.isActive }) });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      
      // Update Local State
      setMechanics(curr => curr.map(item => item.id === m.id ? updated : item));
    } catch { showToast('Gagal mengubah status mekanik'); }
  };

  return (
    <div className="settings-content fade-in">
      <div className="settings-section-header">
        <div><strong>{mechanics.length} mekanik terdaftar</strong></div>
        <button className="primary-button" onClick={onAdd}><Plus size={16} /> Tambah Mekanik</button>
      </div>
      <div className="settings-mechanic-table">
        <div className="settings-mechanic-head"><span>ID</span><span>Nama</span><span>Status</span><span className="right">Aksi</span></div>
        {mechanics.map((m) => (
          <div key={m.id} className={`settings-mechanic-row ${!m.isActive ? 'inactive' : ''}`}>
            <span className="mechanic-id-cell">{m.code}</span>
            <span className="mechanic-name-cell"><span className="mechanic-avatar" style={{ backgroundColor: m.color }}>{m.initials}</span>{m.name}</span>
            <span><button className={`status-toggle ${m.isActive ? 'active' : 'inactive'}`} onClick={() => toggleActive(m)}><span className="status-toggle-dot" /> {m.isActive ? 'Aktif' : 'Nonaktif'}</button></span>
            <span className="right"><button className="edit-action" onClick={() => onEdit(m)}><Edit3 size={15} /> Edit</button></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommissionTab({ showToast }: { showToast: (msg: string) => void }) {
  const [servicePercent, setServicePercent] = useState('10');
  const [partsPercent, setPartsPercent] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchApi('/api/commission').then(res => res.json()).then(data => {
      setServicePercent(String(data.servicePercent));
      setPartsPercent(String(data.partsPercent));
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetchApi('/api/commission', { method: 'PUT', body: JSON.stringify({ servicePercent: Number(servicePercent), partsPercent: Number(partsPercent), overrides: {} }) });
      showToast('Aturan komisi disimpan');
    } catch { showToast('Gagal menyimpan'); } finally { setSaving(false); }
  };

  if (loading) return <div>Memuat...</div>;

  return (
    <div className="settings-content fade-in">
      <div className="settings-form-grid">
        <label className="settings-form-field"><span>Komisi Jasa (%)</span><div className="settings-percent-input"><input type="number" value={servicePercent} onChange={(e) => setServicePercent(e.target.value)} /><em>%</em></div></label>
        <label className="settings-form-field"><span>Komisi Sparepart (%)</span><div className="settings-percent-input"><input type="number" value={partsPercent} onChange={(e) => setPartsPercent(e.target.value)} /><em>%</em></div></label>
      </div>
      <div className="settings-save-bar"><button className="primary-button" disabled={saving} onClick={save}>Simpan</button></div>
    </div>
  );
}

function MechanicModal({ mechanic, mechanics, onClose, onSuccess, showToast }: { mechanic: Mechanic | null; mechanics: Mechanic[]; onClose: () => void; onSuccess: (updatedMechanic: Mechanic, isEdit: boolean) => void; showToast: (msg: string) => void; }) {
  const [name, setName] = useState(mechanic?.name || '');
  const nextCode = `MK-${String(Math.max(0, ...mechanics.map(m => Number(m.code.replace('MK-','')))) + 1).padStart(3, '0')}`;
  const code = mechanic?.code || nextCode;
  const [initials, setInitials] = useState(mechanic?.initials || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      let res;
      if (mechanic) {
        res = await fetchApi(`/api/mechanics/${mechanic.id}`, { method: 'PUT', body: JSON.stringify({ name, isActive: mechanic.isActive }) });
      } else {
        res = await fetchApi('/api/mechanics', { method: 'POST', body: JSON.stringify({ code, name, initials: initials || name.slice(0,2).toUpperCase(), color: '#DCEBE9' }) });
      }
      
      if (!res.ok) throw new Error();
      const data = await res.json();
      
      onSuccess(data, !!mechanic);
    } catch { 
      // PERBAIKAN: Ganti alert() dengan showToast()
      showToast('Gagal menyimpan mekanik'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading"><h2>{mechanic ? 'Edit' : 'Tambah'} Mekanik</h2><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        <div className="settings-modal-body">
          <label className="settings-form-field"><span>ID Mekanik</span><input value={code} readOnly /></label>
          <label className="settings-form-field"><span>Nama *</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="settings-form-field"><span>Inisial</span><input value={initials} onChange={(e) => setInitials(e.target.value)} maxLength={2} /></label>
        </div>
        <div className="dialog-footer"><button className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" disabled={saving || !name} onClick={save}>Simpan</button></div>
      </section>
    </div>
  );
}