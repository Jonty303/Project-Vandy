import type { Project } from './model.ts';
import { seedProject } from '../data/vandy.ts';

export const STORAGE_KEY = 'project-vandy:project:v1';

export function validateProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<Project>;
  if (p.schemaVersion !== 1 || typeof p.name !== 'string' || ![12, 24].includes(p.nominalBatteryVoltage ?? -1)) return false;
  if (typeof p.inverterEfficiency !== 'number' || !(p.inverterEfficiency > 0 && p.inverterEfficiency <= 1)) return false;
  if (p.batteryCapacityAh !== null && (typeof p.batteryCapacityAh !== 'number' || !Number.isFinite(p.batteryCapacityAh) || p.batteryCapacityAh < 0)) return false;
  if (!Array.isArray(p.profiles) || !Array.isArray(p.circuits) || !Array.isArray(p.loads) || !Array.isArray(p.components)) return false;
  if (!p.profiles.every(x => x && typeof x.id === 'string' && typeof x.name === 'string')) return false;
  if (!p.components.every(x => x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.kind === 'string' && (!x.outputs || Array.isArray(x.outputs)))) return false;
  if (!p.circuits.every(x => x && typeof x.id === 'string' && typeof x.name === 'string' && ['dc','ac-inverter','ac-shore'].includes(x.supply) && [12,24,230].includes(x.voltage))) return false;
  if (!p.loads.every(x => x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.circuitId === 'string' && ['standard','led-strip','compressor','multi-state'].includes(x.kind) && Array.isArray(x.modes) && x.modes.length > 0 && x.modes.every(m => m && typeof m.id === 'string' && typeof m.name === 'string' && (m.watts === null || (typeof m.watts === 'number' && Number.isFinite(m.watts) && m.watts >= 0)) && m.usage && typeof m.usage === 'object' && Object.values(m.usage).every(u => u && typeof u.minutesPerDay === 'number' && u.minutesPerDay >= 0 && u.minutesPerDay <= 1440 && typeof u.dutyFraction === 'number' && u.dutyFraction >= 0 && u.dutyFraction <= 1)))) return false;
  const circuits = new Set(p.circuits.map(c => c.id));
  const profiles = new Set(p.profiles.map(p => p.id));
  if (circuits.size !== p.circuits.length || profiles.size !== p.profiles.length) return false;
  if (p.loads.some(l => !circuits.has(l.circuitId))) return false;
  return true;
}

export function loadProject(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const parsed: unknown = JSON.parse(raw); if (validateProject(parsed)) return parsed; }
  } catch { /* Invalid or blocked browser storage: retain the demo project. */ }
  return structuredClone(seedProject);
}

export function saveProject(project: Project): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); return true; }
  catch { return false; }
}
