import { ClipboardList } from 'lucide-react';

export default function EmptyColumn() {
  return (
    <div className="empty-column">
      <div className="empty-icon"><ClipboardList size={21} /></div>
      <strong>Belum ada pesanan</strong>
      <span>Pesanan baru akan muncul di sini</span>
    </div>
  );
}