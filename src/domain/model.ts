export type DcVoltage = 12 | 24;
export type Supply = 'dc' | 'ac-inverter' | 'ac-shore';
/** Operating scenario for inverter-backed AC outputs: shore means AC pass-through, not battery inversion. */
export type AcOperatingMode = 'inverter' | 'shore';
export type Evidence = 'manual' | 'measured' | 'reported' | 'listing' | 'estimated' | 'unknown';
export type LoadKind = 'standard' | 'led-strip' | 'compressor' | 'multi-state';
export type ComponentKind =
  | 'battery' | 'solar' | 'mppt' | 'dc-dc' | 'inverter' | 'distribution'
  | 'controller' | 'switch' | 'usb-charger' | 'appliance' | 'monitor'
  | 'consumer-unit' | 'shore-inlet' | 'socket-outlet';
export type Hazard = 'electrical-fire' | 'electric-shock' | 'carbon-monoxide' | 'combustion-exhaust' | 'lpg' | 'water-leak';

/** The third DC conductor is a chassis/bonding connection, NEVER a synonym for negative or AC PE. */
export type Conductor = 'L' | 'N' | 'PE' | 'DC+' | 'DC-' | 'CHASSIS';
export type ElectricalSystem = 'ac' | 'dc';
export type PortDirection = 'input' | 'output';
export type LinkStatus = 'proposed' | 'reported' | 'verified';

export interface Profile { id: string; name: string; description: string }
export interface OutputChannel { id: string; label: string }
export interface ElectricalPort {
  id: string; label: string; system: ElectricalSystem; direction: PortDirection;
  voltage: 12 | 24 | 230 | '12/24'; conductors: Conductor[];
}
export interface SocketPosition { id: string; label: string }
export interface Component {
  id: string; name: string; kind: ComponentKind; model?: string;
  voltage?: DcVoltage | '12/24' | '230';
  outputs?: OutputChannel[]; ports?: ElectricalPort[]; socketPositions?: SocketPosition[];
  notes?: string; evidence?: Evidence; hazards?: Hazard[];
}
export interface Circuit {
  id: string; name: string; supply: Supply; voltage: 12 | 24 | 230;
  /** Informational assignment; not verified installation wiring. */
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

/** Logical relationship between port groups, never a wire or all-conductor connection. */
export interface TopologyLink {
  id: string; fromComponentId: string; fromPortId: string;
  toComponentId: string; toPortId: string;
  status: LinkStatus; notes?: string;
}
export type ProtectionKind = 'rcd' | 'mcb' | 'rcbo' | 'isolator' | 'unknown';
export interface ProtectionDevice {
  id: string; consumerUnitId: string; name: string; kind: ProtectionKind;
  ratedCurrentA: number | null; residualTripMa: number | null;
  protectedCircuitIds: string[]; evidence: Evidence; notes?: string;
}
/** Socket accessories and their positions do not themselves consume the attached appliance's power. */
export interface SocketAssignment {
  id: string; socketComponentId: string; positionId: string;
  loadId: string; evidence: Evidence;
}

/** Editable planning assumptions, NOT measured charge behaviour. */
export interface AutonomySettings {
  startingSocPct: number;
  reserveSocPct: number;
  hoursDrivingPerDay: number;
  /** Spare current available to the charger, NOT the alternator nameplate rating. */
  availableAlternatorA: number | null;
  alternatorVoltageV: number;
  dcDcInputCurrentLimitA: number;
  dcDcOutputCurrentLimitA: number;
  dcDcOutputVoltageV: number;
  dcDcEfficiency: number;
  dcDcActiveFraction: number;
  solarPanelWatts: number;
  mpptNominalPvLimitWatts: number;
  solarLossPct: number;
  solarShadingFraction: number;
  solarInclinationDeg: number;
  /** PVGIS compass aspect: 0=south, 90=west, -90=east. */
  solarAspectDeg: number;
  solarMode: 'uk-reference' | 'selected-location';
  solarLocationName: string;
  solarLatitude: number;
  solarLongitude: number;
  solarMonth: number; // 1..12
  solarManualWhPerDay: number | null;
  solarClimatology?: {
    source: 'PVGIS-v5_3';
    requestedAt: string;
    queryFingerprint: string;
    monthlyDailyWh: number[]; // exactly 12, January..December
    description: string;
  };
}

export interface Project {
  schemaVersion: 2; name: string; nominalBatteryVoltage: DcVoltage;
  batteryCapacityAh: number | null; inverterEfficiency: number;
  /** Optional to preserve existing v2 saved data; default behaviour is inverter. */
  acOperatingMode?: AcOperatingMode;
  autonomy?: AutonomySettings;
  profiles: Profile[]; components: Component[]; circuits: Circuit[]; loads: Load[];
  topologyLinks: TopologyLink[]; protectionDevices: ProtectionDevice[];
  socketAssignments: SocketAssignment[];
}
export type ProjectV1 = Omit<Project, 'schemaVersion' | 'topologyLinks' | 'protectionDevices' | 'socketAssignments'> & { schemaVersion: 1 };
