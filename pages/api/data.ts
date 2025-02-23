import type { NextApiRequest, NextApiResponse } from 'next';
import { saveEnergyData, getEnergyData, getDevices } from '../../lib/db';
import { EnergyData } from '../../types/energyData';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    console.log('Cuerpo recibido:', req.body); // Imprime el cuerpo crudo
    const data: EnergyData = req.body;

    if (!data.uuid || !data.irms || !data.power || !data.temperature || !data.humidity) {
      console.log('Campos faltantes en:', data);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      saveEnergyData(data);
      res.status(201).json({ message: 'Data saved successfully' });
    } catch (error) {
      console.error('Error al guardar datos:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'GET') {
    const { uuid, timeRange } = req.query;
    try {
      const energyData = getEnergyData(
        typeof uuid === 'string' ? uuid : undefined,
        typeof timeRange === 'string' ? parseInt(timeRange) : undefined
      );
      const devices = getDevices();
      res.status(200).json({ energyData, devices });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}