import { useEffect, useState } from 'react';
import { Card, CardHeader, Icon } from './ui';
import { outageCategory, type Outage, type OutageCategory } from '../lib/outages';

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
  micro: 'Reinicio del ESP32',
};

const CATEGORY_BADGE: Record<OutageCategory, { text: string; cls: string }> = {
  cut: { text: 'Corte', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  micro: { text: 'Microcorte', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  network: { text: 'Sin conexión', cls: 'bg-slate-500/10 text-slate-500 dark:text-slate-400' },
};

const missedText = (n?: number) => (n == null ? '' : n === 0 ? ' · sin lecturas perdidas' : ` · ${n} ${n === 1 ? 'lectura perdida' : 'lecturas perdidas'}`);

function detectionText(o: Outage, cat: OutageCategory): string {
  let t = KIND_LABEL[o.kind];
  if (cat === 'micro') t += missedText(o.missed);
  else if (cat === 'network') t += ' · el ESP32 no se reinició: probable fallo de WiFi o Internet';
  else if (o.kind === 'gap' && o.rebooted) t += ' · el ESP32 se reinició';
  if (o.ipBefore && o.ipAfter && o.ipBefore !== o.ipAfter) t += ` · volvió con otra IP (${o.ipAfter})`;
  return t;
}

// Registro de cortes de luz: cuándo se perdió el suministro y cuándo volvió.
// Al pulsar un corte se llama a `onSelect` para cargar los datos de ese día en las gráficas.
export function OutageLog({ uuid, demo, onSelect, selected }: {
  uuid: string | null;
  demo: boolean;
  onSelect?: (o: Outage) => void;
  selected?: number | null; // `start` del corte que se está viendo
}) {
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
  // Las estadísticas de tiempo sin luz solo cuentan los cortes de luz (no microcortes ni fallos de conexión).
  const cuts = outages.filter((o) => outageCategory(o) === 'cut');
  const micros = outages.filter((o) => outageCategory(o) === 'micro');
  const totalMs = cuts.reduce((a, o) => a + o.durationMs, 0);
  const longest = cuts.reduce<Outage | null>((a, o) => (!a || o.durationMs > a.durationMs ? o : a), null);
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
        title="Cortes y microcortes de luz"
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

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Cortes de luz" value={String(cuts.length)} />
            <Stat label="Microcortes" value={String(micros.length)} />
            <Stat label="Tiempo total sin luz" value={cuts.length ? fmtDuration(totalMs) : '—'} />
            <Stat label="Corte más largo" value={longest ? fmtDuration(longest.durationMs) : '—'} />
            <Stat label="Último evento" value={outages[0] ? fmtDateTime(outages[0].start) : '—'} />
          </div>

          {outages.length === 0 ? (
            <p className="rounded-2xl border border-slate-100 p-4 text-sm text-slate-500 dark:border-white/5 dark:text-slate-400">
              No se ha detectado ningún corte ni microcorte de luz en este periodo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              {onSelect && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Pulsa un evento para ver en las gráficas los datos de ese día.</p>}
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Pérdida de luz</th>
                    <th className="pb-2 font-medium">Recuperación</th>
                    <th className="pb-2 font-medium">Duración</th>
                    <th className="pb-2 font-medium">Detección</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {list.map((o) => {
                    const cat = outageCategory(o);
                    return (
                    <tr
                      key={o.start}
                      onClick={onSelect ? () => onSelect(o) : undefined}
                      onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(o); } } : undefined}
                      tabIndex={onSelect ? 0 : undefined}
                      title={onSelect ? 'Ver los datos de ese día' : undefined}
                      className={`text-slate-700 dark:text-slate-300 ${onSelect ? 'cursor-pointer transition hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none dark:hover:bg-indigo-500/10 dark:focus:bg-indigo-500/10' : ''} ${selected === o.start ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}
                    >
                      <td className="py-2.5 pr-3">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${CATEGORY_BADGE[cat].cls}`}>{CATEGORY_BADGE[cat].text}</span>
                      </td>
                      <td className="py-2.5 pr-3 font-medium tabular-nums text-slate-900 dark:text-white">{fmtDateTime(o.start)}</td>
                      <td className="py-2.5 pr-3 tabular-nums">
                        {o.end == null ? (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">En curso</span>
                        ) : sameDay(o.start, o.end) ? fmtTime(o.end) : fmtDateTime(o.end)}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">{cat === 'micro' ? `≤ ${fmtDuration(o.durationMs)}` : fmtDuration(o.durationMs)}</td>
                      <td className="py-2.5 text-xs text-slate-500 dark:text-slate-400">{detectionText(o, cat)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {outages.length > SHOWN && (
                <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                  {showAll ? 'Ver menos' : `Ver los ${outages.length} eventos`}
                </button>
              )}
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            <b>Corte:</b> el dispositivo deja de enviar lecturas durante {minGap} min o más, o envía consumo, temperatura y
            humedad a 0. La hora de pérdida es la última lectura recibida y la de recuperación, la primera tras volver la luz.{' '}
            <b>Microcorte:</b> el ESP32 se ha reiniciado (cambia el ritmo al que envía las lecturas) aunque falten menos de{' '}
            {minGap} min de datos o ninguna; la luz se fue en algún momento entre las dos lecturas indicadas, por eso la
            duración es un máximo. Un reinicio por un fallo del propio ESP32 también aparecería así.{' '}
            <b>Sin conexión:</b> faltan lecturas pero el ESP32 no se reinició, así que hubo luz (fallo de WiFi o de Internet).
            Los cortes tan breves que no llegan a apagar el ESP32 (su alimentador aguanta unas décimas de segundo) no se detectan.
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
