const LABELS: Record<string, string> = {
  inactive: 'Free',
  pending: 'Awaiting start',
  active: 'In session',
};

const DOT: Record<string, string> = {
  inactive: 'bg-status-inactive',
  pending: 'bg-status-pending',
  active: 'bg-status-active',
};

export default function StatusBadge({ status }: { status: 'inactive' | 'pending' | 'active' }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-forest-100 px-2.5 py-1 text-xs font-medium text-ink">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {LABELS[status]}
    </span>
  );
}
