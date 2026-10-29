import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, Settings } from '../lib/energy';
import { Icon } from './ui';
import {
  COMERCIALIZADORAS, DISCOUNT_LABELS, DiscountKey, HOUSEHOLD_LABELS, HouseholdKey,
} from '../lib/tariffs';

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

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-slate-800 dark:text-white';

function Section({ title }: { title: string }) {
  return <h3 className="pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>;
}

export default function SettingsModal({
  open, settings, onClose, onSave, onDelete, deleting,
}: {
  open: boolean; settings: Settings; onClose: () => void; onSave: (s: Settings) => void; onDelete: (user: string, password: string) => Promise<string | null>; deleting: boolean;
}) {
  const [draft, setDraft] = useState(settings);
  const [confirming, setConfirming] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [delError, setDelError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(settings);
    setConfirming(false);
    setAdminPass('');
    setDelError(null);
  }, [settings, open]);
  if (!open) return null;
  const pvpc = !!COMERCIALIZADORAS.find((c) => c.id === draft.comercializadora)?.pvpc;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tu tarifa y objetivos</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        <div className="space-y-4">
          <Section title="Comercializadora" />
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tu comercializadora</span>
            <select className={`${INPUT} mt-1.5`} value={draft.comercializadora} onChange={(e) => setDraft({ ...draft, comercializadora: e.target.value })}>
              {COMERCIALIZADORAS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              {pvpc
                ? 'Precio PVPC: se descarga cada día de Red Eléctrica (REE) con los precios de cada hora.'
                : 'Mercado libre: indica tu precio medio, no hay una fuente pública común para descargarlo.'}
            </span>
          </label>
          {!pvpc && (
            <Field label="Precio de la electricidad" hint="Término de energía, impuestos incluidos." value={draft.price} step={0.01} suffix="€/kWh" onChange={(price) => setDraft({ ...draft, price })} />
          )}
          <Section title="Descuento social (bono social)" />
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tipo de consumidor</span>
            <select className={`${INPUT} mt-1.5`} value={draft.discount} onChange={(e) => setDraft({ ...draft, discount: e.target.value as DiscountKey })}>
              {(Object.keys(DISCOUNT_LABELS) as DiscountKey[]).map((k) => (
                <option key={k} value={k}>
                  {DISCOUNT_LABELS[k]}{k !== 'none' ? ` (${draft.discountRates[k]} %)` : ''}
                </option>
              ))}
            </select>
          </label>
          {draft.discount !== 'none' && (
            <>
              <Field
                label={`Descuento · ${DISCOUNT_LABELS[draft.discount]}`} hint="Si el porcentaje oficial cambia, modifícalo aquí."
                value={draft.discountRates[draft.discount]} step={0.5} suffix="%"
                onChange={(v) => setDraft({ ...draft, discountRates: { ...draft.discountRates, [draft.discount]: Math.min(v, 100) } })}
              />
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tipo de hogar</span>
                <select className={`${INPUT} mt-1.5`} value={draft.household} onChange={(e) => setDraft({ ...draft, household: e.target.value as HouseholdKey })}>
                  {(Object.keys(HOUSEHOLD_LABELS) as HouseholdKey[]).map((k) => (
                    <option key={k} value={k}>{HOUSEHOLD_LABELS[k]}</option>
                  ))}
                </select>
              </label>
              <Field
                label="Límite anual con descuento" hint="Por encima de este consumo se pierde el descuento."
                value={draft.householdLimits[draft.household]} step={1} suffix="kWh/año"
                onChange={(v) => setDraft({ ...draft, householdLimits: { ...draft.householdLimits, [draft.household]: v } })}
              />
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Inicio del periodo anual</span>
                <input type="date" className={`${INPUT} mt-1.5`} value={draft.periodStart} onChange={(e) => e.target.value && setDraft({ ...draft, periodStart: e.target.value })} />
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Fecha desde la que se cuenta el consumo para el límite.</span>
              </label>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-white/10">
                <span>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">Avisarme del límite</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Aviso al llegar al 80 % y al superarlo (notificación del navegador y banner).</span>
                </span>
                <input
                  type="checkbox" className="h-5 w-5 accent-indigo-600" checked={draft.alerts}
                  onChange={(e) => {
                    if (e.target.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
                    setDraft({ ...draft, alerts: e.target.checked });
                  }}
                />
              </label>
            </>
          )}
          <Section title="Objetivos" />
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
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="flex items-center gap-2 text-sm font-medium text-rose-600 hover:text-rose-500 dark:text-rose-400">
              <Icon name="trash" className="h-4 w-4" />
              Borrar todos los datos (admin)
            </button>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setDelError(null);
                const err = await onDelete(adminUser, adminPass);
                if (err) setDelError(err);
                setAdminPass('');
              }}
            >
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Se borrarán <b>todas las lecturas</b> de todos los dispositivos. Tus ajustes no se tocan. No se puede deshacer.
              </p>
              <input className={INPUT} placeholder="Usuario" autoComplete="username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
              <input className={INPUT} type="password" placeholder="Contraseña" autoComplete="current-password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
              {delError && <p className="text-sm text-rose-600 dark:text-rose-400">{delError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium dark:border-white/10 dark:text-slate-200">
                  Cancelar
                </button>
                <button type="submit" disabled={deleting || !adminUser || !adminPass} className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50">
                  {deleting ? 'Borrando…' : 'Borrar todo'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
