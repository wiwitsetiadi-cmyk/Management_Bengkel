import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export default function SummaryCard({ icon: Icon, label, count, tone, detail }: { icon: LucideIcon; label: string; count: number; tone: string; detail: string }) {
  return (
    <div className="summary-card">
      <div className={`summary-icon ${tone}`}><Icon size={19} /></div>
      <div className="summary-copy">
        <span>{label}</span>
        <strong>{count}</strong>
        <small>{detail}</small>
      </div>
      <ChevronRight className="summary-arrow" size={16} />
    </div>
  );
}