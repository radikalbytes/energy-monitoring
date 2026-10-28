import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { kwhBetween } from '../../lib/energy';
import type { EnergyData } from '../../types/energyData';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string;

const PAGE = 1000;
const MAX_ROWS = 130000;

// Consumo acumulado (kWh) desde `since` hasta ahora, para controlar el límite anual del bono social.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { uuid, since } = req.query;
  const sinceMs = Number(since);
  if (typeof uuid !== 'string' || !Number.isFinite(sinceMs) || sinceMs <= 0) {
    return res.status(400).json({ error: 'uuid and since are required' });
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const query = () =>
      supabase
        .from('energy_data')
        .select('timestamp,power', { count: 'exact' })
        .eq('uuid', uuid)
        .gte('timestamp', sinceMs)
        .order('timestamp', { ascending: true });

    const first = await query().range(0, PAGE - 1);
    if (first.error) throw first.error;
    const total = Math.min(first.count ?? first.data.length, MAX_ROWS);
    const rows: Pick<EnergyData, 'timestamp' | 'power'>[] = [...first.data];

    const offsets: number[] = [];
    for (let o = PAGE; o < total; o += PAGE) offsets.push(o);
    for (let i = 0; i < offsets.length; i += 10) {
      const batch = await Promise.all(offsets.slice(i, i + 10).map((o) => query().range(o, o + PAGE - 1)));
      for (const b of batch) {
        if (b.error) throw b.error;
        rows.push(...b.data);
      }
    }

    const kwh = kwhBetween(rows as EnergyData[], sinceMs, Date.now() + 1);
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({ kwh, rows: rows.length, truncated: (first.count ?? 0) > MAX_ROWS });
  } catch (e) {
    const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Unknown error';
    return res.status(500).json({ error: `Internal server error: ${message}` });
  }
}
