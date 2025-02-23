interface DeviceSelectorProps {
    devices: string[];
    selectedDevice: string | null;
    onSelect: (uuid: string | null) => void;
  }
  
  export default function DeviceSelector({ devices, selectedDevice, onSelect }: DeviceSelectorProps) {
    return (
      <select
        className="p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
        value={selectedDevice || ''}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">Todos los dispositivos</option>
        {devices.map(uuid => (
          <option key={uuid} value={uuid}>{uuid}</option>
        ))}
      </select>
    );
  }