import { useEffect, useMemo, useState } from 'react';
import TrackingPage from './components/TrackingPage';
import SettingsPage from './components/SettingsPage';
import ReportsPage from './components/ReportsPage';
import StockPage, { getStockAlerts } from './components/StockPage';

import AdminLogin from './components/AdminLogin';
import type { AuthUser } from './components/AdminLogin';
import SummaryCard from './components/SummaryCard';
import OrderCard from './components/OrderCard';
import EmptyColumn from './components/EmptyColumn';
import NewOrderDialog from './components/NewOrderDialog';
import TicketPreview from './components/TicketPreview';
import CashierPage from './components/CashierPage';
import FinalReceipt from './components/FinalReceipt';
import OrderDrawer from './components/OrderDrawer';

import {
  AlertCircle, Bell, Check, ChevronRight, ClipboardList,
  CreditCard, LayoutDashboard, Package, PanelLeft, Plus, Search, Settings, Wrench, X,
} from 'lucide-react';

import { allowedTransitions, columns } from './data';
import type { Order, CartItem, CashierSelection, CashierLine, OrderMode, OrderStatus } from './data';
import { fetchApi } from './api';
import { useData } from './hooks/useData'; // <-- Import Custom Hook

const navItems = [
  { label: 'Dasbor', icon: LayoutDashboard },
  { label: 'Kasir', icon: CreditCard },
  { label: 'Laporan', icon: ClipboardList },
  { label: 'Stok', icon: Package },
  { label: 'Pengaturan', icon: Settings },
];

function App() {
  const trackingMatch = window.location.pathname.match(/^(?:\/t|\/tracking)\/(.+)$/);

  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('bengkel_user');
    const token = localStorage.getItem('bengkel_token');
    if (!stored || !token) return null;
    try { return JSON.parse(stored) as AuthUser; } catch { return null; }
  });

  // === UI STATE (Hanya untuk tampilan) ===
  const [toast, setToast] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<OrderStatus | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderMode, setOrderMode] = useState<OrderMode>('service');
  const [serviceForm, setServiceForm] = useState({ vehicle: '', plate: '', customer: '', phone: '', issue: '', serviceType: '', mechanicId: '' });
  const [mechanicError, setMechanicError] = useState(false);
  const [partSearch, setPartSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ticketPreview, setTicketPreview] = useState<Order | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'cashier' | 'settings' | 'reports' | 'stock'>(() =>
    window.location.pathname === '/kasir' ? 'cashier'
    : window.location.pathname === '/pengaturan' ? 'settings'
    : window.location.pathname === '/laporan' ? 'reports'
    : window.location.pathname === '/stok' ? 'stock'
    : 'dashboard'
  );
  const [cashierSelection, setCashierSelection] = useState<CashierSelection | null>(null);
  const [finalReceipt, setFinalReceipt] = useState<CashierSelection | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [trackingCode, setTrackingCode] = useState<string | null>(trackingMatch ? trackingMatch[1] : null);

  // === TOAST HANDLER ===
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3400);
  };

  // === DATA STATE (Diambil dari Custom Hook) ===
  const { 
    orders, setOrders, 
    parts, setParts, 
    services, setServices, 
    transactions, setTransactions, 
    mechanics, setMechanics, 
    fetchData 
  } = useData(showToast);

  const stockAlerts = useMemo(() => getStockAlerts(parts), [parts]);

  const handleLogin = (user: AuthUser) => setAuthUser(user);
  const handleLogout = () => {
    localStorage.removeItem('bengkel_token');
    localStorage.removeItem('bengkel_user');
    setAuthUser(null);
  };

  useEffect(() => {
    if (authUser) fetchData();
  }, [authUser, fetchData]);

  useEffect(() => {
    const handlePop = () => {
      const match = window.location.pathname.match(/^(?:\/t|\/tracking)\/(.+)$/);
      setTrackingCode(match ? match[1] : null);
      setActiveView(
        window.location.pathname === '/kasir' ? 'cashier'
        : window.location.pathname === '/pengaturan' ? 'settings'
        : window.location.pathname === '/laporan' ? 'reports'
        : window.location.pathname === '/stok' ? 'stock'
        : 'dashboard'
      );
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const counts = useMemo(() => columns.map((column) => orders.filter((order) => order.status === column.id).length), [orders]);
  
  const searchResults = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    if (!query) return [];
    return orders.filter((order) => [order.id, order.vehicle, order.plate].filter(Boolean).some((value) => value!.toLowerCase().includes(query)));
  }, [orders, orderSearch]);
  
  const visibleOrders = orderSearch.trim() ? searchResults : orders;

  const openSearchResult = (order: Order) => {
    setSelectedOrder(order);
    setOrderSearch('');
    setSearchFocused(false);
  };

  const moveOrder = async (orderId: string, status: OrderStatus) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order || order.status === status || !allowedTransitions[order.status].includes(status)) return;
    
    const prevOrders = [...orders];
    setOrders((current) => current.map((item) => (item.id === orderId ? { ...item, status } : item)));
    setDropTarget(null);
    
    try {
      const res = await fetchApi(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Gagal update status');
        setOrders(prevOrders); 
      }
    } catch (error) {
      console.error(error);
      showToast('Gagal update ke database');
      setOrders(prevOrders);
    }
  };

  const handleDrop = (status: OrderStatus) => {
    if (draggedId) moveOrder(draggedId, status);
    setDraggedId(null);
  };

  const updateSelectedStatus = async (status: OrderStatus, additionalItems?: any[]) => {
    if (!selectedOrder) return;
    
    try {
      const res = await fetchApi(`/api/orders/${selectedOrder.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, additionalItems }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Gagal menyimpan perubahan');
        return;
      }

      setSelectedOrder(null);
      setOrders((current) => current.map((o) => (o.id === selectedOrder.id ? data : o)));
    } catch (error) {
      console.error(error);
      showToast('Gagal menyimpan perubahan ke database');
    }
  };

  const openNewOrder = () => {
    setOrderMode('service');
    setPartSearch('');
    setCart([]);
    setOrderDialogOpen(true);
    setMechanicError(false);
  };

  const updateServiceField = (field: keyof typeof serviceForm, value: string) => {
    setServiceForm((current) => ({ ...current, [field]: value }));
    if (field === 'mechanicId') setMechanicError(false);
  };

  const filteredParts = parts.filter((part) => part.name.toLowerCase().includes(partSearch.toLowerCase()));
  const cartTotal = cart.reduce((total, item) => total + item.price * item.qty, 0);

  const addPart = (part: any) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === part.id);
      if (existing) return current.map((item) => (item.id === part.id ? { ...item, qty: Math.min(item.qty + 1, item.stock) } : item));
      return [...current, { ...part, qty: 1 }];
    });
    setPartSearch('');
  };

  const changeQty = (id: string, amount: number) => {
    setCart((current) => current.map((item) => (item.id === id ? { ...item, qty: Math.max(1, Math.min(item.qty + amount, item.stock)) } : item)));
  };

  const removePart = (id: string) => setCart((current) => current.filter((item) => item.id !== id));

  const saveServiceOrder = async () => {
    if (!serviceForm.mechanicId) {
      setMechanicError(true);
      return;
    }
    const mechanic = mechanics.find((item) => item.id === serviceForm.mechanicId);
    const selectedService = services.find((s) => s.id === serviceForm.serviceType);
    
    if (!mechanic || !serviceForm.vehicle.trim() || !selectedService) return;

    const newOrderPayload = {
      vehicle: serviceForm.vehicle.trim(),
      plate: serviceForm.plate.trim() || undefined,
      issue: selectedService.name,
      color: mechanic.color,
      mechanicId: mechanic.id,
      items: [{ type: 'JASA', name: selectedService.name, price: selectedService.price, qty: 1 }] 
    };

    try {
      const res = await fetchApi('/api/orders', {
        method: 'POST',
        body: JSON.stringify(newOrderPayload),
      });
      
      const newOrder = await res.json();
      if (!res.ok) throw new Error(newOrder.error);

      setOrders((current) => [newOrder, ...current]);
      setOrderDialogOpen(false);
      setTicketPreview(newOrder);
      setServiceForm({ vehicle: '', plate: '', customer: '', phone: '', issue: '', serviceType: '', mechanicId: '' });
    } catch (error) {
      showToast('Gagal menyimpan pesanan ke database');
    }
  };

  const navigateView = (view: 'dashboard' | 'cashier' | 'settings' | 'reports' | 'stock') => {
    window.history.pushState({}, '', view === 'cashier' ? '/kasir' : view === 'settings' ? '/pengaturan' : view === 'reports' ? '/laporan' : view === 'stock' ? '/stok' : '/dasbor');
    setActiveView(view);
    setSidebarOpen(false);
  };

  const openCashierForOrder = (order: Order) => {
    const lines: CashierLine[] = order.items.map(i => ({
      id: i.sparepartId || i.id,
      name: i.name,
      type: i.type,
      qty: i.qty,
      price: i.price
    }));
    
    setCashierSelection({ mode: 'service', order, lines, total: lines.reduce((sum, line) => sum + line.price * line.qty, 0) });
    navigateView('cashier');
  };

  const openCashier = () => {
    if (cart.length === 0) return;
    const order = { id: '', vehicle: 'Sparepart langsung', issue: 'Pembelian sparepart', status: 'READY', color: '#DCEBE9', trackingToken: '', createdAt: new Date().toISOString(), items: [] } as unknown as Order;
    const lines = cart.map((item) => ({ id: item.id, name: item.name, type: 'SPAREPART' as const, qty: item.qty, price: item.price }));
    
    setCashierSelection({ mode: 'parts', order, lines, total: lines.reduce((sum, line) => sum + line.price * line.qty, 0) });
    setOrderDialogOpen(false);
    navigateView('cashier');
  };

  const handlePaid = async (selection: CashierSelection) => {
    try {
      const res = await fetchApi('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          orderId: selection.order?.id || undefined,
          mode: selection.mode,
          lines: selection.lines
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (selection.mode === 'service' && selection.order?.id) {
        setOrders((current) => current.filter(o => o.id !== selection.order!.id));
      }
      
      if (data.transaction) {
        setTransactions((current) => [data.transaction, ...current]);
      }

      setParts((current) => current.map(part => {
        const line = selection.lines.find(l => l.id === part.id || l.name.toLowerCase() === part.name.toLowerCase());
        return line ? { ...part, stock: Math.max(0, part.stock - line.qty) } : part;
      }));

      setCashierSelection(null);
      setFinalReceipt(selection);
      setCart([]);
    } catch (error: any) {
      showToast(error.message || 'Terjadi kesalahan saat menyimpan transaksi');
    }
  };

  const handleCustomerApproval = async (token: string, accepted: boolean) => {
    try {
      const res = await fetchApi(`/api/tracking/${token}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ accepted }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error('Gagal memproses persetujuan');
      
      setOrders((current) => current.map(o => o.trackingToken === token ? data : o));
      showToast(accepted ? 'Biaya tambahan disetujui' : 'Biaya tambahan ditolak');
    } catch (error) {
      console.error(error);
    }
  };

  if (trackingCode) {
    return (
      <TrackingPage code={trackingCode} onApprove={(accepted) => handleCustomerApproval(trackingCode, accepted)} />
    );
  }

  if (!authUser) return <AdminLogin onLogin={handleLogin} />;

  const avatarInitials = authUser.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <button className="icon-button mobile-menu" aria-label="Buka menu" onClick={() => setSidebarOpen((open) => !open)}><PanelLeft size={21} /></button>
          <div className="brand-mark"><Wrench size={18} strokeWidth={2.4} /></div>
          <span className="brand-name">BENGKEL</span>
          <span className="topbar-divider" />
          <span className="page-label">{activeView === 'cashier' ? 'Kasir' : activeView === 'settings' ? 'Pengaturan' : activeView === 'reports' ? 'Laporan' : activeView === 'stock' ? 'Stok & Katalog' : 'Dasbor Operasional'}</span>
        </div>
        <div className="global-search">
          <Search size={19} />
          <input aria-label="Cari" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} onFocus={() => setSearchFocused(true)} onKeyDown={(event) => { if (event.key === 'Escape') { setOrderSearch(''); setSearchFocused(false); } if (event.key === 'Enter' && searchResults[0]) openSearchResult(searchResults[0]); }} placeholder="Cari No. Pesanan / plat…" />
          {orderSearch && <button className="search-clear" onClick={() => setOrderSearch('')}><X size={15} /></button>}
          {searchFocused && orderSearch.trim() && <div className="search-results">{searchResults.length ? searchResults.map((order) => <button key={order.id} className="search-result" onClick={() => openSearchResult(order)}><span><strong>{order.vehicle}</strong><small>{order.plate || 'Tanpa plat'}</small></span><ChevronRight size={15} /></button>) : <div className="search-no-result">Tidak ditemukan</div>}</div>}
        </div>
        <div className="topbar-actions">
          <button className="icon-button notification-button" onClick={() => setBellOpen((open) => !open)}><Bell size={20} /><span className="notification-dot" /></button>
          {bellOpen && <div className="bell-dropdown fade-in"><div className="bell-dropdown-header"><strong>Notifikasi Stok</strong></div><div className="bell-dropdown-list">{stockAlerts.map((item) => <div key={item.id} className="bell-dropdown-item" onClick={() => { setBellOpen(false); navigateView('stock'); }}><span className={`bell-item-dot ${item.stock === 0 ? 'danger' : 'warning'}`} /><div><strong>{item.name}</strong><small>tersisa {item.stock} pcs</small></div></div>)}</div></div>}
          <button className="admin-profile admin-profile-button" onClick={handleLogout}>
            <div className="admin-avatar">{avatarInitials}</div>
            <div className="admin-copy"><strong>{authUser.name}</strong><span>Keluar</span></div>
          </button>
        </div>
      </header>

      <div className={`shell-body ${sidebarOpen ? 'sidebar-visible' : ''}`}>
        <aside className="sidebar">
          <button className="new-order-button" onClick={openNewOrder}><Plus size={19} strokeWidth={2.5} /> Pesanan Baru</button>
          <nav className="main-nav">
            {navItems.map(({ label, icon: Icon }) => {
              const isActive = (label === 'Dasbor' && activeView === 'dashboard') || (label === 'Kasir' && activeView === 'cashier') || (label === 'Pengaturan' && activeView === 'settings') || (label === 'Laporan' && activeView === 'reports') || (label === 'Stok' && activeView === 'stock');
              return (
                <button key={label} className={`nav-item ${isActive ? 'active' : ''}`} onClick={() => navigateView(label === 'Kasir' ? 'cashier' : label === 'Dasbor' ? 'dashboard' : label === 'Pengaturan' ? 'settings' : label === 'Laporan' ? 'reports' : 'stock')}>
                  <Icon size={19} /> <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="main-content">
          {activeView === 'cashier' ? (
            <CashierPage key={cashierSelection?.order?.id || 'empty'} selection={cashierSelection} orders={orders} onSelectOrder={openCashierForOrder} onPaid={handlePaid} />
          ) : activeView === 'settings' ? (
            <SettingsPage showToast={showToast} mechanics={mechanics} setMechanics={setMechanics} />
          ) : activeView === 'reports' ? (
            <ReportsPage transactions={transactions} showToast={showToast} />
          ) : activeView === 'stock' ? (
            <StockPage parts={parts} setParts={setParts} services={services} setServices={setServices} showToast={showToast} />
          ) : (
          <>
          <div className="page-heading">
            <div><div className="eyebrow"><span className="live-dot" /> OPERASIONAL HARI INI</div><h1>Dasbor Operasional</h1><p>Kelola alur servis bengkel dari satu tempat.</p></div>
            <div className="heading-actions"><button className="primary-button" onClick={openNewOrder}><Plus size={19} /> Pesanan Baru</button></div>
          </div>

          <section className="summary-row">
            <SummaryCard icon={ClipboardList} label="Antrean" count={counts[0]} tone="teal" detail="Menunggu" />
            <SummaryCard icon={Wrench} label="Dikerjakan" count={counts[1]} tone="blue" detail="Proses" />
            <SummaryCard icon={AlertCircle} label="Konfirmasi" count={counts[2]} tone="amber" detail="Tunggu pelanggan" />
            <SummaryCard icon={CreditCard} label="Siap Bayar" count={counts[3]} tone="green" detail="Selesai" />
          </section>

          <section className="kanban-board">
            {columns.map((column) => {
              const columnOrders = visibleOrders.filter((order) => order.status === column.id);
              return <div key={column.id} className={`kanban-column ${dropTarget === column.id ? 'drop-active' : ''}`} onDragOver={(event) => { event.preventDefault(); setDropTarget(column.id); }} onDragLeave={() => setDropTarget(null)} onDrop={() => handleDrop(column.id)}>
                <div className="column-header"><div className="column-title"><span className={`column-marker ${column.tone}`} /><h3>{column.title}</h3><span className="count-pill">{columnOrders.length}</span></div></div>
                <div className="column-body">
                  {columnOrders.length === 0 ? <EmptyColumn /> : columnOrders.map((order) => <OrderCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} onPay={order.status === 'READY' ? () => openCashierForOrder(order) : undefined} onDragStart={() => setDraggedId(order.id)} onDragEnd={() => { setDraggedId(null); setDropTarget(null); }} isDragging={draggedId === order.id} />)}
                </div>
              </div>;
            })}
          </section>
          </>)}
        </main>
      </div>

      {selectedOrder && <OrderDrawer order={selectedOrder} parts={parts} onClose={() => setSelectedOrder(null)} onStatusChange={updateSelectedStatus} />}
      {orderDialogOpen && <NewOrderDialog mode={orderMode} serviceForm={serviceForm} mechanicError={mechanicError} partSearch={partSearch} filteredParts={filteredParts} cart={cart} cartTotal={cartTotal} mechanics={mechanics} services={services} onClose={() => setOrderDialogOpen(false)} onModeChange={setOrderMode} onFieldChange={updateServiceField} onMechanicBlur={() => setMechanicError(!serviceForm.mechanicId)} onPartSearch={setPartSearch} onAddPart={addPart} onChangeQty={changeQty} onRemovePart={removePart} onSaveService={saveServiceOrder} onOpenCashier={openCashier} />}
      {ticketPreview && <TicketPreview order={ticketPreview} onClose={() => setTicketPreview(null)} />}
      {finalReceipt && <FinalReceipt selection={finalReceipt} onClose={() => setFinalReceipt(null)} onNewTransaction={() => { setFinalReceipt(null); navigateView('cashier'); setCashierSelection(null); }} />}
      {toast && <div className="toast"><span className="toast-check"><Check size={15} /></span>{toast}<button onClick={() => setToast(null)}><X size={15} /></button></div>}
    </div>
  );
}

export default App;