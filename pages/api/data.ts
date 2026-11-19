import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import { createClient } from '@supabase/supabase-js';
import { EnergyData } from '../../types/energyData';

// Validar variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be defined');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const digest = (v: string) => createHash('sha256').update(v).digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}

// Máximo de lecturas devueltas (~150 bytes cada una) para no superar el límite de respuesta de Vercel.
const MAX_RETURNED_ROWS = 22000;

const stepFor = (rows: EnergyData[]) => {
  if (rows.length < 2) return 60_000;
  const span = rows[rows.length - 1].timestamp - rows[0].timestamp;
  return Math.max(60_000, Math.ceil(span / MAX_RETURNED_ROWS / 60_000) * 60_000);
};

// Promedia las lecturas en bloques de `stepFor` minutos. Cada bloque conserva la hora de su primera
// lectura, así que los huecos sin datos siguen apareciendo como huecos. La temperatura y la humedad
// solo promedian lecturas válidas (0 = sin dato).
function downsampleRows(rows: EnergyData[], max: number): EnergyData[] {
  if (rows.length <= max) return rows;
  const step = stepFor(rows);
  const out: EnergyData[] = [];
  let i = 0;
  while (i < rows.length) {
    const key = Math.floor(rows[i].timestamp / step);
    let j = i;
    let p = 0, a = 0, t = 0, h = 0, nc = 0, nh = 0;
    while (j < rows.length && Math.floor(rows[j].timestamp / step) === key) {
      const r = rows[j];
      p += r.power;
      a += r.irms;
      if (!(r.temperature === 0 && r.humidity === 0)) { t += r.temperature; nc++; }
      if (r.humidity > 0) { h += r.humidity; nh++; }
      j++;
    }
    const n = j - i;
    const last = rows[j - 1];
    out.push({
      ...last,
      timestamp: rows[i].timestamp,
      power: Math.round((p / n) * 100) / 100,
      irms: Math.round((a / n) * 100) / 100,
      temperature: nc ? Math.round((t / nc) * 10) / 10 : 0,
      humidity: nh ? Math.round((h / nh) * 10) / 10 : 0,
    });
    i = j;
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Método recibido:', req.method);

  if (req.method === 'POST') {
    console.log('Cuerpo recibido en POST:', req.body);
    const data: EnergyData = req.body;

    if (!data.uuid || data.irms == null || data.power == null || data.temperature == null || data.humidity == null) {
      console.log('Campos faltantes en:', data);
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (data.device_ip != null && (typeof data.device_ip !== 'string' || isIP(data.device_ip) !== 4)) {
      return res.status(400).json({ error: 'Invalid device IPv4 address' });
    }

    try {
      console.log('Intentando insertar en Supabase:', data);
      const { error } = await supabase
        .from('energy_data')
        .insert({
          uuid: data.uuid,
          irms: data.irms,
          power: data.power,
          temperature: data.temperature,
          humidity: data.humidity,
          timestamp: Date.now(),
          ...(data.device_ip != null ? { device_ip: data.device_ip } : {}),
        });

      if (error) {
        console.error('Error de Supabase:', error);
        throw error;
      }

      console.log('Datos insertados con éxito');
      return res.status(201).json({ message: 'Data saved successfully' });
    } catch (error) {
      console.error('Error al guardar datos:', error);
      return res.status(500).json({
        error: `Internal server error: ${errorMessage(error)}`,
      });
    }
  } else if (req.method === 'GET') {
    const { uuid, timeRange } = req.query;
    // Intervalo absoluto opcional (ms desde epoch); tiene prioridad sobre timeRange.
    const fromMs = Number(req.query.from);
    const toMs = Number(req.query.to);
    const hasFrom = Number.isFinite(fromMs) && fromMs > 0;
    const hasTo = Number.isFinite(toMs) && toMs > 0;

    try {
      const PAGE = 1000;
      const MAX_ROWS = 100000; // ~69 días a una lectura por minuto
      const buildQuery = () => {
        let q = supabase.from('energy_data').select('*', { count: 'exact' });
        if (typeof uuid === 'string') q = q.eq('uuid', uuid);
        if (hasFrom) q = q.gte('timestamp', fromMs);
        if (hasTo) q = q.lte('timestamp', toMs);
        if (!hasFrom && typeof timeRange === 'string') {
          const timeRangeMs = Number(timeRange);
          if (Number.isFinite(timeRangeMs) && timeRangeMs > 0) {
            q = q.gte('timestamp', Date.now() - timeRangeMs);
          }
        }
        return q.order('timestamp', { ascending: true });
      };

      const first = await buildQuery().range(0, PAGE - 1);
      if (first.error) throw first.error;
      const total = Math.min(first.count ?? first.data.length, MAX_ROWS);
      const raw: EnergyData[] = [...first.data];

      const pages: number[] = [];
      for (let from = PAGE; from < total; from += PAGE) pages.push(from);
      for (let i = 0; i < pages.length; i += 10) {
        const batch = await Promise.all(pages.slice(i, i + 10).map((from) => buildQuery().range(from, from + PAGE - 1)));
        for (const page of batch) {
          if (page.error) throw page.error;
          raw.push(...page.data);
        }
      }

      // Vercel limita la respuesta a 4,5 MB: los periodos largos se promedian en bloques de varios minutos.
      const energyData = downsampleRows(raw, MAX_RETURNED_ROWS);

      const { data: deviceRows, error: devicesError } = await supabase
        .from('energy_data')
        .select('uuid')
        .order('timestamp', { ascending: false })
        .limit(1000);
      if (devicesError) throw devicesError;

      const devices = [...new Set(deviceRows.map(({ uuid }) => uuid))];

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ energyData, devices, stepMs: energyData === raw ? null : stepFor(raw) });
    } catch (error) {
      console.error('Error al obtener datos:', error);
      return res.status(500).json({
        error: `Internal server error: ${errorMessage(error)}`,
      });
    }
  } else if (req.method === 'DELETE') {
    const adminUser = process.env.ADMIN_USER;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const user = String(req.headers['x-admin-user'] ?? '');
    const password = String(req.headers['x-admin-password'] ?? '');
    const valid = !!adminUser && !!adminPassword && safeEqual(user, adminUser) && safeEqual(password, adminPassword);
    if (!valid || !serviceKey) {
      // Retardo para frenar la fuerza bruta
      await new Promise((r) => setTimeout(r, 1500));
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      console.log('Solicitud para borrar datos recibida');
      const adminClient = createClient(supabaseUrl as string, serviceKey);
      const { error } = await adminClient
        .from('energy_data')
        .delete()
        .neq('id', 0); // Borrar todos los registros (neq evita errores si la tabla está vacía)

      if (error) {
        console.error('Error al borrar datos:', error);
        throw error;
      }

      console.log('Datos borrados con éxito');
      return res.status(200).json({ message: 'All energy data deleted successfully' });
    } catch (error) {
      console.error('Error al borrar datos:', error);
      return res.status(500).json({
        error: `Internal server error: ${errorMessage(error)}`,
      });
    }
  } else {
    console.log('Método no permitido:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }
}