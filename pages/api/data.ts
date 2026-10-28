import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { EnergyData } from '../../types/energyData';

// Validar variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be defined');
}

const supabase = createClient(supabaseUrl, supabaseKey);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
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

    try {
      const PAGE = 1000;
      const MAX_ROWS = 60000;
      const buildQuery = () => {
        let q = supabase.from('energy_data').select('*', { count: 'exact' });
        if (typeof uuid === 'string') q = q.eq('uuid', uuid);
        if (typeof timeRange === 'string') {
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
      const energyData = [...first.data];

      const pages: number[] = [];
      for (let from = PAGE; from < total; from += PAGE) pages.push(from);
      const rest = await Promise.all(pages.map((from) => buildQuery().range(from, from + PAGE - 1)));
      for (const page of rest) {
        if (page.error) throw page.error;
        energyData.push(...page.data);
      }

      const { data: deviceRows, error: devicesError } = await supabase
        .from('energy_data')
        .select('uuid')
        .order('timestamp', { ascending: false })
        .limit(1000);
      if (devicesError) throw devicesError;

      const devices = [...new Set(deviceRows.map(({ uuid }) => uuid))];

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ energyData, devices });
    } catch (error) {
      console.error('Error al obtener datos:', error);
      return res.status(500).json({
        error: `Internal server error: ${errorMessage(error)}`,
      });
    }
  } else if (req.method === 'DELETE') {
    const adminToken = process.env.ADMIN_DELETE_TOKEN;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!adminToken || !serviceKey || req.headers['x-admin-token'] !== adminToken) {
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