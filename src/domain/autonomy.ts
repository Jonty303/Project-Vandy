import type { AutonomySettings, Project } from './model.ts';
import { calculateProject } from './calculations.ts';
import { activeBankSummary, batteryCapacityForPlanning } from './batteries.ts';

export const DEFAULT_AUTONOMY: AutonomySettings = {
  startingSocPct: 90, reserveSocPct: 20,
  hoursDrivingPerDay: 1, availableAlternatorA: null,
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
/** Explain exactly why a scenario cannot be rated, or why its output is provisional. */
export interface AutonomyReason {
  id: string;
  category: 'consumer' | 'battery' | 'solar' | 'driving' | 'topology';
  title: string;
  detail: string;
  action: string;
}
export interface AutonomyProjection {
  /** Affect both stationary and driving endurance and prevent a defensible rating. */
  ratingBlockers: AutonomyReason[];
  /** Only prevent a daily-driving endurance result, not the stationary calculation. */
  drivingBlockers: AutonomyReason[];
  /** Assumptions that limit confidence even if every essential value is present. */
  provisionalReasons: AutonomyReason[];
  profileName: string;
  solarMonthName: string;
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
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const evidenceLabels:Record<string,string>={
  measured:'measured',manual:'manufacturer manual',reported:'owner reported',
  listing:'online listing',estimated:'estimated',unknown:'unknown'
};
function detailIssues(project:Project,profileId:string,results:ReturnType<typeof calculateProject>):AutonomyReason[] {
  const reasons:AutonomyReason[]=[];
  for(const c of results.circuitResults) {
    const circuit=project.circuits.find(x=>x.id===c.circuitId);
    for(const item of c.loads) {
      if(!item.incomplete)continue;
      const load=project.loads.find(x=>x.id===item.loadId);
      if(!load)continue;
      for(const issue of item.issues) {
        const missing=issue.startsWith('Missing power rating');
        const mode=missing?load.modes.find(m=>issue.includes(m.name)):undefined;
        const usage=mode?.usage[profileId];
        const context=usage?`Scheduled for ${usage.minutesPerDay} minutes/day in this profile`:'';
        reasons.push({
          id:`load:${load.id}:${issue}`,category:'consumer',
          title:`${load.name} — ${missing?'power rating missing':issue}`,
          detail:`${circuit?.name??'Unassigned circuit'}${mode?` / ${mode.name}`:''}. ${context}`.trim(),
          action:missing?
            load.kind==='led-strip'?'Circuits & loads → enter the strip length and rated watts/metre.':
            'Circuits & loads → enter the appliance watts for this operating mode (or set its usage to zero if it is not used).':
            'Circuits & loads → correct the voltage, usage or converter assumption for this consumer.'
        });
      }
    }
  }
  return reasons;
}
function provisionalIssues(project:Project,profileId:string,cfg:AutonomySettings,solarSource:string):AutonomyReason[]{
  const reasons:AutonomyReason[]=[];
  const ratedButUnverified=project.loads.flatMap(load=>load.modes.filter(mode=>{
    const u=mode.usage[profileId];
    return u && u.minutesPerDay>0 && u.dutyFraction>0 && mode.watts!==null &&
      !['manual','measured'].includes(mode.evidence);
  }).map(mode=>`${load.name} (${evidenceLabels[mode.evidence]??mode.evidence})`));
  if(ratedButUnverified.length)reasons.push({
    id:'unverified-ratings',category:'consumer',title:`${ratedButUnverified.length} active power ratings are not measured or manufacturer-confirmed`,
    detail:ratedButUnverified.join('; '),
    action:'Circuits & loads → replace provisional ratings with measured watts or manufacturer specifications where possible.'
  });
  const fridge=project.loads.find(l=>l.id==='fridge');
  const fridgeMode=fridge?.modes.find(m=>m.id==='compressor');
  if(fridgeMode && (fridgeMode.usage[profileId]?.minutesPerDay??0)>0 &&
      fridgeMode.usage[profileId]?.dutyFraction===0.35) reasons.push({
    id:'fridge-duty',category:'consumer',title:'Fridge duty cycle remains the 35% planning assumption',
    detail:'Actual compressor run time depends on ambient temperature, thermostat settings and ventilation.',
    action:'Measure or refine the fridge duty cycle in Circuits & loads.'
  });
  reasons.push({
    id:'solar-method',category:'solar',title:cfg.solarManualWhPerDay!==null?'Solar uses a user-entered daily estimate':cfg.solarClimatology?'Solar uses historical monthly averages':'Solar estimate awaits user-supplied data',
    detail:`${solarSource} for ${monthNames[cfg.solarMonth-1]??'selected month'}. Not a weather forecast or guaranteed battery charge.`,
    action:'Adjust the month and losses; confirm the installed panel, orientation, shade and MPPT behaviour.'
  });
  if(cfg.hoursDrivingPerDay>0)reasons.push({
    id:'driving-assumptions',category:'driving',title:'Driving charge assumes stable alternator spare current and battery acceptance',
    detail:`Estimated ${Math.round(cfg.dcDcEfficiency*100)}% efficiency and ${Math.round(cfg.dcDcActiveFraction*100)}% charging-active time; neither guarantees real-world charging.`,
    action:'Check Orion XS input/output limits and monitor charge current during a typical journey.'
  });
  reasons.push({
    id:'nominal-battery',category:'battery',title:'Battery reserve uses nominal Ah and user-entered SOC',
    detail:`Nominal ${project.batteryCapacityAh??'unknown'}Ah; starting ${cfg.startingSocPct}% and reserve ${cfg.reserveSocPct}%. Battery health, temperature and charge taper are not modelled.`,
    action:'Check actual usable capacity and state of charge against your battery monitor.'
  });
  return reasons;
}
export function projectAutonomy(project:Project,profileId:string):AutonomyProjection {
  const cfg=autonomySettings(project);
  const bank=activeBankSummary(project);
  const effectiveCapacityAh=batteryCapacityForPlanning(project);
  // Off-grid autonomy always assumes the inverter makes AC, regardless of dashboard shore scenario.
  const load=calculateProject({...project,acOperatingMode:'inverter'},profileId);
  const warnings:string[]=[];
  const ratingBlockers=detailIssues(project,profileId,load);
  const drivingBlockers:AutonomyReason[]=[];
  const profileName=project.profiles.find(p=>p.id===profileId)?.name??profileId;
  const solarMonthName=monthNames[cfg.solarMonth-1]??'Unknown month';
  if(load.incompleteLoads.length)warnings.push('Some active consumers lack verified ratings. Autonomy figures are incomplete and may be optimistic.');
  if(load.warnings.some(w=>/No valid logical path/.test(w)))warnings.push('AC supply path contains unresolved topology relationships.');
  if(!valid(effectiveCapacityAh))warnings.push('Active battery-bank capacity is unknown or invalid.');
  if(cfg.startingSocPct<cfg.reserveSocPct)warnings.push('Starting state of charge is below the configured minimum reserve.');
  const usable=valid(effectiveCapacityAh)?effectiveCapacityAh*project.nominalBatteryVoltage*
    Math.max(0,cfg.startingSocPct-cfg.reserveSocPct)/100:null;
  const solar=estimateSolarWh(cfg);
  const dc=dcDcEstimate(cfg,project.nominalBatteryVoltage);
  warnings.push(...dc.notes);
  if(!valid(effectiveCapacityAh) || effectiveCapacityAh<=0)ratingBlockers.push({
    id:'battery-capacity',category:'battery',title:'Usable battery capacity is not available',
    detail:'The active battery bank must have sufficient battery voltage and Ah ratings for its series/parallel layout. Unknown is allowed in the battery inventory but not in an endurance rating.',
    action:'Batteries & BMS → enter rated Ah and voltage for every battery in the active bank, or select no bank to use the legacy project capacity.'
  });
  if(bank && (bank.nominalVoltageV===null||bank.nominalVoltageV!==project.nominalBatteryVoltage)){
    ratingBlockers.push({id:'bank-voltage',category:'battery',
      title:bank.nominalVoltageV===null?'Battery-bank voltage is unknown':'Battery bank and system voltage do not match',
      detail:bank.nominalVoltageV===null?'At least one series battery has no rated voltage.':
        `Bank ${bank.nominalVoltageV}V versus configured ${project.nominalBatteryVoltage}V system. Do not assume conversion.`,
      action:'Batteries & BMS → confirm series-string voltages, then Project settings → confirm nominal system voltage.'
    });
  }
  if(!Number.isFinite(cfg.startingSocPct)||!Number.isFinite(cfg.reserveSocPct) ||
    cfg.startingSocPct<0||cfg.startingSocPct>100||cfg.reserveSocPct<0||cfg.reserveSocPct>100)ratingBlockers.push({
    id:'soc-invalid',category:'battery',title:'Battery SOC settings are invalid',
    detail:'Starting and minimum reserve percentages must each be between 0% and 100%.',
    action:'Off-grid autonomy → Battery reserve → correct starting and reserve SOC.'
  });
  if(solar.wh===null){
    warnings.push('Solar contribution is unknown until PVGIS data or a manual estimate is supplied.');
    ratingBlockers.push({
      id:'solar-missing',category:'solar',title:'Solar recharge is not known',
      detail:solar.source,
      action:'Off-grid autonomy → Solar → Fetch solar estimates, or supply an explicitly estimated daily Wh figure.'
    });
  }
  if(dc.wh===null && cfg.hoursDrivingPerDay>0){
    drivingBlockers.push({
      id:'driving-inputs',category:'driving',title:cfg.availableAlternatorA===null?
        'Spare alternator current has not been entered':'DC-DC charging cannot be calculated',
      detail:dc.notes.join(' ') || 'Check the DC-DC charger model and operating parameters.',
      action:'Off-grid autonomy → DC-DC charging → enter measured or estimated spare input amps and verify the installed charger.'
    });
  }
  const provisionalReasons=provisionalIssues(project,profileId,cfg,solar.source);
  if(bank)provisionalReasons.push({
    id:'bank-source',category:'battery',title:'Capacity comes from the active battery-bank record',
    detail:`${bank.capacityAh??'Unknown'}Ah nominal; ${bank.nominalVoltageV??'Unknown'}V. Legacy project Ah is not used when an active bank is configured.`,
    action:'Batteries & BMS → confirm the bank components and their evidence.'
  });
  const stationaryNet=solar.wh===null?null:load.batteryWh-solar.wh;
  const drivingNet=stationaryNet===null||dc.wh===null?null:stationaryNet-dc.wh;
  const stationary=days(usable,stationaryNet),driving=days(usable,drivingNet);
  return {ratingBlockers,drivingBlockers,provisionalReasons,profileName,solarMonthName,
    dailyDemandWh:load.batteryWh,solarWh:solar.wh,drivingWh:dc.wh,
    stationaryNetWh:stationaryNet,drivingNetWh:drivingNet,batteryUsableWh:usable,
    stationaryDays:stationary.days,drivingDays:driving.days,stationaryStatus:stationary.status,
    drivingStatus:driving.status,incomplete:load.incompleteLoads.length>0,warnings};
}
