import { useEffect, useState } from 'react';
import { Card, CardHeader, Icon } from './ui';
import type { Outage } from '../lib/outages';

interface OutageResponse {
  outages: Outage[];
  since: number;
  days: number;
  minGapMs: number;
}

const REFRESH_MS = 60_000;
const SHOWN = 8;

const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

function fmtDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

const KIND_LABEL: Record<Outage['kind'], string> = {
  gap: 'Sin lecturas',
  zeros: 'Lecturas a 0',
  mixed: 'Sin lecturas y a 0',
};

// Registro de cortes de luz: cuándo se perdió el suministro y cuándo volvió.
export function OutageLog({ uuid, demo }: { uuid: string | null; demo: boolean }) {
  const [data, setData] = useState<OutageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!uuid || demo) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/outages?uuid=${encodeURIComponent(uuid)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Error de servidor');
        if (alive) { setData(j); setError(null); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'No se pudo cargar el registro');
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, [uuid, demo]);

  const outages = data?.outages ?? [];
  const ongoing = outages.find((o) => o.end == null) ?? null;
  const totalMs = outages.reduce((a, o) => a + o.durationMs, 0);
  const longest = outages.reduce<Outage | null>((a, o) => (!a || o.durationMs > a.durationMs ? o : a), null);
  const list = showAll ? outages : outages.slice(0, SHOWN);
  const minGap = Math.round((data?.minGapMs ?? 600_000) / 60_000);

  const badge = ongoing ? (
    <span className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> Sin luz ahora
    </span>
  ) : data ? (
    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Suministro normal</span>
  ) : null;

  return (
    <Card>
      <CardHeader
        title="Cortes de luz"
        subtitle={data ? `Registro desde ${new Date(data.since).toLocaleDateString('es-ES')} · últimos ${data.days} días como máximo` : 'Registro de pérdidas y recuperaciones del suministro'}
        right={badge}
      />

      {demo ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">El registro de cortes solo está disponible con datos reales del dispositivo.</p>
      ) : error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">No se pudo cargar el registro: {error}</p>
      ) : !data ? (
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
      ) : (
        <>
          {ongoing && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
              <Icon name="bolt" className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                <b>Sin suministro desde las {fmtTime(ongoing.start)}</b> ({fmtDateTime(ongoing.start)}) · {fmtDuration(ongoing.durationMs)} sin lecturas del dispositivo.
              </p>
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Cortes registrados" value={String(outages.length)} />
            <Stat label="Tiempo total sin luz" value={outages.length ? fmtDuration(totalMs) : '—'} />
            <Stat label="Corte más largo" value={longest ? fmtDuration(longest.durationMs) : '—'} />
            <Stat label="Último corte" value={outages[0] ? fmtDateTime(outages[0].start) : '—'} />
          </div>

          {outages.length === 0 ? (
            <p className="rounded-2xl border border-slate-100 p-4 text-sm text-slate-500 dark:border-white/5 dark:text-slate-400">
              No se ha detectado ningún corte de luz en este periodo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-2 font-medium">Pérdida de luz</th>
                    <th className="pb-2 font-medium">Recuperación</th>
                    <th className="pb-2 font-medium">Duración</th>
                    <th className="pb-2 font-medium">Detección</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {list.map((o) => (
                    <tr key={o.start} className="text-slate-700 dark:text-slate-300">
                      <td className="py-2.5 pr-3 font-medium tabular-nums text-slate-900 dark:text-white">{fmtDateTime(o.start)}</td>
                      <td className="py-2.5 pr-3 tabular-nums">
                        {o.end == null ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">En curso</span>
                        ) : sameDay(o.start, o.end) ? fmtTime(o.end) : fmtDateTime(o.end)}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">{fmtDuration(o.durationMs)}</td>
                      <td className="py-2.5 text-xs text-slate-500 dark:text-slate-400">
                        {KIND_LABEL[o.kind]}
                        {o.ipBefore && o.ipAfter && o.ipBefore !== o.ipAfter && ` · volvió con otra IP (${o.ipAfter})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {outages.length > SHOWN && (
                <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                  {showAll ? 'Ver menos' : `Ver los ${outages.length} cortes`}
                </button>
              )}
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Se registra un corte cuando el dispositivo deja de enviar lecturas durante {minGap} min o más, o cuando envía consumo,
            temperatura y humedad a 0. La hora de pérdida es la última lectura recibida (precisión ≈ 1 min) y la de recuperación,
            la primera lectura tras volver la luz, que puede retrasarse lo que tarden en arrancar el router y el ESP32.
            Un fallo de WiFi o de Internet largo también aparecería aquí.
          </p>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 p-3 dark:border-white/5">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
