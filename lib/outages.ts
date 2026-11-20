// Detección de cortes de luz a partir de las lecturas del ESP32 (envía una lectura por minuto).
// Sin suministro el ESP32 se apaga y deja de enviar, así que un corte aparece como un hueco sin lecturas.
// También se consideran sin suministro las lecturas con consumo, temperatura y humedad a 0 a la vez.

// Un hueco sin lecturas de al menos esto se registra como corte de luz.
export const OUTAGE_MIN_GAP_MS = 10 * 60_000;

// Microcortes: el ESP32 envía con cadencia fija (cada ~60 s medidos con su reloj interno), así que todas sus
// lecturas caen en una rejilla de "fase" estable; la latencia de red solo retrasa alguna lectura suelta 1–4 s.
// Al reiniciarse (corte o bajada de tensión que lo apaga) la rejilla vuelve a empezar desde el arranque y la
// fase cambia. Si tras un hueco las lecturas siguen en la misma fase, el ESP32 siguió encendido (fallo de WiFi
// o de Internet); si cambia, se reinició. Así se detecta un microcorte aunque no se pierda ninguna lectura.
// Un cambio de fase menor que esto se confunde con la latencia; un reinicio cae dentro por azar ~8 % de las veces.
const PHASE_SHIFT_MS = 2500;
// Lecturas con un retraso menor que esto respecto a la rejilla se usan para reajustarla.
const PHASE_ANCHOR_MS = 500;
// Lecturas seguidas en la nueva fase necesarias para confirmar un reinicio (descarta retrasos sueltos).
const PHASE_CONFIRM = 3;
// En huecos más largos el error acumulado del periodo impide saber si hubo reinicio.
const PHASE_MAX_GAP_MS = 3600_000;
// Lecturas a 0 consecutivas necesarias para contar un corte aunque no haya hueco.
const MIN_DEAD_SAMPLES = 2;

export interface OutageRow {
  timestamp: number;
  power: number;
  temperature: number;
  humidity: number;
  device_ip?: string | null;
}

// gap/zeros/mixed: corte de luz (≥ OUTAGE_MIN_GAP_MS); micro: reinicio del ESP32 con un hueco más corto.
export type OutageKind = 'gap' | 'zeros' | 'mixed' | 'micro';

export interface Outage {
  start: number; // última lectura válida antes del corte
  end: number | null; // primera lectura válida tras recuperarse (null = sigue sin luz)
  durationMs: number;
  kind: OutageKind;
  ipBefore: string | null;
  ipAfter: string | null;
  // ¿Se reinició el ESP32? true/false según la fase de envío; null si no se puede saber.
  rebooted?: boolean | null;
  missed?: number; // lecturas que faltan
  before?: OutageContext | null; // qué pasaba justo antes (para buscar la causa de un disparo)
}

// Situación en los minutos previos a un corte o microcorte.
export interface OutageContext {
  lastPower: number; // W en la última lectura antes del corte
  peak5m: number; // W máximos en los 5 min previos
  base: number | null; // W habituales entre 15 y 5 min antes (mediana)
  jump: boolean; // hubo un salto brusco de consumo justo antes
  temperature: number | null;
  humidity: number | null;
}

const CONTEXT_PEAK_MS = 5 * 60_000;
const CONTEXT_BASE_MS = 15 * 60_000;
// Salto de consumo: al menos esto por encima de lo habitual y un 50 % más.
const JUMP_MIN_W = 500;

const median = (v: number[]) => {
  const a = [...v].sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : NaN;
};

// Periodo de envío del dispositivo (mediana de los intervalos normales); null si no hay datos suficientes.
export function sendPeriod(rows: { timestamp: number }[]): number | null {
  const iv: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i].timestamp - rows[i - 1].timestamp;
    if (d > 45_000 && d < 75_000) iv.push(d);
  }
  return iv.length >= 10 ? median(iv) : null;
}

// Desfase de `t` respecto a la rejilla `ref + k·period`, en [-period/2, period/2).
const phaseOffset = (t: number, ref: number, period: number) => {
  const m = (((t - ref) % period) + period) % period;
  return m >= period / 2 ? m - period : m;
};

// Para cada lectura: true si llega tras un reinicio del ESP32 (cambio de fase confirmado), false si sigue en
// la misma fase y null si no se puede saber (sin periodo fiable o tras un hueco demasiado largo).
export function rebootFlags(rows: { timestamp: number }[], period = sendPeriod(rows)): (boolean | null)[] {
  const flags: (boolean | null)[] = rows.map(() => null);
  if (!period || !rows.length) return flags;
  let ref = rows[0].timestamp; // última lectura "limpia" (sin retraso) de la rejilla actual
  for (let i = 1; i < rows.length; i++) {
    const t = rows[i].timestamp;
    if (t - ref > PHASE_MAX_GAP_MS) { ref = t; continue; } // se pierde la referencia
    const off = phaseOffset(t, ref, period);
    if (Math.abs(off) < PHASE_SHIFT_MS) {
      flags[i] = false;
      if (off < PHASE_ANCHOR_MS) ref = t; // reajuste con lecturas sin retraso (también absorbe la deriva)
      continue;
    }
    // Posible reinicio: las siguientes lecturas deben seguir fuera de la fase antigua y en la nueva.
    const next = rows.slice(i, i + PHASE_CONFIRM).map((r) => r.timestamp);
    const confirmed = next.length === PHASE_CONFIRM
      && next.every((n) => Math.abs(phaseOffset(n, ref, period)) >= PHASE_SHIFT_MS && Math.abs(phaseOffset(n, t, period)) < PHASE_SHIFT_MS);
    if (confirmed) {
      flags[i] = true;
      ref = t;
    } else if (next.length < PHASE_CONFIRM) {
      flags[i] = null; // últimas lecturas: aún no se puede confirmar
    } else {
      flags[i] = false; // retraso suelto
    }
  }
  return flags;
}

export const isDeadReading = (r: OutageRow) => r.power === 0 && r.temperature === 0 && r.humidity === 0;

export function detectOutages(rows: OutageRow[], now = Date.now(), minGap = OUTAGE_MIN_GAP_MS): Outage[] {
  const out: Outage[] = [];
  const period = sendPeriod(rows);
  const flags = rebootFlags(rows, period);
  const missedBetween = (a: number, b: number) => (period ? Math.max(0, Math.round((b - a) / period) - 1) : 0);
  let lastAlive: OutageRow | null = null;
  let deadStart: number | null = null; // inicio de una racha de lecturas a 0
  let deadCount = 0;
  let deadHadGap = false;
  let prevTs: number | null = null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const gap = prevTs != null && r.timestamp - prevTs >= minGap;
    prevTs = r.timestamp;

    if (isDeadReading(r)) {
      if (deadStart == null) {
        deadStart = lastAlive?.timestamp ?? r.timestamp;
        deadCount = 0;
        deadHadGap = false;
      }
      deadCount++;
      deadHadGap ||= gap;
      continue;
    }

    if (deadStart != null) {
      if (deadCount >= MIN_DEAD_SAMPLES || deadHadGap || gap) {
        out.push({
          start: deadStart,
          end: r.timestamp,
          durationMs: r.timestamp - deadStart,
          kind: deadHadGap || gap ? 'mixed' : 'zeros',
          ipBefore: lastAlive?.device_ip ?? null,
          ipAfter: r.device_ip ?? null,
          rebooted: flags[i],
          missed: missedBetween(deadStart, r.timestamp),
        });
      }
      deadStart = null;
    } else if (lastAlive && r.timestamp - lastAlive.timestamp >= minGap) {
      out.push({
        start: lastAlive.timestamp,
        end: r.timestamp,
        durationMs: r.timestamp - lastAlive.timestamp,
        kind: 'gap',
        ipBefore: lastAlive.device_ip ?? null,
        ipAfter: r.device_ip ?? null,
        rebooted: flags[i],
        missed: missedBetween(lastAlive.timestamp, r.timestamp),
      });
    } else if (lastAlive && flags[i] === true) {
      // Reinicio del ESP32 sin un hueco largo: microcorte (o bajada de tensión) entre ambas lecturas.
      out.push({
        start: lastAlive.timestamp,
        end: r.timestamp,
        durationMs: r.timestamp - lastAlive.timestamp,
        kind: 'micro',
        ipBefore: lastAlive.device_ip ?? null,
        ipAfter: r.device_ip ?? null,
        rebooted: true,
        missed: missedBetween(lastAlive.timestamp, r.timestamp),
      });
    }
    lastAlive = r;
  }

  // Corte en curso: solo lecturas a 0 desde hace rato, o ninguna lectura reciente.
  const last = rows[rows.length - 1];
  if (deadStart != null && (deadCount >= MIN_DEAD_SAMPLES || now - deadStart >= minGap)) {
    out.push({ start: deadStart, end: null, durationMs: now - deadStart, kind: 'zeros', ipBefore: lastAlive?.device_ip ?? null, ipAfter: null });
  } else if (deadStart == null && last && now - last.timestamp >= minGap) {
    out.push({ start: last.timestamp, end: null, durationMs: now - last.timestamp, kind: 'gap', ipBefore: last.device_ip ?? null, ipAfter: null });
  }
  return out;
}

// Tipo de evento para mostrarlo: corte de luz, microcorte (reinicio corto) o fallo de conexión (el ESP32 siguió
// encendido durante el hueco, así que no hubo corte de luz).
export type OutageCategory = 'cut' | 'micro' | 'network';
export const outageCategory = (o: Pick<Outage, 'kind' | 'rebooted'>): OutageCategory =>
  o.kind === 'micro' ? 'micro' : o.kind === 'gap' && o.rebooted === false ? 'network' : 'cut';

// Busca la última lectura con timestamp <= ts (las filas están ordenadas).
function lastIndexAtOrBefore(rows: { timestamp: number }[], ts: number): number {
  let lo = 0, hi = rows.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].timestamp <= ts) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

// Consumo, temperatura y humedad justo antes de `start` (inicio de un corte).
export function outageContext(rows: OutageRow[], start: number): OutageContext | null {
  const end = lastIndexAtOrBefore(rows, start);
  if (end < 0) return null;
  const alive: OutageRow[] = [];
  for (let i = end; i >= 0 && rows[i].timestamp > start - CONTEXT_BASE_MS; i--) if (!isDeadReading(rows[i])) alive.push(rows[i]);
  if (!alive.length) return null;
  const recent = alive.filter((r) => r.timestamp > start - CONTEXT_PEAK_MS).map((r) => r.power);
  const older = alive.filter((r) => r.timestamp <= start - CONTEXT_PEAK_MS).map((r) => r.power);
  const peak5m = recent.length ? Math.max(...recent) : alive[0].power;
  const base = older.length ? median(older) : null;
  const climate = alive.find((r) => !(r.temperature === 0 && r.humidity === 0));
  return {
    lastPower: Math.round(alive[0].power),
    peak5m: Math.round(peak5m),
    base: base == null ? null : Math.round(base),
    jump: base != null && peak5m - base >= JUMP_MIN_W && peak5m >= base * 1.5,
    temperature: climate ? climate.temperature : null,
    humidity: climate && climate.humidity > 0 && climate.humidity <= 95 ? climate.humidity : null,
  };
}
