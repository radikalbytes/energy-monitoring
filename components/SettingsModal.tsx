import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, Settings } from '../lib/energy';
import { Icon } from './ui';

const KEY = 'energy-settings-v1';

export function useSettings(): [Settings, (s: Settings) => void] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      /* valores por defecto */
    }
  }, []);
  const save = (s: Settings) => {
    setSettings(s);
    localStorage.setItem(KEY, JSON.stringify(s));
  };
  return [settings, save];
}

function Field({ label, hint, value, onChange, step, suffix }: {
  label: string; hint: string; value: number; onChange: (v: number) => void; step: number; suffix: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <div className="relative mt-1.5">
        <input
          type="number"
          min={0}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-20 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-slate-800 dark:text-white"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-slate-400">{suffix}</span>
      </div>
      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
    </label>
  );
}

export default function SettingsModal({
  open, settings, onClose, onSave, onDelete, deleting,
}: {
  open: boolean; settings: Settings; onClose: () => void; onSave: (s: Settings) => void; onDelete: () => void; deleting: boolean;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings, open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tu tarifa y objetivos</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        <div className="space-y-4">
          <Field label="Precio de la electricidad" hint="Término de energía medio, impuestos incluidos." value={draft.price} step={0.01} suffix="€/kWh" onChange={(price) => setDraft({ ...draft, price })} />
          <Field label="Presupuesto mensual" hint="Te avisamos si la previsión lo supera." value={draft.monthlyBudget} step={5} suffix="€/mes" onChange={(monthlyBudget) => setDraft({ ...draft, monthlyBudget })} />
          <Field label="Emisiones de la red" hint="Mix eléctrico peninsular español ≈ 0,15 kg CO₂/kWh." value={draft.co2Factor} step={0.01} suffix="kg/kWh" onChange={(co2Factor) => setDraft({ ...draft, co2Factor })} />
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
            Cancelar
          </button>
          <button
            onClick={() => { onSave(draft); onClose(); }}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500"
          >
            Guardar
          </button>
        </div>
        <div className="mt-6 border-t border-slate-100 pt-4 dark:border-white/10">
          <button onClick={onDelete} disabled={deleting} className="flex items-center gap-2 text-sm font-medium text-rose-600 hover:text-rose-500 disabled:opacity-50 dark:text-rose-400">
            <Icon name="trash" className="h-4 w-4" />
            {deleting ? 'Borrando…' : 'Borrar todos los datos (admin)'}
          </button>
        </div>
      </div>
    </div>
  );
}
