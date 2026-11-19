// Detección de cortes de luz a partir de las lecturas del ESP32 (envía una lectura por minuto).
// Sin suministro el ESP32 se apaga y deja de enviar, así que un corte aparece como un hueco sin lecturas.
// También se consideran sin suministro las lecturas con consumo, temperatura y humedad a 0 a la vez.

// Huecos más cortos que esto son microcortes de WiFi habituales (3–6 min), no cortes de luz.
export const OUTAGE_MIN_GAP_MS = 10 * 60_000;
// Lecturas a 0 consecutivas necesarias para contar un corte aunque no haya hueco.
const MIN_DEAD_SAMPLES = 2;

export interface OutageRow {
  timestamp: number;
  power: number;
  temperature: number;
  humidity: number;
  device_ip?: string | null;
}

export type OutageKind = 'gap' | 'zeros' | 'mixed';

export interface Outage {
  start: number; // última lectura válida antes del corte
  end: number | null; // primera lectura válida tras recuperarse (null = sigue sin luz)
  durationMs: number;
  kind: OutageKind;
  ipBefore: string | null;
  ipAfter: string | null;
}

export const isDeadReading = (r: OutageRow) => r.power === 0 && r.temperature === 0 && r.humidity === 0;

export function detectOutages(rows: OutageRow[], now = Date.now(), minGap = OUTAGE_MIN_GAP_MS): Outage[] {
  const out: Outage[] = [];
  let lastAlive: OutageRow | null = null;
  let deadStart: number | null = null; // inicio de una racha de lecturas a 0
  let deadCount = 0;
  let deadHadGap = false;
  let prevTs: number | null = null;

  for (const r of rows) {
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
