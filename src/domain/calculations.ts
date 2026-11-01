import type { Circuit, Load, ModeUsage, OperatingMode, Project } from './model.ts';
import { resolveLogicalSupply } from './supply.ts';

export interface LoadResult {
  loadId: string; name: string; circuitId: string; deliveredWh: number;
  batteryWh: number; peakWatts: number; incomplete: boolean;
  issues: string[];
}
export interface CircuitResult {
  circuitId: string; name: string; deliveredWh: number; batteryWh: number;
  peakWatts: number; incomplete: boolean; loads: LoadResult[];
}
export interface ProjectResult {
  deliveredWh: number; batteryWh: number; equivalentAh: number;
  worstCaseConnectedWatts: number; circuitResults: CircuitResult[];
  incompleteLoads: string[]; warnings: string[];
}

const validPositive = (n: number | null | undefined): n is number => n !== null && n !== undefined && Number.isFinite(n) && n >= 0;
const validFraction = (n: number): boolean => Number.isFinite(n) && n >= 0 && n <= 1;
const validMinutes = (n: number): boolean => Number.isFinite(n) && n >= 0 && n <= 1440;

/** Maximum LED input power is length × W/m; dimming is an energy assumption, not a cable-sizing discount. */
export function ledRatedWatts(load: Load): number | null {
  if (load.kind !== 'led-strip') return null;
  if (!load.led || !validPositive(load.led.lengthMetres) || !validPositive(load.led.wattsPerMetre)) return null;
  return load.led.lengthMetres * load.led.wattsPerMetre;
}

function getWatts(load: Load, mode: OperatingMode): number | null {
  return load.kind === 'led-strip' ? ledRatedWatts(load) : mode.watts;
}

function modeUsage(mode: OperatingMode, profileId: string): ModeUsage {
  return mode.usage[profileId] ?? { minutesPerDay: 0, dutyFraction: 1 };
}

export function calculateLoad(load: Load, circuit: Circuit, project: Project, profileId: string): LoadResult {
  const issues: string[] = [];
  let deliveredWh = 0;
  let peakWatts = 0;
  let missing = false;
  const brightness = load.kind === 'led-strip' ? load.led?.brightnessFraction ?? 1 : 1;
  if (!validFraction(brightness)) { issues.push('Invalid LED brightness factor'); missing = true; }
  for (const mode of load.modes) {
    const usage = modeUsage(mode, profileId);
    const watts = getWatts(load, mode);
    if (!validMinutes(usage.minutesPerDay) || !validFraction(usage.dutyFraction)) {
      issues.push(`Invalid usage for ${mode.name}`); missing = true; continue;
    }
    if (!validPositive(watts)) {
      if (usage.minutesPerDay > 0) { issues.push(`Missing power rating for ${mode.name}`); missing = true; }
      continue;
    }
    peakWatts = Math.max(peakWatts, watts);
    deliveredWh += watts * usage.minutesPerDay / 60 * usage.dutyFraction * (validFraction(brightness) ? brightness : 1);
  }
  let batteryWh = deliveredWh;
  if (circuit.supply === 'dc' && circuit.voltage !== project.nominalBatteryVoltage) {
    issues.push(`${circuit.voltage}V circuit needs a verified converter from the ${project.nominalBatteryVoltage}V battery`);
    missing = true; batteryWh = 0;
  }
  if (circuit.supply === 'ac-inverter' && (project.acOperatingMode ?? 'inverter') === 'inverter') {
    if (!Number.isFinite(project.inverterEfficiency) || project.inverterEfficiency <= 0 || project.inverterEfficiency > 1) {
      issues.push('Invalid inverter efficiency'); missing = true; batteryWh = 0;
    } else batteryWh = deliveredWh / project.inverterEfficiency;
  }
  if (circuit.supply === 'ac-shore' || (circuit.supply === 'ac-inverter' && project.acOperatingMode === 'shore')) batteryWh = 0;
  return { loadId: load.id, name: load.name, circuitId: circuit.id, deliveredWh, batteryWh, peakWatts, incomplete: missing, issues };
}

export function calculateProject(project: Project, profileId: string): ProjectResult {
  const warnings: string[] = [];
  const allLoads = new Set<string>();
  const circuitResults: CircuitResult[] = project.circuits.map(circuit => {
    const loads = project.loads.filter(load => load.circuitId === circuit.id).map(load => {
      allLoads.add(load.id);
      return calculateLoad(load, circuit, project, profileId);
    });
    return {
      circuitId: circuit.id, name: circuit.name,
      deliveredWh: loads.reduce((n, l) => n + l.deliveredWh, 0),
      batteryWh: loads.reduce((n, l) => n + l.batteryWh, 0),
      peakWatts: loads.reduce((n, l) => n + l.peakWatts, 0),
      incomplete: loads.some(l => l.incomplete), loads,
    };
  });
  for (const load of project.loads) if (!allLoads.has(load.id)) warnings.push(`Unassigned load: ${load.name}`);
  if (!project.profiles.some(p => p.id === profileId)) warnings.push('Selected usage profile does not exist');
  const batteryWh = circuitResults.reduce((n, c) => n + c.batteryWh, 0);
  for (const load of project.loads) {
    const c=project.circuits.find(c=>c.id===load.circuitId);
    if(c?.supply !== 'dc') {
      for(const issue of resolveLogicalSupply(project,load).issues) warnings.push(`${load.name}: ${issue}`);
    }
  }
  if ((project.acOperatingMode ?? 'inverter') === 'shore') warnings.push('Shore-power scenario assumes shore available and MultiPlus pass-through; battery charging, charger overhead and AC transfer are not simulated.');
  const incompleteLoads = circuitResults.flatMap(c => c.loads.filter(l => l.incomplete).map(l => l.name));
  if (incompleteLoads.length) warnings.push('Totals are partial: some powered loads have missing ratings or conversion details');
  warnings.push('Worst-case connected watts is a sum of load maxima, not a verified simultaneous demand or fuse-sizing calculation.');
  return {
    deliveredWh: circuitResults.reduce((n, c) => n + c.deliveredWh, 0), batteryWh,
    equivalentAh: batteryWh / project.nominalBatteryVoltage,
    worstCaseConnectedWatts: circuitResults.reduce((n, c) => n + c.peakWatts, 0),
    circuitResults, incompleteLoads, warnings,
  };
}
