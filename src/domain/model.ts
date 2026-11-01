export type DcVoltage = 12 | 24;
export type Supply = 'dc' | 'ac-inverter' | 'ac-shore';
/** Operating scenario for inverter-backed AC outputs: shore means AC pass-through, not battery inversion. */
export type AcOperatingMode = 'inverter' | 'shore';
export type Evidence = 'manual' | 'measured' | 'reported' | 'listing' | 'estimated' | 'unknown';
export type LoadKind = 'standard' | 'led-strip' | 'compressor' | 'multi-state';
export type ComponentKind =
  | 'battery' | 'solar' | 'mppt' | 'dc-dc' | 'inverter' | 'distribution'
  | 'controller' | 'switch' | 'usb-charger' | 'appliance' | 'monitor'
  | 'consumer-unit' | 'shore-inlet' | 'socket-outlet' | 'busbar';
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
  /** Busbar conductor identity; never equate PE with DC negative or chassis. */
  busbarFunction?: 'PE' | 'DC-' | 'CHASSIS';
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


/** Battery/BMS records are equipment facts; unknown specs stay null. */
export type ThermalFeature = 'yes' | 'no' | 'unknown';
export type CapabilityEvidence = 'documented' | 'verified' | 'unverified' | 'not-supported';
export interface BatteryRecord {
  id: string; componentId?: string; name: string; manufacturer: string; model: string;
  chemistry: 'lifepo4' | 'agm' | 'gel' | 'lead-acid' | 'other' | 'unknown';
  nominalVoltageV: number | null; capacityAh: number | null; weightKg: number | null;
  dimensionsMm: { length:number|null; width:number|null; height:number|null };
  maxChargeA: number | null; maxDischargeA: number | null;
  chargeMinC: number | null; chargeMaxC: number | null;
  dischargeMinC: number | null; dischargeMaxC: number | null;
  bms: {
    integrated: ThermalFeature; manufacturer:string; model:string;
    bluetooth: ThermalFeature; vendorApp:string;
    externalManagement: CapabilityEvidence;
    protocol: string; documentationUrl: string;
    cellVoltageMonitoring: ThermalFeature; balancing: ThermalFeature;
    alarms: ThermalFeature; protectionNotes:string;
  };
  thermal: {
    selfHeating: ThermalFeature; control: 'automatic'|'manual'|'bms'|'unknown';
    onC:number|null; offC:number|null; heaterWatts:number|null;
    source:'battery'|'external-charger'|'both'|'unknown';
    lowTemperatureChargeCutoff:ThermalFeature; heatingStatusReported:ThermalFeature;
  };
  evidence:Evidence; documentationUrl:string; notes:string;
}
export interface BatteryBank {
  id:string; name:string;
  /** Each inner list is a series string; outer strings are parallel. */
  strings:string[][];
  notes:string;
}
export type CommunicationProtocol = 've-direct'|'ve-bus'|'ve-can'|'can'|'rs485'|'uart'|'usb'|'ethernet'|'bluetooth'|'aux-voltage'|'temperature'|'other';
export type CommunicationRole = 'device'|'controller'|'sensor'|'app';
export interface CommunicationPort {
  id:string; componentId:string; name:string;
  protocol:CommunicationProtocol; role:CommunicationRole;
  /** One physical port per record; no implicit virtual expansion. */
  documentationUrl:string; evidence:CapabilityEvidence;
  functions:string[]; notes:string;
}
export type CommunicationStatus = 'proposed'|'reported'|'verified';
export interface CommunicationConnection {
  id:string; fromPortId:string; toPortId:string;
  status:CommunicationStatus; cable:string; functions:string[];
  evidence:CapabilityEvidence; notes:string;
}
export type MonitoringMetric = 'habitation-soc'|'starter-voltage'|'battery-temperature'|'cell-voltages'|'charging-state';
export interface MonitoringAuthority {
  metric:MonitoringMetric; componentId:string;
  method:'gx'|'vendor-app'|'local'|'manual';
  evidence:CapabilityEvidence; notes:string;
}
export interface AuxiliaryAssignment {
  portId:string; purpose:'starter-voltage'|'battery-temperature'|'midpoint';
  targetComponentId:string|null; accessory:string; status:CommunicationStatus; notes:string;
}
/** DC conductor sizing is a planning recommendation, never a cable certification. */
export type DcCablePolarity = 'positive' | 'negative' | 'chassis';
export type ProtectionPlacement = 'battery-end'|'distribution-end'|'equipment-end'|'integrated-in-distributor'|'unconfirmed';
export type FuseConfidence = 'owner-checked'|'owner-reported'|'manufacturer-range'|'provisional'|'unknown';
export interface DcFuseRecord {
  id:string; label:string; holderComponentId:string|null; slot:number|null;
  ratingA:number|null; fuseForm:'MEGA'|'ATO-ATC'|'inline'|'unknown';
  placement:ProtectionPlacement;
  /** Exact physical position relative to the source and destination, NOT power flow. */
  nearComponentId:string|null;
  /** Proposed safe source-side placement; never confused with the observed location. */
  recommendedPlacement?:ProtectionPlacement;
  recommendedNearComponentId?:string|null;
  relativeElectricalOrder?:string;
  status:'reported'|'proposed'|'unknown';
  confidence:FuseConfidence; documentationUrl:string; notes:string;
}
export interface DcCableRun {
  id:string; name:string; fromComponentId:string; toComponentId?:string;
  toCircuitId?:string; polarity:DcCablePolarity;
  /** Assumed one-way conductor length. Return run is a separate cable. */
  lengthM:number; lengthEvidence:'assumed'|'reported'|'measured';
  /** Design current only: null when genuine manufacturer/load current is unknown. */
  designCurrentA:number|null;
  /** Manufacturer recommended minimum cross-section when available. */
  manufacturerMinMm2:number|null;
  /** User-selectable nominal battery/system voltage for voltage-drop estimate. */
  voltageV:number;
  fuseId:string|null;
  status:'reported'|'proposed'|'unknown'; notes:string;
}
export interface DcWiringPlan {
  fuses:DcFuseRecord[];
  cables:DcCableRun[];
  notes:string;
}
/** A portable-device charge is an energy event, not charger nameplate wattage.
 * An 80% charge means replacing 80 percentage points of battery capacity (0% to 80%).
 * Source circuit identifies the socket/USB supply, not a separate double-counted appliance.
 */
export interface PortableCharge {
  id:string; name:string; category:'iphone'|'ipad'|'other';
  batteryWh:number|null; batteryEvidence:Evidence; specificationUrl:string;
  rechargeFraction:number;
  /** User-estimated end-to-end USB supply-to-device-battery efficiency. */
  chargingEfficiency:number;
  /** Fractional events allowed, e.g. 0.5 charges per day. */
  chargesPerDay:Record<string,number>;
  circuitId:string;
  notes:string;
}
export interface DiagramPosition { componentId:string; layer:'ac'|'dc'|'communications'; x:number; y:number }

export interface Project {
  schemaVersion: 3; name: string; nominalBatteryVoltage: DcVoltage;
  batteryCapacityAh: number | null; inverterEfficiency: number;
  /** Optional to preserve existing v2 saved data; default behaviour is inverter. */
  acOperatingMode?: AcOperatingMode;
  autonomy?: AutonomySettings;
  profiles: Profile[]; components: Component[]; circuits: Circuit[]; loads: Load[];
  topologyLinks: TopologyLink[]; protectionDevices: ProtectionDevice[];
  socketAssignments: SocketAssignment[];
  batteries:BatteryRecord[]; batteryBanks:BatteryBank[]; activeBatteryBankId:string|null;
  communicationPorts:CommunicationPort[]; communicationConnections:CommunicationConnection[];
  monitoringAuthorities:MonitoringAuthority[]; auxiliaryAssignments:AuxiliaryAssignment[]; diagramPositions:DiagramPosition[];
  /** Optional for backwards-compatible v3 saved projects; hydrated without deleting edits. */
  dcWiring?:DcWiringPlan;
  /** Optional v3 addition: per-device charging as daily energy events, not peak watts. */
  portableCharges?:PortableCharge[];
}
export type ProjectV2 = Omit<Project, 'schemaVersion'|'batteries'|'batteryBanks'|'activeBatteryBankId'|'communicationPorts'|'communicationConnections'|'monitoringAuthorities'|'auxiliaryAssignments'|'diagramPositions'> & {schemaVersion:2};
export type ProjectV1 = Omit<ProjectV2, 'schemaVersion' | 'topologyLinks' | 'protectionDevices' | 'socketAssignments'> & { schemaVersion: 1 };
