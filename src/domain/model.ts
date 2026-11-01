export type DcVoltage = 12 | 24;
export type Supply = 'dc' | 'ac-inverter' | 'ac-shore';
export type Evidence = 'manual' | 'measured' | 'reported' | 'listing' | 'estimated' | 'unknown';
export type LoadKind = 'standard' | 'led-strip' | 'compressor' | 'multi-state';
export type ComponentKind = 'battery' | 'solar' | 'mppt' | 'dc-dc' | 'inverter' | 'distribution' | 'controller' | 'switch' | 'usb-charger' | 'appliance' | 'monitor';
export type Hazard = 'electrical-fire' | 'electric-shock' | 'carbon-monoxide' | 'combustion-exhaust' | 'lpg' | 'water-leak';

export interface Profile { id: string; name: string; description: string }
export interface OutputChannel { id: string; label: string; }
export interface Component {
  id: string; name: string; kind: ComponentKind; model?: string;
  voltage?: DcVoltage | '12/24' | '230';
  outputs?: OutputChannel[]; notes?: string; evidence?: Evidence; hazards?: Hazard[];
}
export interface Circuit {
  id: string; name: string; supply: Supply; voltage: 12 | 24 | 230;
  /** Logical source assignment only; never implies a verified physical wiring path. */
  sourceComponentId?: string; sourceOutputId?: string; notes?: string;
}
export interface ModeUsage { minutesPerDay: number; dutyFraction: number }
export interface OperatingMode {
  id: string; name: string; watts: number | null; evidence: Evidence;
  usage: Record<string, ModeUsage>;
}
export interface Load {
  id: string; name: string; circuitId: string; kind: LoadKind;
  componentId?: string; notes?: string;
  modes: OperatingMode[];
  led?: { lengthMetres: number | null; wattsPerMetre: number | null; brightnessFraction: number; evidence: Evidence };
}
export interface Project {
  schemaVersion: 1; name: string; nominalBatteryVoltage: DcVoltage;
  batteryCapacityAh: number | null; inverterEfficiency: number;
  profiles: Profile[]; components: Component[]; circuits: Circuit[]; loads: Load[];
}
