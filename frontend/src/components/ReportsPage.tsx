import { useMemo, useState } from 'react';
import { ChevronRight, Download, Lock, Printer, TrendingUp, Wallet, Wrench, Package, Receipt } from 'lucide-react';
import { getLocalDateISO } from '../data';
import type { Transaction } from '../data';

type Period = 'today' | '7days' | 'month' | 'custom';
type TxFilter = 'all' | 'service' | 'parts';

const formatRupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

export default function ReportsPage({ transactions, showToast }: { transactions: Transaction[]; showToast: (message: string) => void }) {
  const [period, setPeriod] = useState<Period>('today');
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [expandedMechanic, setExpandedMechanic] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const filteredTransactions = useMemo(() => {
    if (period === 'today') {
      const today = getLocalDateISO();
      return transactions.filter((t) => getLocalDateISO(new Date(t.date)) === today);
    }
    return transactions;
  }, [transactions, period]);

  const displayTransactions = useMemo(() => {
    if (txFilter === 'all') return filteredTransactions;
    if (txFilter === 'service') return filteredTransactions.filter(t => t.type === 'Servis');
    return filteredTransactions.filter(t => t.type === 'Sparepart');
  }, [filteredTransactions, txFilter]);

  const kpis = useMemo(() => {
    const total = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
    const serviceTotal = filteredTransactions.reduce((sum, t) => sum + t.serviceAmount, 0);
    const partsTotal = filteredTransactions.reduce((sum, t) => sum + t.partsAmount, 0);
    const cashTotal = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
    return { total, serviceTotal, partsTotal, cashTotal, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const commissionData = useMemo(() => {
    const mechanics: Record<string, { name: string; code: string; initials: string; color: string; count: number; serviceOmzet: number; partsOmzet: number; commission: number; transactions: Transaction[] }> = {};
    filteredTransactions.filter((t) => t.mechanicId && t.mechanic).forEach((t) => {
      if (!t.mechanicId || !t.mechanic) return;
      if (!mechanics[t.mechanicId]) {
        mechanics[t.mechanicId] = { name: t.mechanic.name, code: t.mechanic.code, initials: t.mechanic.initials, color: t.mechanic.color, count: 0, serviceOmzet: 0, partsOmzet: 0, commission: 0, transactions: [] };
      }
      mechanics[t.mechanicId].count += 1;
      mechanics[t.mechanicId].serviceOmzet += t.serviceAmount;
      mechanics[t.mechanicId].partsOmzet += t.partsAmount;
      mechanics[t.mechanicId].commission += t.commission;
      mechanics[t.mechanicId].transactions.push(t);
    });
    return Object.values(mechanics).sort((a, b) => b.commission - a.commission);
  }, [filteredTransactions]);

  const totalCommission = commissionData.reduce((sum, m) => sum + m.commission, 0);

  const chartData = useMemo(() => {
    const revenueByDate: Record<string, number> = {};
    filteredTransactions.forEach((t) => {
      const dateStr = getLocalDateISO(new Date(t.date));
      revenueByDate[dateStr] = (revenueByDate[dateStr] || 0) + t.total;
    });
    
    return Object.keys(revenueByDate).sort().map((date) => {
      const parts = date.split('-');
      return {
        date,
        label: parts[2], // Hanya ambil tanggal (DD)
        amount: revenueByDate[date],
      };
    });
  }, [filteredTransactions]);

  const maxChartAmount = Math.max(...chartData.map((d) => d.amount), 1);

  return (
    <div className="reports-page">
      <div className="reports-heading">
        <div>
          <div className="eyebrow"><span className="live-dot" /> KEUANGAN & KOMISI</div>
          <h1>Laporan</h1>
          <p>Ringkasan transaksi lunas, pendapatan, dan komisi mekanik.</p>
        </div>
        <div className="reports-heading-actions">
          <div className="reports-period-switch" role="group" aria-label="Filter periode">
            <button className={period === 'today' ? 'selected' : ''} onClick={() => setPeriod('today')}>Hari ini</button>
            <button className={period === '7days' ? 'selected' : ''} onClick={() => setPeriod('7days')}>7 Hari</button>
            <button className={period === 'month' ? 'selected' : ''} onClick={() => setPeriod('month')}>Bulan ini</button>
          </div>
          <button className="secondary-button" onClick={() => showToast('Laporan diekspor ke CSV')}><Download size={16} /> Ekspor CSV</button>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="reports-empty">
          <div className="reports-empty-icon"><Receipt size={28} /></div>
          <strong>Belum ada transaksi lunas</strong>
          <span>Belum ada transaksi lunas pada periode ini.</span>
        </div>
      ) : (
        <>
          <section className="reports-kpi-row" aria-label="KPI laporan">
            <div className="reports-kpi-card"><div className="reports-kpi-icon teal"><Wallet size={19} /></div><div className="reports-kpi-copy"><span>Total Pendapatan</span><strong className="tabular-nums">{formatRupiah(kpis.total)}</strong><small>{kpis.count} transaksi lunas</small></div></div>
            <div className="reports-kpi-card"><div className="reports-kpi-icon blue"><Wrench size={19} /></div><div className="reports-kpi-copy"><span>Dari Jasa</span><strong className="tabular-nums">{formatRupiah(kpis.serviceTotal)}</strong><small>Servis kendaraan</small></div></div>
            <div className="reports-kpi-card"><div className="reports-kpi-icon amber"><Package size={19} /></div><div className="reports-kpi-copy"><span>Dari Sparepart</span><strong className="tabular-nums">{formatRupiah(kpis.partsTotal)}</strong><small>Penjualan sparepart</small></div></div>
            <div className="reports-kpi-card"><div className="reports-kpi-icon teal"><TrendingUp size={19} /></div><div className="reports-kpi-copy"><span>Jumlah Transaksi</span><strong className="tabular-nums">{kpis.count}</strong><small>Transaksi selesai</small></div></div>
          </section>

          <section className="reports-card reports-commission-card">
            <div className="reports-card-header"><h2>Komisi per Mekanik</h2><span className="reports-card-note">Komisi dihitung dari aturan di Pengaturan ➔ Aturan Komisi.</span></div>
            <div className="reports-commission-table">
              <div className="reports-commission-head">
                <span>Mekanik</span><span className="right">Servis Lunas</span><span className="right">Omzet Jasa</span><span className="right">Omzet Sparepart</span><span className="right">Komisi</span>
              </div>
              {commissionData.map((m) => (
                <div key={m.code} className="reports-commission-group">
                  <div className={`reports-commission-row ${expandedMechanic === m.code ? 'expanded' : ''}`} onClick={() => setExpandedMechanic(expandedMechanic === m.code ? null : m.code)}>
                    <span className="reports-mechanic-cell"><span className="mechanic-avatar" style={{ backgroundColor: m.color }}>{m.initials}</span><span className="reports-mechanic-info"><strong>{m.name}</strong><small>{m.code}</small></span><ChevronRight size={14} className={`reports-expand-chevron ${expandedMechanic === m.code ? 'rotated' : ''}`} /></span>
                    <span className="right tabular-nums">{m.count}</span>
                    <span className="right tabular-nums">{formatRupiah(m.serviceOmzet)}</span>
                    <span className="right tabular-nums">{formatRupiah(m.partsOmzet)}</span>
                    <span className="right tabular-nums reports-commission-amount">{formatRupiah(m.commission)}</span>
                  </div>
                  {expandedMechanic === m.code && (
                    <div className="reports-commission-detail fade-in">
                      {m.transactions.map((t) => (
                        <div key={t.id} className="reports-commission-detail-row">
                          <span>{t.id.slice(-6).toUpperCase()}</span>
                          <span className="tabular-nums">{new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {new Date(t.date).toLocaleDateString('id-ID')}</span>
                          <span className="tabular-nums">{formatRupiah(t.total)}</span>
                          <span className="tabular-nums reports-commission-detail-commission">{formatRupiah(t.commission)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="reports-commission-total">
                <span>Total Komisi</span>
                <span className="right tabular-nums reports-commission-amount">{formatRupiah(totalCommission)}</span>
              </div>
            </div>
          </section>

          <section className="reports-card reports-chart-card">
            <div className="reports-card-header"><h2>Pendapatan per Hari</h2></div>
            <div className="reports-chart">
              {chartData.map((d, i) => (
                <div key={d.date} className="reports-chart-bar-wrap" onMouseEnter={() => setHoveredBar(i)} onMouseLeave={() => setHoveredBar(null)}>
                  <div className={`reports-chart-tooltip ${hoveredBar === i ? 'visible' : ''}`}>{formatRupiah(d.amount)}</div>
                  <div className="reports-chart-bar" style={{ height: `${(d.amount / maxChartAmount) * 100}%` }} />
                  <span className="reports-chart-label">{d.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="reports-card reports-transactions-card">
            <div className="reports-card-header">
              <h2>Transaksi Lunas</h2>
              <div style={{ display: 'flex', gap: '4px', border: '1px solid var(--neutral-300)', borderRadius: '8px', overflow: 'hidden' }}>
                <button className={`reports-reprint-button ${txFilter === 'all' ? 'selected' : ''}`} style={{ border: 'none', borderRadius: 0, backgroundColor: txFilter === 'all' ? 'var(--brand-100)' : 'transparent' }} onClick={() => setTxFilter('all')}>Semua</button>
                <button className={`reports-reprint-button ${txFilter === 'service' ? 'selected' : ''}`} style={{ border: 'none', borderLeft: '1px solid var(--neutral-300)', borderRadius: 0, backgroundColor: txFilter === 'service' ? 'var(--brand-100)' : 'transparent' }} onClick={() => setTxFilter('service')}>Servis</button>
                <button className={`reports-reprint-button ${txFilter === 'parts' ? 'selected' : ''}`} style={{ border: 'none', borderLeft: '1px solid var(--neutral-300)', borderRadius: 0, backgroundColor: txFilter === 'parts' ? 'var(--brand-100)' : 'transparent' }} onClick={() => setTxFilter('parts')}>Sparepart</button>
              </div>
              <span className="reports-card-count">{displayTransactions.length} transaksi</span>
            </div>
            <div className="reports-tx-table">
              <div className="reports-tx-head">
                <span>No. Pesanan</span><span>Waktu</span><span>Jenis</span><span>Mekanik</span><span>Metode</span><span className="right">Total</span><span className="right">Aksi</span>
              </div>
              {displayTransactions.map((t) => (
                <div key={t.id} className="reports-tx-row">
                  <span className="reports-tx-id">{t.id.slice(-6).toUpperCase()}</span>
                  <span className="tabular-nums">{new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span><span className={`reports-type-chip ${t.type === 'Servis' ? 'service' : 'parts'}`}>{t.type}</span></span>
                  <span>{t.mechanic ? <span className="reports-tx-mechanic"><span className="mechanic-avatar" style={{ backgroundColor: t.mechanic.color }}>{t.mechanic.initials}</span>{t.mechanic.name}</span> : '—'}</span>
                  <span><span className={`reports-method-chip ${t.method === 'QRIS' ? 'qris' : 'cash'}`}>{t.method}</span></span>
                  <span className="right tabular-nums reports-tx-total">{formatRupiah(t.total)}</span>
                  <span className="right reports-tx-actions">
                    <Lock size={14} className="reports-lock-icon" />
                    <button className="reports-reprint-button" onClick={() => showToast(`Cetak ulang struk`)}><Printer size={14} /> Cetak ulang</button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}