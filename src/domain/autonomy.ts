import type { AutonomySettings, Project } from './model.ts';
import { calculateProject } from './calculations.ts';

export const DEFAULT_AUTONOMY: AutonomySettings = {
  startingSocPct: 90, reserveSocPct: 20,
  hoursDrivingPerDay: 0, availableAlternatorA: null,
  alternatorVoltageV: 13.8, dcDcInputCurrentLimitA: 50,
  dcDcOutputCurrentLimitA: 50, dcDcOutputVoltageV: 14.2,
  dcDcEfficiency: 0.95, dcDcActiveFraction: 0.8,
  solarPanelWatts: 450, mpptNominalPvLimitWatts: 700,
  solarLossPct: 14, solarShadingFraction: 1,
  solarInclinationDeg: 0, solarAspectDeg: 0,
  solarMode: 'uk-reference', solarLocationName: 'UK illustrative five-region reference',
  solarLatitude: 53.8, solarLongitude: -1.55,
  solarMonth: 6, solarManualWhPerDay: null
};
export const UK_REFERENCE_REGIONS = [
  {name:'Glasgow',lat:55.864,lon:-4.252},
  {name:'Leeds',lat:53.8,lon:-1.549},
  {name:'Birmingham',lat:52.486,lon:-1.89},
  {name:'Bristol',lat:51.455,lon:-2.588},
  {name:'London',lat:51.507,lon:-0.128},
] as const;
export const LOCATION_PRESETS = [
  {name:'Leeds / West Yorkshire',lat:53.8,lon:-1.549},
  {name:'Hull / East Yorkshire',lat:53.745,lon:-0.337},
  {name:'Edinburgh',lat:55.954,lon:-3.189},
  {name:'Inverness',lat:57.477,lon:-4.225},
  {name:'Ullapool',lat:57.897,lon:-5.161},
  {name:'Cairngorms / Aviemore',lat:57.195,lon:-3.825},
  {name:'Lake District / Keswick',lat:54.6,lon:-3.137},
  {name:'Cardiff',lat:51.481,lon:-3.18},
  {name:'London',lat:51.507,lon:-0.128},
] as const;

const valid = (n:number|null|undefined):n is number => n!==null && n!==undefined && Number.isFinite(n) && n>=0;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export function autonomySettings(project:Project):AutonomySettings { return {...DEFAULT_AUTONOMY,...project.autonomy}; }

export function solarFingerprint(settings:AutonomySettings):string {
  return JSON.stringify({
    mode:settings.solarMode,
    lat:settings.solarMode==='selected-location'?settings.solarLatitude:null,
    lon:settings.solarMode==='selected-location'?settings.solarLongitude:null,
    watts:settings.solarPanelWatts,
    limit:settings.mpptNominalPvLimitWatts,
    loss:settings.solarLossPct,
    angle:settings.solarInclinationDeg,
    aspect:settings.solarAspectDeg,
  });
}

export function estimateSolarWh(settings:AutonomySettings):{wh:number|null;source:string;stale:boolean}{
  if(settings.solarManualWhPerDay!==null) return {wh:valid(settings.solarManualWhPerDay)?settings.solarManualWhPerDay*clamp(settings.solarShadingFraction,0,1):null,
    source:'User-estimated daily PV yield (after shading adjustment)',stale:false};
  const data=settings.solarClimatology;
  const stale=!data || data.queryFingerprint!==solarFingerprint(settings);
  const month=settings.solarMonth-1;
  if(stale || !data || month<0||month>11 || data.monthlyDailyWh.length!==12 || !valid(data.monthlyDailyWh[month]))
    return {wh:null,source:'No current PVGIS estimate: request monthly solar data or provide a manual daily estimate.',stale};
  return {wh:data.monthlyDailyWh[month]*clamp(settings.solarShadingFraction,0,1),
    source:data.description+'; PVGIS historical typical month; shading factor applied',stale:false};
}
export interface DcDcEstimate { wh:number|null; outputW:number|null; notes:string[] }
/** Power-limited estimate. Input current and 50A output current are not interchangeable. */
export function dcDcEstimate(settings:AutonomySettings,nominalBatteryVoltage:12|24):DcDcEstimate {
  const notes:string[]=[];
  if(settings.hoursDrivingPerDay<=0)return {wh:0,outputW:0,notes};
  if(!valid(settings.availableAlternatorA))return {wh:null,outputW:null,notes:['Enter *spare* alternator amps available to the DC-DC charger (not the alternator nameplate rating).']};
  if(nominalBatteryVoltage!==12){notes.push('The installed Orion XS 12/12-50 is not a 24V charger; a matching DC-DC device must be selected.');return {wh:null,outputW:null,notes};}
  const inputW=Math.min(settings.availableAlternatorA,settings.dcDcInputCurrentLimitA)*settings.alternatorVoltageV;
  const outputW=Math.min(inputW*settings.dcDcEfficiency,
    settings.dcDcOutputCurrentLimitA*settings.dcDcOutputVoltageV,700);
  const wh=Math.max(0,outputW)*clamp(settings.hoursDrivingPerDay,0,24)*clamp(settings.dcDcActiveFraction,0,1);
  notes.push('Assumes charger current limits, spare input current, battery acceptance and active-running fraction; smart alternator and BMS behaviour are not predicted.');
  return {wh,outputW,notes};
}
export interface AutonomyProjection {
  dailyDemandWh:number;
  solarWh:number|null;
  drivingWh:number|null;
  stationaryNetWh:number|null;
  drivingNetWh:number|null;
  batteryUsableWh:number|null;
  stationaryDays:number|null;
  drivingDays:number|null;
  stationaryStatus:'unknown'|'depleting'|'no-average-depletion';
  drivingStatus:'unknown'|'depleting'|'no-average-depletion';
  incomplete:boolean;
  warnings:string[];
}
function days(usable:number|null,net:number|null):{days:number|null;status:AutonomyProjection['stationaryStatus']} {
  if(usable===null||net===null||usable<0)return {days:null,status:'unknown'};
  if(net<=0)return {days:null,status:'no-average-depletion'};
  return {days:usable/net,status:'depleting'};
}
export function projectAutonomy(project:Project,profileId:string):AutonomyProjection {
  const cfg=autonomySettings(project);
  // Off-grid autonomy always assumes the inverter makes AC, regardless of dashboard shore scenario.
  const load=calculateProject({...project,acOperatingMode:'inverter'},profileId);
  const warnings:string[]=[];
  if(load.incompleteLoads.length)warnings.push('Some active consumers lack verified ratings. Autonomy figures are incomplete and may be optimistic.');
  if(load.warnings.some(w=>/No valid logical path/.test(w)))warnings.push('AC supply path contains unresolved topology relationships.');
  if(!valid(project.batteryCapacityAh))warnings.push('Battery capacity is unknown.');
  if(cfg.startingSocPct<cfg.reserveSocPct)warnings.push('Starting state of charge is below the configured minimum reserve.');
  const usable=valid(project.batteryCapacityAh)?project.batteryCapacityAh*project.nominalBatteryVoltage*
    Math.max(0,cfg.startingSocPct-cfg.reserveSocPct)/100:null;
  const solar=estimateSolarWh(cfg);
  const dc=dcDcEstimate(cfg,project.nominalBatteryVoltage);
  warnings.push(...dc.notes);
  if(solar.wh===null)warnings.push('Solar contribution is unknown until PVGIS data or a manual estimate is supplied.');
  const stationaryNet=solar.wh===null?null:load.batteryWh-solar.wh;
  const drivingNet=stationaryNet===null||dc.wh===null?null:stationaryNet-dc.wh;
  const stationary=days(usable,stationaryNet),driving=days(usable,drivingNet);
  return {dailyDemandWh:load.batteryWh,solarWh:solar.wh,drivingWh:dc.wh,
    stationaryNetWh:stationaryNet,drivingNetWh:drivingNet,batteryUsableWh:usable,
    stationaryDays:stationary.days,drivingDays:driving.days,stationaryStatus:stationary.status,
    drivingStatus:driving.status,incomplete:load.incompleteLoads.length>0,warnings};
}
