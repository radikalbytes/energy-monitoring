export interface EnergyData {
    id?: number;
    uuid: string;
    irms: number;
    power: number;
    temperature: number;
    humidity: number;
    timestamp: number;
    device_ip?: string | null;
  }