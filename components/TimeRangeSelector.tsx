interface TimeRangeSelectorProps {
    onSelect: (range: number) => void;
  }
  
  export default function TimeRangeSelector({ onSelect }: TimeRangeSelectorProps) {
    const ranges = {
      'Última hora': 3600000,
      'Últimas 24h': 86400000,
      'Última semana': 604800000,
      'Último mes': 2592000000,
      'Último año': 31536000000, // 365 días en milisegundos
    };
  
    return (
      <select
        className="p-2 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
        onChange={(e) => onSelect(Number(e.target.value))}
      >
        {Object.entries(ranges).map(([label, value]) => (
          <option key={label} value={value}>
            {label}
          </option>
        ))}
      </select>
    );
  }