import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from 'next-themes';
import { EnergyData } from '../types/energyData';
import {
  PERIODS, PeriodKey, Summary, bucketize, kwhBetween, buildInsights, comfort, fmt, fmtEur, isValidClimate, isValidHumidity, humiditySensorSuspect, summarize,
} from '../lib/energy';
import { generateDemo } from '../lib/demo';
import {
  BAND_COLORS, BAND_LABELS, COMERCIALIZADORAS, DISCOUNT_LABELS, HourBand, PvpcPoint, annualStatus, classifyDay,
} from '../lib/tariffs';
import { Card, CardHeader, Delta, Icon, StatCard } from '../components/ui';
import { ClimateChart, ConsumptionBars, HourlyBars, PowerArea, PowerGauge, PvpcChart } from '../components/Charts';
import SettingsModal, { useSettings } from '../components/SettingsModal';

const REFRESH_MS = 60_000;

const TONE = {
  good: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  bad: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

const hh = (ts: number) => `${new Date(ts).getHours().toString().padStart(2, '0')}:00`;

function bandRanges(points: PvpcPoint[], bands: HourBand[], band: HourBand): string {
  const out: string[] = [];
  let i = 0;
  while (i < points.length) {
    if (bands[i] !== band) { i++; continue; }
    let j = i;
    while (j + 1 < points.length && bands[j + 1] === band) j++;
    out.push(`${hh(points[i].ts)}–${hh(points[j].ts + 3600_000)}`);
    i = j + 1;
  }
  return out.join(', ') || '—';
}

const timeAgo = (ts: number, now: number) => {
  const m = Math.round((now - ts) / 60_000);
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return `hace ${Math.round(m / 1440)} d`;
};

export default function Home() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [settings, saveSettings] = useSettings();
  const [period, setPeriod] = useState<PeriodKey>('24h');
  const [devices, setDevices] = useState<string[]>([]);
  const [device, setDevice] = useState<string | null>(null);
  const [rows, setRows] = useState<EnergyData[] | null>(null);
  const [demo, setDemo] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const periodDef = PERIODS.find((p) => p.key === period)!;
  const forceDemo = router.isReady && router.query.demo === '1';

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    if (!router.isReady) return;
    if (forceDemo) {
      setDemo(true);
      setDevices(['demo-salon']);
      setDevice('demo-salon');
      setRows(generateDemo(62));
      setNow(Date.now());
      return;
    }
    try {
      let uuid = device;
      if (!uuid) {
        const r = await fetch('/api/data?timeRange=1');
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Error de servidor');
        const list: string[] = j.devices || [];
        setDevices(list);
        if (!list.length) {
          setDemo(true);
          setDevices(['demo-salon']);
          setDevice('demo-salon');
          setRows(generateDemo(62));
          setApiError(null);
          return;
        }
        uuid = list[0];
        setDevice(uuid);
      }
      const r = await fetch(`/api/data?uuid=${encodeURIComponent(uuid)}&timeRange=${periodDef.ms * 2}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error de servidor');
      setDemo(false);
      setApiError(null);
      setDevices((prev) => (j.devices?.length ? j.devices : prev));
      setRows(j.energyData || []);
      setNow(Date.now());
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'No se pudieron cargar los datos');
      setDemo(true);
      setRows((prev) => prev ?? generateDemo(62));
    }
  }, [router.isReady, forceDemo, device, periodDef.ms]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const all = useMemo(() => (rows ?? []).filter((d) => !device || demo || d.uuid === device), [rows, device, demo]);
  const from = now - periodDef.ms;

  // Tarifa: precio PVPC por horas (REE) o precio fijo, más el descuento social si procede.
  const isPvpc = !!COMERCIALIZADORAS.find((c) => c.id === settings.comercializadora)?.pvpc;
  const [pvpc, setPvpc] = useState<PvpcPoint[]>([]);
  const [pvpcError, setPvpcError] = useState<string | null>(null);
  const [pvpcDay, setPvpcDay] = useState<'today' | 'tomorrow'>('today');
  const [annualKwh, setAnnualKwh] = useState<number | null>(null);

  useEffect(() => {
    if (!isPvpc) return;
    let alive = true;
    const run = async () => {
      try {
        const r = await fetch('/api/pvpc');
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Error al obtener el PVPC');
        if (alive) { setPvpc(j.points); setPvpcError(null); }
      } catch (e) {
        if (alive) setPvpcError(e instanceof Error ? e.message : 'No se pudo obtener el PVPC');
      }
    };
    run();
    const id = setInterval(run, 15 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [isPvpc]);

  const periodStartMs = useMemo(() => new Date(`${settings.periodStart}T00:00:00`).getTime(), [settings.periodStart]);
  const hasDiscount = settings.discount !== 'none';

  useEffect(() => {
    if (!hasDiscount || !device) return;
    if (demo) { setAnnualKwh(kwhBetween(all, periodStartMs, Date.now() + 1)); return; }
    let alive = true;
    const run = async () => {
      try {
        const r = await fetch(`/api/annual?uuid=${encodeURIComponent(device)}&since=${periodStartMs}`);
        const j = await r.json();
        if (r.ok && alive) setAnnualKwh(j.kwh);
      } catch { /* se mantiene el último valor */ }
    };
    run();
    const id = setInterval(run, 10 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [hasDiscount, device, demo, all, periodStartMs]);

  const dayKey = (ts: number) => new Date(ts).toDateString();
  const todayKey = dayKey(now);
  const pvpcToday = useMemo(() => pvpc.filter((p) => dayKey(p.ts) === todayKey), [pvpc, todayKey]);
  const pvpcTomorrow = useMemo(() => pvpc.filter((p) => dayKey(p.ts) === dayKey(now + 86400_000)), [pvpc, now]);
  const shown = pvpcDay === 'tomorrow' && pvpcTomorrow.length >= 20 ? pvpcTomorrow : pvpcToday;
  const bands = useMemo(() => classifyDay(shown), [shown]);
  const avgToday = pvpcToday.length ? pvpcToday.reduce((a, p) => a + p.price, 0) / pvpcToday.length : null;
  const nowPrice = pvpcToday.find((p) => now >= p.ts && now < p.ts + 3600_000)?.price ?? null;

  const limit = settings.householdLimits[settings.household];
  const annual = annualKwh != null && hasDiscount ? annualStatus(annualKwh, limit, periodStartMs, now) : null;
  const discountRate = hasDiscount ? settings.discountRates[settings.discount as Exclude<typeof settings.discount, 'none'>] / 100 : 0;
  const discountActive = hasDiscount && !(annual?.exceeded);
  const grossPrice = isPvpc ? avgToday ?? settings.price : settings.price;
  const price = grossPrice * (discountActive ? 1 - discountRate : 1);
  const eff = useMemo(() => ({ ...settings, price }), [settings, price]);

  const alertLevel = settings.alerts && annual ? (annual.exceeded ? 'exceeded' : annual.pct >= 80 ? 'warning' : null) : null;
  useEffect(() => {
    if (!alertLevel || !annual || demo) return;
    const key = `energy-alert-${alertLevel}-${settings.periodStart}-${settings.household}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(
        alertLevel === 'exceeded' ? 'Has superado el límite del bono social' : 'Te acercas al límite del bono social',
        { body: `${annual.used.toFixed(0)} de ${annual.limit.toFixed(0)} kWh anuales con descuento.` },
      );
    }
  }, [alertLevel, annual, demo, settings.periodStart, settings.household]);
  const summary: Summary | null = useMemo(
    () => (rows ? summarize(all, periodDef.ms, eff, now) : null),
    [rows, all, periodDef.ms, eff, now],
  );
  const current = useMemo(() => all.filter((d) => d.timestamp >= from), [all, from]);
  const daily = period !== '24h';
  const buckets = useMemo(
    () => bucketize(all, from, now, daily ? 86400_000 : 3600_000, daily),
    [all, from, now, daily],
  );
  const climateRows = useMemo(() => current.filter(isValidClimate), [current]);
  const insights = summary ? buildInsights(summary, eff, periodDef.label) : [];

  const handleDelete = async (user: string, password: string) => {
    if (demo) return 'No hay datos reales que borrar.';
    setDeleting(true);
    try {
      const r = await fetch('/api/data', { method: 'DELETE', headers: { 'x-admin-user': user, 'x-admin-password': password } });
      if (!r.ok) return r.status === 401 ? 'Usuario o contraseña incorrectos' : 'Error al borrar';
      setShowSettings(false);
      setDevice(null);
      setRows(null);
      load();
      return null;
    } catch {
      return 'No se pudo conectar con el servidor';
    } finally {
      setDeleting(false);
    }
  };

  const cur = summary?.current;
  const live = !!summary?.online;
  const budgetPct = settings.monthlyBudget > 0 && summary ? (summary.monthProjectionCost / settings.monthlyBudget) * 100 : 0;
  const climate = cur && isValidHumidity(cur) ? comfort(cur.temperature, cur.humidity) : null;
  const humSuspect = !demo && humiditySensorSuspect(all, now);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-8">
      {/* Cabecera */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
            <Icon name="bolt" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight">Voltio</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tu energía, bajo control</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {devices.length > 1 && (
            <select
              value={device ?? ''}
              onChange={(e) => { setRows(null); setDevice(e.target.value); }}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm dark:border-white/10 dark:bg-slate-900"
            >
              {devices.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-slate-900">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  period === p.key
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:text-indigo-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
            aria-label="Cambiar tema"
          >
            <Icon name={mounted && resolvedTheme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:text-indigo-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
            aria-label="Ajustes"
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>

      {(demo || apiError) && (
        <div className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${apiError ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'}`}>
          <Icon name="bolt" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {apiError
              ? `No se pudo conectar con el servidor (${apiError}). Mostrando datos de ejemplo.`
              : 'Estás viendo datos de ejemplo. En cuanto tu ESP32 envíe lecturas, aparecerán aquí automáticamente.'}
          </p>
        </div>
      )}

      {!summary ? (
        <Skeleton />
      ) : (
        <div className="animate-fade-up space-y-5">
          {alertLevel && annual && (
            <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${annual.exceeded ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'}`}>
              <Icon name="bolt" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {annual.exceeded
                  ? `Has superado el límite anual con descuento (${fmt(annual.used, 0)} de ${fmt(annual.limit, 0)} kWh). El resto del periodo se calcula a precio sin descuento.`
                  : `Llevas el ${fmt(annual.pct, 0)} % de tu límite anual con descuento (${fmt(annual.used, 0)} de ${fmt(annual.limit, 0)} kWh).`}
              </p>
            </div>
          )}

          {humSuspect && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <Icon name="bolt" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Sensor de humedad posiblemente defectuoso: marca valores saturados (por encima del 95 %). Revísalo, sécalo o sustitúyelo; mientras tanto no se muestra la humedad.</p>
            </div>
          )}

          {/* Hero */}
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-xl shadow-indigo-600/25 sm:p-8">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
            <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
              <div className="relative mx-auto h-64 w-64 sm:h-72 sm:w-72">
                <PowerGauge value={cur?.power ?? 0} max={Math.max(summary.peakPower * 1.15, 500)} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-medium uppercase tracking-widest text-white/70">Ahora mismo</span>
                  <span className="mt-1 text-5xl font-bold tracking-tight sm:text-6xl">{fmt(cur?.power ?? 0, 0)}</span>
                  <span className="text-lg font-medium text-white/80">vatios</span>
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                    <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse-dot bg-emerald-300' : 'bg-amber-300'}`} />
                    {live ? 'En vivo' : cur ? `Sin señal · ${timeAgo(cur.timestamp, now)}` : 'Sin datos'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-white/70">Consumo de hoy</p>
                <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-1">
                  <p className="text-5xl font-bold tracking-tight sm:text-6xl">
                    {fmt(summary.todayKwh, 2)} <span className="text-2xl font-semibold text-white/80">kWh</span>
                  </p>
                  <p className="pb-1 text-3xl font-semibold text-white/90">{fmtEur(summary.todayCost)}</p>
                </div>
                <p className="mt-2 text-sm text-white/75">
                  Ayer: {fmt(summary.yesterdayKwh, 2)} kWh · {fmtEur(summary.yesterdayKwh * price)}
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Corriente', cur ? `${fmt(cur.irms, 2)} A` : '—'],
                    ['Pico del periodo', `${fmt(summary.peakPower, 0)} W`],
                    ['Temperatura', cur && isValidClimate(cur) ? `${fmt(cur.temperature, 1)} °C` : '—'],
                    ['Humedad', cur && isValidHumidity(cur) ? `${fmt(cur.humidity, 0)} %` : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm ring-1 ring-white/15">
                      <p className="text-xs text-white/70">{k}</p>
                      <p className="mt-0.5 text-lg font-semibold">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon="bolt" label={`Consumo · ${periodDef.label}`} value={fmt(summary.kwh, 1)} unit="kWh"
              tint="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              sub={<span className="flex items-center gap-2"><Delta pct={summary.deltaKwhPct} /> vs periodo anterior</span>}
            />
            <StatCard
              icon="euro" label="Coste estimado" value={fmtEur(summary.cost)}
              tint="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              sub={<>Previsión mensual: <b className="text-slate-700 dark:text-slate-200">{fmtEur(summary.monthProjectionCost)}</b></>}
            />
            <StatCard
              icon="gauge" label="Potencia media" value={fmt(summary.avgPower, 0)} unit="W"
              tint="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              sub={<>Consumo base: <b className="text-slate-700 dark:text-slate-200">{fmt(summary.standbyW, 0)} W</b></>}
            />
            <StatCard
              icon="leaf" label="Huella de CO₂" value={fmt(summary.co2, 2)} unit="kg"
              tint="bg-teal-500/10 text-teal-600 dark:text-teal-400"
              sub={<>≈ {fmt(summary.co2 / 0.055, 0)} días de un árbol absorbiendo</>}
            />
          </div>

          {/* Potencia + presupuesto */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Potencia en tiempo real" subtitle={`Evolución de la potencia · ${periodDef.label}`} />
              <div className="h-72"><PowerArea data={current} from={from} /></div>
            </Card>
            <Card>
              <CardHeader title="Presupuesto mensual" subtitle="Previsión según tu ritmo actual" />
              <BudgetRing pct={budgetPct} />
              <dl className="mt-4 space-y-2 text-sm">
                <Row k="Previsión del mes" v={fmtEur(summary.monthProjectionCost)} />
                <Row k="Presupuesto" v={fmtEur(settings.monthlyBudget)} />
                <Row k="Consumo previsto" v={`${fmt(summary.monthProjectionKwh, 0)} kWh`} />
                <Row k="Standby al año" v={fmtEur(summary.standbyYearCost)} />
              </dl>
            </Card>
          </div>

          {/* Tarifa: PVPC y bono social */}
          {(isPvpc || annual) && (
            <div className="grid gap-5 lg:grid-cols-3">
              {isPvpc && (
                <Card className={annual ? 'lg:col-span-2' : 'lg:col-span-3'}>
                  <CardHeader
                    title="Precio de la luz por horas (PVPC)"
                    subtitle={pvpcError ? `No se pudo cargar: ${pvpcError}` : 'Fuente: Red Eléctrica de España · €/kWh'}
                    right={
                      <div className="flex rounded-full bg-slate-100 p-1 text-xs font-medium dark:bg-white/10">
                        {(['today', 'tomorrow'] as const).map((d) => (
                          <button
                            key={d} disabled={d === 'tomorrow' && pvpcTomorrow.length < 20} onClick={() => setPvpcDay(d)}
                            className={`rounded-full px-3 py-1 transition disabled:opacity-40 ${pvpcDay === d ? 'bg-white shadow dark:bg-slate-700' : ''}`}
                          >
                            {d === 'today' ? 'Hoy' : 'Mañana'}
                          </button>
                        ))}
                      </div>
                    }
                  />
                  {shown.length ? (
                    <>
                      <div className="h-64"><PvpcChart points={shown} bands={bands} nowTs={now} discount={discountActive ? discountRate : 0} /></div>
                      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                        {(['gold', 'economic', 'forbidden'] as const).map((b) => (
                          <div key={b} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: BAND_COLORS[b] }} />
                              {BAND_LABELS[b]}
                            </div>
                            <div className="mt-0.5 font-semibold text-slate-900 dark:text-white">{bandRanges(shown, bands, b)}</div>
                          </div>
                        ))}
                      </div>
                      {nowPrice != null && pvpcDay === 'today' && (
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          Ahora: <b className="text-slate-900 dark:text-white">{fmt(nowPrice * (discountActive ? 1 - discountRate : 1), 4)} €/kWh</b>
                          {' · '}media de hoy {fmt((avgToday ?? 0) * (discountActive ? 1 - discountRate : 1), 4)} €/kWh
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-slate-400">{pvpcError ? 'Sin datos de precios' : 'Cargando precios…'}</div>
                  )}
                </Card>
              )}
              {annual && (
                <Card>
                  <CardHeader title="Límite anual con descuento" subtitle={`${DISCOUNT_LABELS[settings.discount]} · ${fmt(discountRate * 100, 1)} %`} />
                  <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                    {fmt(annual.used, 0)} <span className="text-base font-medium text-slate-400">/ {fmt(annual.limit, 0)} kWh</span>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${annual.pct >= 100 ? 'bg-rose-500' : annual.pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(annual.pct, 100)}%` }}
                    />
                  </div>
                  <dl className="mt-4 space-y-2 text-sm">
                    <Row k="Consumido" v={`${fmt(annual.pct, 1)} %`} />
                    <Row k="Te quedan" v={`${fmt(annual.remaining, 0)} kWh`} />
                    <Row k="Previsión anual" v={annual.projectedYear != null ? `${fmt(annual.projectedYear, 0)} kWh` : '—'} />
                    <Row
                      k="Límite estimado"
                      v={annual.exceeded ? 'Superado' : annual.projectedExceedDate ? new Date(annual.projectedExceedDate).toLocaleDateString('es-ES') : 'No lo alcanzarás'}
                    />
                  </dl>
                  <p className="mt-3 text-xs text-slate-400">
                    Desde {new Date(periodStartMs).toLocaleDateString('es-ES')}. Alertas {settings.alerts ? 'activadas' : 'desactivadas'}.
                  </p>
                </Card>
              )}
            </div>
          )}

          {/* Consumo + perfil horario */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title={daily ? 'Consumo por día' : 'Consumo por hora'} subtitle="Energía consumida (kWh) y su coste" />
              <div className="h-72"><ConsumptionBars buckets={buckets} daily={daily} price={price} /></div>
            </Card>
            <Card>
              <CardHeader
                title="Tu día típico"
                subtitle="Potencia media por hora del día"
                right={summary.peakHour !== null && (
                  <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Punta {String(summary.peakHour).padStart(2, '0')}:00
                  </span>
                )}
              />
              <div className="h-72"><HourlyBars hourly={summary.hourly} peakHour={summary.peakHour} /></div>
            </Card>
          </div>

          {/* Confort + consejos */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Confort del hogar"
                subtitle="Temperatura y humedad del sensor"
                right={climate && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TONE[climate.tone === 'bad' ? 'bad' : climate.tone]}`}>{climate.label}</span>}
              />
              <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Mini icon="thermo" label="Temperatura" value={cur && isValidClimate(cur) ? `${fmt(cur.temperature, 1)} °C` : '—'} tint="text-orange-500 bg-orange-500/10" />
                <Mini icon="drop" label="Humedad" value={cur && isValidHumidity(cur) ? `${fmt(cur.humidity, 0)} %` : '—'} tint="text-sky-500 bg-sky-500/10" />
                <Mini icon="thermo" label="Media periodo" value={summary.avgTemp !== null ? `${fmt(summary.avgTemp, 1)} °C` : '—'} tint="text-orange-500 bg-orange-500/10" />
                <Mini icon="drop" label="Media periodo" value={summary.avgHum !== null ? `${fmt(summary.avgHum, 0)} %` : '—'} tint="text-sky-500 bg-sky-500/10" />
              </div>
              <div className="h-60"><ClimateChart data={climateRows} from={from} /></div>
            </Card>
            <Card>
              <CardHeader title="Consejos para ti" subtitle="Generados con tus datos" />
              <ul className="space-y-3">
                {insights.length === 0 && <li className="text-sm text-slate-500">Aún no hay suficientes datos para generar consejos.</li>}
                {insights.map((i) => (
                  <li key={i.title} className="flex gap-3 rounded-2xl border border-slate-100 p-3.5 dark:border-white/5">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE[i.tone]}`}>
                      <Icon name={i.icon} className="h-[18px] w-[18px]" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{i.title}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-slate-500 dark:text-slate-400">{i.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      <footer className="mt-10 text-center text-xs text-slate-400">
        Voltio · Datos de tu ESP32 con sensor SCT-013 · Tarifa {fmt(price, 3)} €/kWh{discountActive ? ` (−${fmt(discountRate * 100, 1)} % ${DISCOUNT_LABELS[settings.discount].toLowerCase()})` : ''} · Tensión asumida 230 V
      </footer>

      <SettingsModal
        open={showSettings}
        settings={settings}
        onClose={() => setShowSettings(false)}
        onSave={saveSettings}
        onDelete={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className="font-semibold text-slate-900 dark:text-white">{v}</dd>
    </div>
  );
}

function Mini({ icon, label, value, tint }: { icon: 'thermo' | 'drop'; label: string; value: string; tint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 dark:border-white/5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}><Icon name={icon} className="h-[18px] w-[18px]" /></span>
      <div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-base font-semibold">{value}</p>
      </div>
    </div>
  );
}

function BudgetRing({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const shown = Math.min(pct, 100);
  const color = pct > 100 ? '#f43f5e' : pct > 80 ? '#f59e0b' : '#10b981';
  return (
    <div className="relative mx-auto h-40 w-40">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="11" className="text-slate-100 dark:text-white/10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * shown) / 100} style={{ transition: 'stroke-dashoffset .8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{Math.round(pct)}%</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{pct > 100 ? 'por encima' : 'del presupuesto'}</span>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="h-80 animate-pulse rounded-[2rem] bg-slate-200/70 dark:bg-white/5" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/5" />)}
      </div>
      <div className="h-80 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/5" />
    </div>
  );
}
