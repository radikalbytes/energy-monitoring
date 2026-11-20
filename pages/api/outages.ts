import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { OUTAGE_MIN_GAP_MS, OutageRow, detectOutages, outageCategory, outageContext } from '../../lib/outages';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string;

const PAGE = 1000;
const MAX_DAYS = 90;
const MAX_ROWS = 135000; // 90 días a una lectura por minuto

// Registro de cortes de luz de un dispositivo en los últimos `days` días (máx. 90),
// o solo los que tocan el intervalo ?from=&to= (ms, máx. 31 días) para marcarlos en las gráficas.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { uuid } = req.query;
  const days = Math.min(Math.max(Number(req.query.days) || MAX_DAYS, 1), MAX_DAYS);
  if (typeof uuid !== 'string' || !uuid) return res.status(400).json({ error: 'uuid is required' });

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const fromMs = Number(req.query.from);
    const toMs = Number(req.query.to);
    const ranged = Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs > 0 && toMs > fromMs;
    if (ranged && toMs - fromMs > 31 * 86400_000) return res.status(400).json({ error: 'Intervalo máximo: 31 días' });
    const now = ranged ? Math.min(Date.now(), toMs) : Date.now();
    // Con intervalo se lee un día antes para detectar cortes que empezaron antes de `from`.
    const since = ranged ? fromMs - 86400_000 : now - days * 86400_000;
    const query = () =>
      supabase
        .from('energy_data')
        .select('timestamp,power,temperature,humidity,device_ip', { count: 'exact' })
        .eq('uuid', uuid)
        .gte('timestamp', since)
        .lte('timestamp', ranged ? toMs : now + 60_000)
        .order('timestamp', { ascending: true });

    const first = await query().range(0, PAGE - 1);
    if (first.error) throw first.error;
    const total = Math.min(first.count ?? first.data.length, MAX_ROWS);
    const rows: OutageRow[] = [...first.data];

    const offsets: number[] = [];
    for (let o = PAGE; o < total; o += PAGE) offsets.push(o);
    for (let i = 0; i < offsets.length; i += 10) {
      const batch = await Promise.all(offsets.slice(i, i + 10).map((o) => query().range(o, o + PAGE - 1)));
      for (const b of batch) {
        if (b.error) throw b.error;
        rows.push(...b.data);
      }
    }

    let outages = detectOutages(rows, now).reverse(); // más recientes primero
    // Qué se consumía justo antes de cada corte o microcorte (no en los fallos de conexión).
    outages = outages.map((o) => (outageCategory(o) === 'network' ? o : { ...o, before: outageContext(rows, o.start) }));
    if (ranged) outages = outages.filter((o) => o.start < toMs && (o.end ?? now) > fromMs);
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      outages,
      since: rows[0]?.timestamp ?? since,
      days,
      minGapMs: OUTAGE_MIN_GAP_MS,
      generatedAt: now,
    });
  } catch (e) {
    const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Unknown error';
    return res.status(500).json({ error: `Internal server error: ${message}` });
  }
}
