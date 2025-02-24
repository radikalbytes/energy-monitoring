import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { EnergyData } from '../../types/energyData';

// Validar variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Método recibido:', req.method); // Log para verificar el método

  if (req.method === 'POST') {
    console.log('Cuerpo recibido en POST:', req.body); // Log del cuerpo crudo

    const data: EnergyData = req.body;

    // Validación de campos requeridos
    if (!data.uuid || !data.irms || !data.power || !data.temperature || !data.humidity) {
      console.log('Campos faltantes en:', data);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      console.log('Intentando insertar en Supabase:', data); // Log antes de la inserción
      const { error } = await supabase
        .from('energy_data')
        .insert({
          uuid: data.uuid,
          irms: data.irms,
          power: data.power,
          temperature: data.temperature,
          humidity: data.humidity,
          timestamp: new Date().toISOString(),
        });

      if (error) {
        console.error('Error de Supabase:', error); // Log específico del error de Supabase
        throw error;
      }

      console.log('Datos insertados con éxito');
      return res.status(201).json({ message: 'Data saved successfully' });
    } catch (error) {
      console.error('Error al guardar datos:', error); // Log detallado
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
        const timeRangeMs = parseInt(timeRange);
        const startTime = new Date(Date.now() - timeRangeMs).toISOString();
        energyQuery = energyQuery.gte('timestamp', startTime);
      }

      const { data: energyData, error: energyError } = await energyQuery;
      if (energyError) throw energyError;

      const { data: devices, error: devicesError } = await supabase
        .from('devices')
        .select('*');
      if (devicesError) throw devicesError;

      return res.status(200).json({ energyData, devices });
    } catch (error) {
      console.error('Error al obtener datos:', error);
      return res.status(500).json({
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  } else {
    console.log('Método no permitido:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }
}