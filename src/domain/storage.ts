import type { Component, Load, Project, ProjectV1, ProjectV2 } from './model.ts';
import { seedProject } from '../data/vandy.ts';
import { initialWiringPlan } from './dcWiring.ts';
import { vandyPortableCharging } from './portableCharging.ts';

export const STORAGE_KEY = 'project-vandy:project:v3';
export const V2_STORAGE_KEY = 'project-vandy:project:v2';
export const LEGACY_STORAGE_KEY = 'project-vandy:project:v1';
const isRecord = (x: unknown): x is Record<string,unknown> => !!x && typeof x==='object' && !Array.isArray(x);
const validNumber = (x: unknown) => typeof x==='number' && Number.isFinite(x);
const validNonnegative = (x: unknown) => validNumber(x) && (x as number)>=0;
const validString = (x: unknown): x is string => typeof x==='string';
const validIdList = (x: unknown): x is string[] => Array.isArray(x) && x.every(validString);
const validEvidence = (x: unknown) => ['manual','measured','reported','listing','estimated','unknown'].includes(String(x));

/** Strict enough to reject malformed imports; separate topology diagnostics report logical issues. */
function validateBase(x: unknown): boolean {
  if(!isRecord(x) || !validString(x.name) || ![12,24].includes(Number(x.nominalBatteryVoltage))) return false;
  if(!validNumber(x.inverterEfficiency) || (x.inverterEfficiency as number)<=0 || (x.inverterEfficiency as number)>1) return false;
  if(x.batteryCapacityAh!==null && !validNonnegative(x.batteryCapacityAh)) return false;
  if('acOperatingMode' in x && !['inverter','shore'].includes(String(x.acOperatingMode))) return false;
  if(!Array.isArray(x.profiles)||!Array.isArray(x.components)||!Array.isArray(x.circuits)||!Array.isArray(x.loads)) return false;
  if(!x.profiles.every((p:unknown)=>isRecord(p)&&validString(p.id)&&validString(p.name))) return false;
  if(!x.components.every((c:unknown)=>isRecord(c)&&validString(c.id)&&validString(c.name)&&validString(c.kind)&&
    (!('ports' in c)||Array.isArray(c.ports)&&c.ports.every((p:unknown)=>isRecord(p)&&validString(p.id)&&validString(p.label)&&['ac','dc'].includes(String(p.system))&&['input','output'].includes(String(p.direction))&&[12,24,230,'12/24'].includes(p.voltage as string|number)&&validIdList(p.conductors)))&&
    (!('socketPositions' in c)||Array.isArray(c.socketPositions)&&c.socketPositions.every((p:unknown)=>isRecord(p)&&validString(p.id)&&validString(p.label))))) return false;
  if(!x.circuits.every((c:unknown)=>isRecord(c)&&validString(c.id)&&validString(c.name)&&['dc','ac-inverter','ac-shore'].includes(String(c.supply))&&[12,24,230].includes(Number(c.voltage)))) return false;
  if(!x.loads.every((l:unknown)=>isRecord(l)&&validString(l.id)&&validString(l.name)&&validString(l.circuitId)&&['standard','compressor','led-strip','multi-state'].includes(String(l.kind))&&Array.isArray(l.modes)&&l.modes.length>0&&
    l.modes.every((m:unknown)=>isRecord(m)&&validString(m.id)&&validString(m.name)&&(m.watts===null||validNonnegative(m.watts))&&isRecord(m.usage)&&Object.values(m.usage).every((u:unknown)=>isRecord(u)&&validNonnegative(u.minutesPerDay)&&(u.minutesPerDay as number)<=1440&&validNonnegative(u.dutyFraction)&&(u.dutyFraction as number)<=1)))) return false;
  const ids=(list:{id:string}[])=>new Set(list.map(x=>x.id)).size===list.length;
  if(!ids(x.profiles as {id:string}[])||!ids(x.circuits as {id:string}[])||!ids(x.loads as {id:string}[])||!ids(x.components as {id:string}[]))return false;
  const circuitIds=new Set((x.circuits as {id:string}[]).map(c=>c.id));
  if((x.loads as {circuitId:string}[]).some(l=>!circuitIds.has(l.circuitId)))return false;
  return true;
}

/** Reject malformed autonomy settings before accepting browser JSON imports. */
function validAutonomy(value:unknown):boolean{
  if(!isRecord(value))return false;
  const numbers=['startingSocPct','reserveSocPct','hoursDrivingPerDay','alternatorVoltageV',
    'dcDcInputCurrentLimitA','dcDcOutputCurrentLimitA','dcDcOutputVoltageV','dcDcEfficiency',
    'dcDcActiveFraction','solarPanelWatts','mpptNominalPvLimitWatts','solarLossPct','solarShadingFraction',
    'solarInclinationDeg','solarAspectDeg','solarLatitude','solarLongitude','solarMonth'];
  if(numbers.some(k=>!validNumber(value[k])))return false;
  if(!validString(value.solarLocationName))return false;
  if(!['uk-reference','selected-location'].includes(String(value.solarMode)))return false;
  if(value.availableAlternatorA!==null&&!validNonnegative(value.availableAlternatorA))return false;
  if(value.solarManualWhPerDay!==null&&!validNonnegative(value.solarManualWhPerDay))return false;
  if((value.startingSocPct as number)<0||(value.startingSocPct as number)>100)return false;
  if((value.reserveSocPct as number)<0||(value.reserveSocPct as number)>100)return false;
  if((value.dcDcEfficiency as number)<=0||(value.dcDcEfficiency as number)>1)return false;
  if((value.dcDcActiveFraction as number)<0||(value.dcDcActiveFraction as number)>1)return false;
  if((value.solarShadingFraction as number)<0||(value.solarShadingFraction as number)>1)return false;
  if((value.solarMonth as number)<1||(value.solarMonth as number)>12)return false;
  if((value.solarPanelWatts as number)<=0||(value.mpptNominalPvLimitWatts as number)<=0)return false;
  if('solarClimatology' in value && value.solarClimatology!==undefined){
    const d=value.solarClimatology;
    if(!isRecord(d)||d.source!=='PVGIS-v5_3'||!validString(d.requestedAt)||
      !validString(d.queryFingerprint)||!validString(d.description)||
      !Array.isArray(d.monthlyDailyWh)||d.monthlyDailyWh.length!==12||
      d.monthlyDailyWh.some((n:unknown)=>!validNonnegative(n)))return false;
  }
  return true;
}

function validateV2Core(x:unknown):boolean {
  if(!validateBase(x)||!isRecord(x)||![2,3].includes(Number(x.schemaVersion))) return false;
  if(!Array.isArray(x.topologyLinks)||!Array.isArray(x.protectionDevices)||!Array.isArray(x.socketAssignments))return false;
  if('autonomy' in x && x.autonomy!==undefined && !validAutonomy(x.autonomy))return false;
  if(!x.topologyLinks.every((l:unknown)=>isRecord(l)&&['proposed','reported','verified'].includes(String(l.status))&&['id','fromComponentId','fromPortId','toComponentId','toPortId'].every(k=>validString(l[k]))))return false;
  if(!x.protectionDevices.every((d:unknown)=>isRecord(d)&&validString(d.id)&&validString(d.consumerUnitId)&&validString(d.name)&&['rcd','mcb','rcbo','isolator','unknown'].includes(String(d.kind))&&(d.ratedCurrentA===null||validNonnegative(d.ratedCurrentA))&&(d.residualTripMa===null||validNonnegative(d.residualTripMa))&&validIdList(d.protectedCircuitIds)&&validEvidence(d.evidence)))return false;
  if(!x.socketAssignments.every((a:unknown)=>isRecord(a)&&['id','socketComponentId','positionId','loadId'].every(k=>validString(a[k]))&&validEvidence(a.evidence)))return false;
  return true;
}
function isV2Project(x:unknown):x is ProjectV2{
  return validateV2Core(x)&&isRecord(x)&&x.schemaVersion===2;
}
const validNullableNum=(x:unknown)=>x===null||validNumber(x);
export function validateProject(x: unknown): x is Project {
  if(!validateV2Core(x)||!isRecord(x)||x.schemaVersion!==3)return false;
  if(!Array.isArray(x.batteries)||!Array.isArray(x.batteryBanks)||
    !Array.isArray(x.communicationPorts)||!Array.isArray(x.communicationConnections)||
    !Array.isArray(x.monitoringAuthorities)||!Array.isArray(x.auxiliaryAssignments)||!Array.isArray(x.diagramPositions))return false;
  if(x.activeBatteryBankId!==null&&!validString(x.activeBatteryBankId))return false;
  const unique=(items:{id:string}[])=>new Set(items.map(item=>item.id)).size===items.length;
  if(!x.batteries.every((v:unknown)=>isRecord(v)&&validString(v.id)&&validString(v.name)&&
     validString(v.manufacturer)&&validString(v.model)&&validString(v.chemistry)&&
     validNullableNum(v.nominalVoltageV)&&validNullableNum(v.capacityAh)&&
     validNullableNum(v.weightKg)&&validNullableNum(v.maxChargeA)&&validNullableNum(v.maxDischargeA)&&
     validNullableNum(v.chargeMinC)&&validNullableNum(v.chargeMaxC)&&
     validNullableNum(v.dischargeMinC)&&validNullableNum(v.dischargeMaxC)&&
     isRecord(v.dimensionsMm)&&['length','width','height'].every(k=>validNullableNum((v.dimensionsMm as Record<string,unknown>)[k]))&&
     isRecord(v.bms)&&validString(v.bms.vendorApp)&&validString(v.bms.protocol)&&
     isRecord(v.thermal)&&validNullableNum(v.thermal.onC)&&validNullableNum(v.thermal.offC)&&
     validNullableNum(v.thermal.heaterWatts)&&validEvidence(v.evidence)&&
     validString(v.documentationUrl)&&validString(v.notes)))return false;
  if(!unique(x.batteries as {id:string}[]))return false;
  if(!x.batteryBanks.every((v:unknown)=>isRecord(v)&&validString(v.id)&&validString(v.name)&&
    Array.isArray(v.strings)&&v.strings.every((a:unknown)=>validIdList(a))))return false;
  if(!unique(x.batteryBanks as {id:string}[]))return false;
  if(!x.communicationPorts.every((v:unknown)=>isRecord(v)&&validString(v.id)&&validString(v.componentId)&&
    validString(v.name)&&validString(v.protocol)&&validString(v.role)&&
    validString(v.documentationUrl)&&validString(v.evidence)&&validIdList(v.functions)))return false;
  if(!unique(x.communicationPorts as {id:string}[]))return false;
  if(!x.communicationConnections.every((v:unknown)=>isRecord(v)&&validString(v.id)&&
    validString(v.fromPortId)&&validString(v.toPortId)&&['proposed','reported','verified'].includes(String(v.status))&&
    validString(v.cable)&&validIdList(v.functions)&&validString(v.evidence)))return false;
  if(!unique(x.communicationConnections as {id:string}[]))return false;
  if(!x.monitoringAuthorities.every((v:unknown)=>isRecord(v)&&validString(v.metric)&&
    validString(v.componentId)&&validString(v.method)&&validString(v.evidence)&&validString(v.notes)))return false;
  if(!x.auxiliaryAssignments.every((v:unknown)=>isRecord(v)&&validString(v.portId)&&
    ['starter-voltage','battery-temperature','midpoint'].includes(String(v.purpose))&&
    (v.targetComponentId===null||validString(v.targetComponentId))&&validString(v.accessory)&&
    ['proposed','reported','verified'].includes(String(v.status))&&validString(v.notes)))return false;
  if(!x.diagramPositions.every((v:unknown)=>isRecord(v)&&validString(v.componentId)&&
    validNumber(v.x)&&validNumber(v.y)))return false;
  if('portableCharges' in x && x.portableCharges!==undefined){
    if(!Array.isArray(x.portableCharges))return false;
    if(!x.portableCharges.every((d:unknown)=>isRecord(d)&&validString(d.id)&&validString(d.name)&&
      ['iphone','ipad','other'].includes(String(d.category))&&validNullableNum(d.batteryWh)&&
      validEvidence(d.batteryEvidence)&&validString(d.specificationUrl)&&
      validNumber(d.rechargeFraction)&&validNumber(d.chargingEfficiency)&&
      isRecord(d.chargesPerDay)&&Object.values(d.chargesPerDay).every(validNonnegative)&&
      validString(d.circuitId)&&validString(d.notes)))return false;
  }
  if('dcWiring' in x && x.dcWiring!==undefined){
    const w=x.dcWiring;
    if(!isRecord(w)||!Array.isArray(w.fuses)||!Array.isArray(w.cables)||!validString(w.notes))return false;
    if(!w.fuses.every((f:unknown)=>isRecord(f)&&validString(f.id)&&validString(f.label)&&
      (f.holderComponentId===null||validString(f.holderComponentId))&&
      (f.slot===null||(validNumber(f.slot)&&(f.slot as number)>=1))&&
      (f.ratingA===null||validNonnegative(f.ratingA))&&validString(f.fuseForm)&&validString(f.placement)&&
      (f.nearComponentId===null||validString(f.nearComponentId))&&
      validString(f.status)&&validString(f.confidence)&&validString(f.notes)&&validString(f.documentationUrl)))return false;
    if(!w.cables.every((c:unknown)=>isRecord(c)&&validString(c.id)&&validString(c.name)&&
      validString(c.fromComponentId)&&validString(c.polarity)&&validNumber(c.lengthM)&&
      validString(c.lengthEvidence)&&validNullableNum(c.designCurrentA)&&
      validNullableNum(c.manufacturerMinMm2)&&validNumber(c.voltageV)&&
      (c.fuseId===null||validString(c.fuseId))&&validString(c.status)&&validString(c.notes)))return false;
  }
  return true;
}
function isLegacyProject(x: unknown): x is ProjectV1 {
  return validateBase(x)&&isRecord(x)&&x.schemaVersion===1;
}

function uneditedLegacyLaptop(load: Load): boolean {
  if(!['laptop-one','laptop-two'].includes(load.id)||load.kind!=='standard'||load.circuitId!=='ac-sockets'||load.modes.length!==1)return false;
  const m=load.modes[0];
  return m.watts===65&&m.evidence==='estimated'&&m.usage.normal?.minutesPerDay===0&&
    m.usage.working?.minutesPerDay===480&&m.usage.winter?.minutesPerDay===0;
}
/** Hydrate existing v3 browser projects with the new test-data wiring model.
 * Never overwrite custom load measurements, circuit sources or user-edited fuse schedules.
 */
function hydrateWiring(p:Project):Project{
  const vandy=p.components.some(c=>c.id==='battery')&&p.components.some(c=>c.id==='lynx')&&p.components.some(c=>c.id==='blue-sea');
  if(!vandy)return p.dcWiring?p:{...p,dcWiring:{fuses:[],cables:[],notes:'No default Vandy wiring plan for this custom project.'}};
  const defaults=seedProject;
  const components=p.components.map(c=>c.id==='battery'&&c.name==='WattCycle LiFePO₄ battery'?
    {...c,name:'WattCycle 280Ah Mini Bluetooth LiFePO₄',model:'280Ah Mini Bluetooth (revision unconfirmed)',
      notes:[c.notes,'Owner identified Mini Bluetooth variant; exact revision still unverified.'].filter(Boolean).join(' ')}:c);
  for(const id of ['starter-battery','isolator']){
    const c=defaults.components.find(c=>c.id===id);
    if(c&&!components.some(x=>x.id===id))components.push(structuredClone(c));
  }
  const circuits=p.circuits.map(c=>{
    const starter=defaults.circuits.find(d=>d.id===c.id);
    return starter&&!c.sourceComponentId&&starter.sourceComponentId==='blue-sea'?
      {...c,sourceComponentId:starter.sourceComponentId,sourceOutputId:starter.sourceOutputId,
        notes:[c.notes,starter.notes].filter(Boolean).join(' ')}:c;
  });
  const loads=p.loads.map(l=>{
    if(l.id==='floor-led'&&l.led?.lengthMetres===null)return {...l,led:{...l.led,lengthMetres:2}};
    if(l.id==='kitchen-light'&&l.name==='Kitchen light'&&l.kind==='standard'&&l.modes[0]?.watts===null){
      const d=defaults.loads.find(x=>x.id==='kitchen-light');
      return d?structuredClone(d):l;
    }
    if(l.id==='toilet-light'&&l.name==='Toilet light'&&l.kind==='standard'&&l.modes[0]?.watts===1){
      const d=defaults.loads.find(x=>x.id==='toilet-light');
      return d?structuredClone(d):l;
    }
    if(l.id==='outside-light'&&l.name==='Outside light'&&l.modes[0]?.watts===null){
      const d=defaults.loads.find(x=>x.id==='outside-light');
      return d?structuredClone(d):l;
    }
    return l;
  });
  const batteries=p.batteries.map(b=>b.id==='battery-wattcycle'&&b.model==='280Ah LiFePO₄ (exact variant unconfirmed)'?
    {...b,name:'WattCycle 280Ah Mini Bluetooth habitation battery',
      model:'280Ah Mini Bluetooth LiFePO₄ (revision unconfirmed)',
      notes:[b.notes,'Owner confirmed Mini Bluetooth version; exact revision and self-heating still unverified.'].filter(Boolean).join(' ')}:b);
  // Legacy USB panel placeholder usage may be the energy of the same devices.
  // Only neutralise factory-default placeholders, never a user's changed values.
  const adaptedLoads=p.portableCharges===undefined?loads.map(l=>{
    if(!['usb-1','usb-2'].includes(l.id)||l.kind!=='standard'||l.modes.length!==1)return l;
    const m=l.modes[0];
    const factory=Object.entries({normal:60,working:120,winter:60}).every(([id,minutes])=>
      m.usage[id]?.minutesPerDay===minutes && m.watts===null);
    return factory?{...l,modes:[{...m,usage:Object.fromEntries(Object.entries(m.usage).map(([id,u])=>
      [id,{...u,minutesPerDay:0}]))}],
      notes:[l.notes,'Factory USB placeholder usage reset because portable charges now model device energy.'].filter(Boolean).join(' ')}:l;
  }):loads;
  const userHasUSBPlaceholder=adaptedLoads.some(l=>['usb-1','usb-2'].includes(l.id)&&
    l.modes.some(m=>Object.values(m.usage).some(u=>u.minutesPerDay>0)));
  const devices=p.portableCharges??(userHasUSBPlaceholder?[]:structuredClone(vandyPortableCharging));
  return {...p,components,circuits,loads:adaptedLoads,batteries,dcWiring:p.dcWiring??structuredClone(initialWiringPlan),
    portableCharges:devices};
}
/** Merge new reference entries without overwriting changed user objects or profiles. */
export function migrateProject(x: unknown): Project | null {
  if(validateProject(x)) return hydrateWiring(x);
  if(isV2Project(x)){
    const old=x as ProjectV2;
    const vandy=structuredClone(seedProject);
    // Existing v2 projects have no battery detail records. Preserve their edited
    // legacy Ah field as a reported planning number, never silently reset to 280.
    const batteries=vandy.batteries.map(b=>b.componentId==='battery'?{
      ...b,capacityAh:old.batteryCapacityAh,
      nominalVoltageV:old.nominalBatteryVoltage,
      evidence:'reported' as const,
      notes:b.notes+' Imported battery Ah from existing v2 project; confirm against actual hardware.'
    }:b);
    const customId=old.components.find(c=>c.kind==='battery')?.id;
    if(customId && customId!=='battery'){
      const legacy=old.components.find(c=>c.id===customId)!;
      batteries[0]={...batteries[0],componentId:customId,name:legacy.name,
        manufacturer:'',model:legacy.model??'',evidence:'reported' as const};
    }
    const componentIds=new Set(old.components.map(c=>c.id));
    return hydrateWiring({...old,schemaVersion:3,
      batteries,batteryBanks:vandy.batteryBanks,
      activeBatteryBankId:'habitation-bank',
      communicationPorts:vandy.communicationPorts.filter(p=>componentIds.has(p.componentId)),
      communicationConnections:[],monitoringAuthorities:vandy.monitoringAuthorities.filter(a=>componentIds.has(a.componentId)),
      auxiliaryAssignments:[],diagramPositions:[],portableCharges:[]});
  }
  if(!isLegacyProject(x)) return null;
  const old=x as ProjectV1;
  const base=structuredClone(seedProject);
  const newById=new Map(base.components.map(c=>[c.id,c]));
  const components: Component[]=old.components.map(c=>{
    const next=newById.get(c.id);
    return next?{...c,...(!c.ports && next.ports?{ports:next.ports}:{}),...(!c.socketPositions && next.socketPositions?{socketPositions:next.socketPositions}:{})}:c;
  });
  for(const c of base.components)if(!components.some(o=>o.id===c.id))components.push(c);
  const circuits=[...old.circuits];
  for(const c of base.circuits)if(!circuits.some(o=>o.id===c.id))circuits.push(c);
  const loads=old.loads.filter(l=>!uneditedLegacyLaptop(l)).map(l=>{
    if(l.id==='starlink'&&l.circuitId==='communications')return {...l,circuitId:'ac-sockets',notes:[l.notes,'Migrated to owner-confirmed 230V inverter supply.'].filter(Boolean).join(' ')};
    return l;
  });
  const keepLegacyLaptop=loads.some(l=>['laptop-one','laptop-two'].includes(l.id));
  for(const l of base.loads)if(!(l.id==='laptop-shared'&&keepLegacyLaptop)&&!loads.some(o=>o.id===l.id))loads.push(l);
  return hydrateWiring({...base,name:old.name,nominalBatteryVoltage:old.nominalBatteryVoltage,batteryCapacityAh:old.batteryCapacityAh,
    inverterEfficiency:old.inverterEfficiency,profiles:old.profiles,components,circuits,loads});
}
export function loadProject(): Project {
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw){const p=migrateProject(JSON.parse(raw) as unknown);if(p)return p;}
    const oldV2=localStorage.getItem(V2_STORAGE_KEY);
    if(oldV2){const p=migrateProject(JSON.parse(oldV2) as unknown);if(p)return p;}
    const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);
    if(legacy){const p=migrateProject(JSON.parse(legacy) as unknown);if(p)return p;}
  }catch{/* Invalid/unavailable browser storage: retain demo. */}
  return structuredClone(seedProject);
}
export function saveProject(project: Project): boolean {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(project));return true;}
  catch{return false;}
}
