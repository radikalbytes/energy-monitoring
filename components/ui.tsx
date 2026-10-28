import { ReactNode } from 'react';

export type IconName =
  | 'bolt' | 'euro' | 'leaf' | 'gauge' | 'trend' | 'clock' | 'plug' | 'wallet' | 'drop'
  | 'sun' | 'moon' | 'settings' | 'thermo' | 'up' | 'down' | 'close' | 'trash';

const PATHS: Record<IconName, ReactNode> = {
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  euro: <><path d="M18 6.5A7 7 0 1 0 18 17.5" /><path d="M4 10h9M4 14h9" /></>,
  leaf: <><path d="M5 19c0-9 5-14 15-14 0 10-5 15-13 15" /><path d="M5 19c2-5 5-8 9-10" /></>,
  gauge: <><path d="M4 16a8 8 0 1 1 16 0" /><path d="m12 16 4-5" /></>,
  trend: <path d="m3 17 6-6 4 4 8-9M15 6h6v6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  plug: <><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8Z" /><path d="M12 17v5" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13v4" /><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="16.5" cy="13.5" r="1" /></>,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  thermo: <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" />,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  down: <path d="M12 5v14M5 12l7 7 7-7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
};

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-slate-200/70 bg-white p-5 shadow-card dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Delta({ pct, inverse = true }: { pct: number | null; inverse?: boolean }) {
  if (pct === null) return <span className="text-xs text-slate-400">sin comparativa</span>;
  const up = pct > 0;
  const good = inverse ? !up : up;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        good ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
      }`}
    >
      <Icon name={up ? 'up' : 'down'} className="h-3 w-3" />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export function StatCard({
  icon, label, value, unit, sub, tint,
}: {
  icon: IconName; label: string; value: string; unit?: string; sub?: ReactNode; tint: string;
}) {
  return (
    <Card className="!p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tint}`}>
          <Icon name={icon} />
        </span>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</span>
        {unit && <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
      <div className="mt-2 min-h-[1.5rem] text-sm text-slate-500 dark:text-slate-400">{sub}</div>
    </Card>
  );
}
