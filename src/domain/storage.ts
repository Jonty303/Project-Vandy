import type { Component, Load, Project, ProjectV1 } from './model.ts';
import { seedProject } from '../data/vandy.ts';

export const STORAGE_KEY = 'project-vandy:project:v2';
export const LEGACY_STORAGE_KEY = 'project-vandy:project:v1';
const isRecord = (x: unknown): x is Record<string,unknown> => !!x && typeof x==='object' && !Array.isArray(x);
const validNumber = (x: unknown) => typeof x==='number' && Number.isFinite(x);
const validNonnegative = (x: unknown) => validNumber(x) && (x as number)>=0;
const validString = (x: unknown): x is string => typeof x==='string';
const validIdList = (x: unknown): x is string[] => Array.isArray(x) && x.every(validString);
const validEvidence = (x: unknown) => ['manual','measured','reported','listing','estimated','unknown'].includes(String(x));

/** Strict enough to reject malformed imports; separate topology diagnostics report logical issues. */
function validateBase(x: unknown): x is ProjectV1 {
  if(!isRecord(x) || !validString(x.name) || ![12,24].includes(Number(x.nominalBatteryVoltage))) return false;
  if(!validNumber(x.inverterEfficiency) || (x.inverterEfficiency as number)<=0 || (x.inverterEfficiency as number)>1) return false;
  if(x.batteryCapacityAh!==null && !validNonnegative(x.batteryCapacityAh)) return false;
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

export function validateProject(x: unknown): x is Project {
  if(!validateBase(x)||!isRecord(x)||x.schemaVersion!==2) return false;
  if(!Array.isArray(x.topologyLinks)||!Array.isArray(x.protectionDevices)||!Array.isArray(x.socketAssignments))return false;
  if(!x.topologyLinks.every((l:unknown)=>isRecord(l)&&['proposed','reported','verified'].includes(String(l.status))&&['id','fromComponentId','fromPortId','toComponentId','toPortId'].every(k=>validString(l[k]))))return false;
  if(!x.protectionDevices.every((d:unknown)=>isRecord(d)&&validString(d.id)&&validString(d.consumerUnitId)&&validString(d.name)&&['rcd','mcb','rcbo','isolator','unknown'].includes(String(d.kind))&&(d.ratedCurrentA===null||validNonnegative(d.ratedCurrentA))&&(d.residualTripMa===null||validNonnegative(d.residualTripMa))&&validIdList(d.protectedCircuitIds)&&validEvidence(d.evidence)))return false;
  if(!x.socketAssignments.every((a:unknown)=>isRecord(a)&&['id','socketComponentId','positionId','loadId'].every(k=>validString(a[k]))&&validEvidence(a.evidence)))return false;
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
/** Merge new reference entries without overwriting changed user objects or profiles. */
export function migrateProject(x: unknown): Project | null {
  if(validateProject(x)) return x;
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
  return {...base,name:old.name,nominalBatteryVoltage:old.nominalBatteryVoltage,batteryCapacityAh:old.batteryCapacityAh,
    inverterEfficiency:old.inverterEfficiency,profiles:old.profiles,components,circuits,loads};
}
export function loadProject(): Project {
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw){const p=migrateProject(JSON.parse(raw) as unknown);if(p)return p;}
    const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);
    if(legacy){const p=migrateProject(JSON.parse(legacy) as unknown);if(p)return p;}
  }catch{/* Invalid/unavailable browser storage: retain demo. */}
  return structuredClone(seedProject);
}
export function saveProject(project: Project): boolean {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(project));return true;}
  catch{return false;}
}
