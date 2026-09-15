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
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  } else if (req.method === 'GET') {
    const { uuid, timeRange } = req.query;

    try {
      let energyQuery = supabase
        .from('energy_data')
        .select('*')
        .order('timestamp', { ascending: true });

      if (typeof uuid === 'string') {
        energyQuery = energyQuery.eq('uuid', uuid);
      }
      if (typeof timeRange === 'string') {
        const timeRangeMs = Number(timeRange);
        if (Number.isFinite(timeRangeMs) && timeRangeMs > 0) {
          energyQuery = energyQuery.gte('timestamp', Date.now() - timeRangeMs);
        }
      }

      const { data: energyData, error: energyError } = await energyQuery;
      if (energyError) throw energyError;

      const { data: deviceRows, error: devicesError } = await supabase
        .from('energy_data')
        .select('uuid');
      if (devicesError) throw devicesError;

      const devices = [...new Set(deviceRows.map(({ uuid }) => uuid))];

      return res.status(200).json({ energyData, devices });
    } catch (error) {
      console.error('Error al obtener datos:', error);
      return res.status(500).json({
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      console.log('Solicitud para borrar datos recibida');
      const { error } = await supabase
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
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  } else {
    console.log('Método no permitido:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }
}