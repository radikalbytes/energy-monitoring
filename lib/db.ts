import Database from 'better-sqlite3';
import { EnergyData } from '../types/energyData';

const db = new Database('energy.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS energy_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL,
    irms REAL NOT NULL,
    power REAL NOT NULL,
    temperature REAL NOT NULL,
    humidity REAL NOT NULL,
    timestamp INTEGER NOT NULL
  )
`);

export function saveEnergyData(data: EnergyData) {
  const stmt = db.prepare(`
    INSERT INTO energy_data (uuid, irms, power, temperature, humidity, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(data.uuid, data.irms, data.power, data.temperature, data.humidity, Date.now());
}

export function getEnergyData(uuid?: string, timeRange?: number): EnergyData[] { // Tipamos también aquí
  const now = Date.now();
  const query = `
    SELECT * FROM energy_data
    WHERE ${uuid ? 'uuid = ? AND ' : ''}timestamp > ?
    ORDER BY timestamp ASC
  `;
  const stmt = db.prepare(query);
  return (uuid ? stmt.all(uuid, now - (timeRange || 3600000)) : stmt.all(now - (timeRange || 3600000))) as EnergyData[];
}

export function getDevices(): string[] {
  const stmt = db.prepare('SELECT DISTINCT uuid FROM energy_data');
  return (stmt.all() as { uuid: string }[]).map(row => row.uuid);
}