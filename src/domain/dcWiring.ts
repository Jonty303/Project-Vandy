import type { DcCableRun, DcFuseRecord, DcWiringPlan, Project } from './model.ts';

/** This table is engineering planning only: nearest AWG with cross-sectional area >= the metric nominal. */
export const COPPER_SIZES=[
  {mm2:0.75,awg:'18',awgMm2:0.823},{mm2:1,awg:'16',awgMm2:1.31},
  {mm2:1.5,awg:'16',awgMm2:1.31},{mm2:2.5,awg:'12',awgMm2:3.31},
  {mm2:4,awg:'12',awgMm2:3.31},{mm2:6,awg:'10',awgMm2:5.26},
  {mm2:10,awg:'8',awgMm2:8.37},{mm2:16,awg:'4',awgMm2:21.2},
  {mm2:25,awg:'4',awgMm2:21.2},{mm2:35,awg:'2',awgMm2:33.6},
  {mm2:50,awg:'1/0',awgMm2:53.5},{mm2:70,awg:'2/0',awgMm2:67.4},
  {mm2:95,awg:'3/0',awgMm2:85.0},{mm2:120,awg:'4/0',awgMm2:107.2},
] as const;
const awgSizes=[{awg:'18',mm2:.823},{awg:'16',mm2:1.31},{awg:'14',mm2:2.08},
 {awg:'12',mm2:3.31},{awg:'10',mm2:5.26},{awg:'8',mm2:8.37},
 {awg:'6',mm2:13.3},{awg:'4',mm2:21.2},{awg:'2',mm2:33.6},
 {awg:'1',mm2:42.4},{awg:'1/0',mm2:53.5},{awg:'2/0',mm2:67.4},
 {awg:'3/0',mm2:85},{awg:'4/0',mm2:107.2}] as const;
const metricSeries=[0.75,1,1.5,2.5,4,6,10,16,25,35,50,70,95,120];
export function awgForMm2(areaMm2:number|null){
 if(areaMm2===null)return null;
 const result=awgSizes.find(g=>g.mm2>=areaMm2);
 return result?{awg:result.awg,actualMm2:result.mm2}:null;
}
/** Copper resistance at 20 C. Assumed both outgoing and return are equally long.
 * Length and current are user inputs, not an assessment of actual installation.
 */
export function voltageDropPct(lengthM:number,currentA:number,areaMm2:number,voltageV:number){
 return voltageV>0&&areaMm2>0&&lengthM>=0&&currentA>=0?
   100*(2*lengthM*currentA*.0175/areaMm2)/voltageV:null;
}
/** No cable ampacity assertion is possible without insulation, temperature, grouping,
 * installation method, upstream current limit, and fuse breaking-capacity checks.
 * Use a rough conservative design-current floor, manufacturer minimum, and 3% voltage-drop target.
 */
export function sizeCable(run:DcCableRun, fuseDesignEnvelopeA:number|null=null){
 const i=run.designCurrentA??fuseDesignEnvelopeA;
 if(i===null)return {mm2:null,awg:null,voltageDropPct:null,
   note:'Both load/design current and fuse envelope are unknown. No meaningful conductor estimate.'};

 const base=i<=5?1.5:i<=10?2.5:i<=16?4:i<=25?6:i<=40?10:i<=60?16:i<=80?25:i<=110?35:i<=150?50:i<=200?70:95;
 const neededDrop=run.voltageV>0?(2*run.lengthM*i*.0175)/(run.voltageV*.03):Infinity;
 const wanted=Math.max(base,run.manufacturerMinMm2??0,neededDrop);
 const mm2=metricSeries.find(s=>s>=wanted)??null;
 const awg=awgForMm2(mm2);
 return {mm2,awg,voltageDropPct:mm2?voltageDropPct(run.lengthM,i,mm2,run.voltageV):null,
   note:run.designCurrentA===null?'Provisional conductor floor based on the planned fuse rating, NOT the measured device current or approved cable ampacity.':'Provisional planning size only. Verify real load, copper conductor, installed ampacity, terminals, thermal derating, fuse coordination and short-circuit breaking capacity.'};
}
const fuse=(id:string,label:string,holder:string|null,slot:number|null,rating:number|null,form:DcFuseRecord['fuseForm'],
  placement:DcFuseRecord['placement'],near:string|null,status:DcFuseRecord['status'],
  confidence:DcFuseRecord['confidence'],notes:string,documentationUrl=''):DcFuseRecord=>({
   id,label,holderComponentId:holder,slot,ratingA:rating,fuseForm:form,placement,
   nearComponentId:near,status,confidence,documentationUrl,notes
 });
const cable=(id:string,name:string,from:string,to:string|undefined,circuit:string|undefined,
 polarity:DcCableRun['polarity'],current:number|null,min:number|null,fuseId:string|null,
 status:DcCableRun['status'],notes:string):DcCableRun=>({
   id,name,fromComponentId:from,toComponentId:to,toCircuitId:circuit,polarity,
   lengthM:1,lengthEvidence:'assumed',designCurrentA:current,manufacturerMinMm2:min,
   voltageV:12,fuseId,status,notes
 });
const orionDoc='https://www.victronenergy.com/media/pg/Orion_XS_12-12-50A_DC-DC_battery_charger/en/installation.html';
const mpptDoc='https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/installation.html';
const multiDoc='https://www.victronenergy.com/media/pg/MultiPlus_500VA_-_1600VA/en/installation.html';
export const initialWiringPlan:DcWiringPlan={
 notes:'Test-data plan: 1m one-way per conductor assumed, 12V battery system. Owner-reported battery paths; Lynx and Blue Sea slots are sequential placeholders, NOT confirmed physical slot order or installed fuse values. Validate actual installation separately.',
 fuses:[
  fuse('battery-main','Main habitation battery fuse',null,null,150,'inline','battery-end','battery','reported','owner-checked',
    'Owner confirms 150A between habitation battery positive and isolator. Actual fuse type and physical proximity need inspection.'),
  fuse('orion-in','Orion XS input protection',null,null,70,'inline','unconfirmed','starter-battery','reported','owner-checked',
    '70A checked by owner. Starter battery-end is recommended; actual physical location to be confirmed.',orionDoc),
  fuse('orion-out','Orion XS habitation output protection',null,null,70,'inline','unconfirmed','battery','reported','owner-checked',
    '70A checked by owner. Habitation battery-end is recommended; actual physical location to be confirmed.',orionDoc),
  fuse('lynx-1','Lynx 1 → remote controller','lynx',1,15,'MEGA','integrated-in-distributor','lynx','proposed','provisional',
    'Position numbering and remote controller current rating unverified. 15A is an illustrative placeholder; final sizing cannot be confirmed without device and cable data.'),
  fuse('lynx-2','Lynx 2 → Blue Sea ST Blade 5026','lynx',2,60,'MEGA','integrated-in-distributor','lynx','proposed','provisional',
    '60A provisional feed only. Requires verification against total simultaneous load, feeder cable ampacity, and the Blue Sea 100A total rating.'),
  fuse('lynx-3','Lynx 3 → SmartSolar 100/50','lynx',3,60,'MEGA','integrated-in-distributor','lynx','proposed','manufacturer-range',
    '60A is within documented 55–70A battery fuse range for MPPT 100/50. Installed position/rating not confirmed.',mpptDoc),
  fuse('lynx-4','Lynx 4 → MultiPlus 12/500/20','lynx',4,100,'MEGA','integrated-in-distributor','lynx','proposed','provisional',
    '100A provisional external branch fuse only, not the product internal 125A fuse. Check exact UK/230V model, surge profile, cable rating and manufacturer guidance.',multiDoc)
 ],
 cables:[
  cable('battery-fuse-isolator','Habitation battery positive → main isolator','battery','isolator',undefined,'positive',150,50,'battery-main','reported','Owner-reported 150A fuse before isolator. Device connection represented in logical order; fuse itself is an in-line intermediate.'),
  cable('isolator-lynx','Main isolator → Lynx battery positive bus','isolator','lynx',undefined,'positive',150,50,'battery-main','reported','Main battery DC feed; 1m is an assumed cable length, not an owner-confirmed length.'),
  cable('battery-shunt','Habitation battery negative → SmartShunt battery-minus','battery','smartshunt',undefined,'negative',150,50,null,'reported','Battery-only side of shunt; other battery-negative bypasses not verified.'),
  cable('shunt-lynx','SmartShunt system-minus → Lynx negative bus','smartshunt','lynx',undefined,'negative',150,50,null,'reported','Owner confirms this path; other charger returns must be checked for shunt SOC accuracy.'),
  cable('starter-orion','Starter battery → Orion XS input','starter-battery','orion',undefined,'positive',70,16,'orion-in','reported','Input fuse confirmed 70A; fuse physical distance from starter battery unknown. Manufacturer: 16mm² / AWG6 alternatives for <5m.'),
  cable('orion-battery','Orion XS output → habitation battery positive','orion','battery',undefined,'positive',70,16,'orion-out','reported','Habitation output direct battery positive, 70A fuse confirmed. Whether it bypasses isolator and where fuse is mounted need checking.'),
  cable('orion-ground','Orion XS GND return — destination unconfirmed','orion',undefined,undefined,'negative',70,16,null,'unknown','Do not assume chassis or Lynx negative: the owner has not confirmed the GND path.'),
  cable('lynx-remote','Lynx slot 1 → six-channel remote controller','lynx','remote-six',undefined,'positive',null,null,'lynx-1','reported','Owner confirms remote now occupies the former Orion Lynx position; slot number 1 is provisional. Manufacturer current ratings absent.'),
  cable('lynx-blue-sea','Lynx slot 2 → Blue Sea 5026 positive bus','lynx','blue-sea',undefined,'positive',60,16,'lynx-2','proposed','Historical sketch supports a DC distributor branch, but exact Lynx slot and installed fuse not confirmed.'),
  cable('lynx-mppt','Lynx slot 3 ↔ MPPT 100/50 battery connection','lynx','mppt',undefined,'positive',50,16,'lynx-3','proposed','Charging path is bidirectional electrically; fuse goes at battery/distribution source end. 60A fuse provisional.'),
  cable('lynx-multi','Lynx slot 4 ↔ MultiPlus 12/500/20 DC connection','lynx','multiplus',undefined,'positive',100,25,'lynx-4','proposed','100A external fuse proposed, manufacturer internal fuse is separate. Actual current and cable to be checked.'),
 ],
};
// The owner checked fuse ratings and electrical order, not the exact distance
// from either battery terminal. Keep observed location and recommended location
// independently; a fuse at the LOAD end does not protect the upstream cable.
for(const id of ['battery-main','orion-in','orion-out']){
 const f=initialWiringPlan.fuses.find(f=>f.id===id)!;
 f.placement='unconfirmed';
 f.nearComponentId=null;
 f.recommendedPlacement='battery-end';
 f.recommendedNearComponentId=id==='orion-in'?'starter-battery':'battery';
 f.relativeElectricalOrder=id==='battery-main'?'Habitation battery positive → 150A fuse → isolator → Lynx':
   id==='orion-in'?'Starter battery positive → 70A fuse → Orion XS IN':
   'Orion XS OUT → 70A fuse → habitation battery positive';
}
/** Sequential Blue Sea mapping is a layout assumption, not owner-confirmed placement. */
const branches=[
 {circuit:'refrigeration',label:'CR65X fridge',fuseA:10,loadA:5,minimum:2.5},
 {circuit:'floor-lighting',label:'Floor LED 2m',fuseA:5,loadA:1.6,minimum:1.5},
 {circuit:'toilet',label:'Bathroom LED 1m and toilet flush',fuseA:10,loadA:null,minimum:2.5},
 {circuit:'water',label:'Water pump',fuseA:15,loadA:null,minimum:4},
 {circuit:'diesel-heating',label:'Diesel heater (startup)',fuseA:25,loadA:20,minimum:6},
 {circuit:'hot-water',label:'Gas water heater electronics',fuseA:10,loadA:5,minimum:2.5},
 {circuit:'ventilation',label:'Roof ventilation',fuseA:10,loadA:null,minimum:2.5},
 {circuit:'usb-charging',label:'USB charging panels — shared branch unverified',fuseA:25,loadA:null,minimum:4},
 {circuit:'kitchen-lighting',label:'Kitchen LED 1.5m',fuseA:5,loadA:1.2,minimum:1.5},
 {circuit:'main-lighting',label:'Main lighting',fuseA:5,loadA:null,minimum:1.5},
 {circuit:'outside-lighting',label:'Sliding-door rain-gutter lighting',fuseA:5,loadA:null,minimum:1.5},
 {circuit:'garage-lighting',label:'Garage lighting',fuseA:5,loadA:null,minimum:1.5},
];
for(let i=0;i<branches.length;i++){
 const b=branches[i],n=i+1,id='blue-sea-'+n;
 initialWiringPlan.fuses.push(fuse(id,`Blue Sea slot ${n}: ${b.label}`,'blue-sea',n,b.fuseA,'ATO-ATC',
  'integrated-in-distributor','blue-sea','proposed','provisional',
  `Illustrative fused position, not physically verified. Fuse ${b.fuseA}A must be validated against actual load/inrush, cable ampacity and branch circuit capacity. Unconfirmed consumer wattage means a final rating cannot be calculated.`));
 initialWiringPlan.cables.push(cable(`dc-${n}-positive`,`Blue Sea ${n} → ${b.label}`,'blue-sea',undefined,b.circuit,
   'positive',b.loadA,b.minimum,id,'proposed','One-way 1m assumed. Matching negative return is separately recorded; actual switching/split points unverified.'));
 initialWiringPlan.cables.push(cable(`dc-${n}-negative`,`${b.label} → Blue Sea negative bus`,'blue-sea',undefined,b.circuit,
   'negative',b.loadA,b.minimum,null,'proposed','1m assumed negative return, not a confirmed physical route. For a common chassis return this needs correction.'));
}
export function effectiveWiring(project:Project):DcWiringPlan{
 return project.dcWiring??initialWiringPlan;
}
export interface WiringIssue {id:string;severity:'incomplete'|'warning'|'blocker';message:string}
export function validateWiring(plan:DcWiringPlan):WiringIssue[]{
 const errors:WiringIssue[]=[];
 const ids=new Set(plan.fuses.map(f=>f.id));
 for(const f of plan.fuses){
  if(f.ratingA!==null&&(!Number.isFinite(f.ratingA)||f.ratingA<=0))
   errors.push({id:f.id,severity:'blocker',message:'Fuse rating must be positive or unknown.'});
  if(f.holderComponentId==='blue-sea'&&(f.ratingA??0)>30)
   errors.push({id:f.id,severity:'blocker',message:'Blue Sea 5026 is limited to 30A per branch; select a lower fuse or different equipment.'});
  if(f.ratingA===null)errors.push({id:f.id,severity:'incomplete',message:'Fuse rating unknown; device cannot be approved.'});
  if(f.placement==='unconfirmed')errors.push({id:f.id,severity:'incomplete',message:'Fuse physical position relative to battery unconfirmed.'});
 }
 for(const c of plan.cables){
  if(!Number.isFinite(c.lengthM)||c.lengthM<=0)
    errors.push({id:c.id,severity:'blocker',message:'Cable length must be positive. Default 1m is available as a placeholder.'});
  if(c.designCurrentA!==null&&(!Number.isFinite(c.designCurrentA)||c.designCurrentA<0))
    errors.push({id:c.id,severity:'blocker',message:'Current must be nonnegative or unknown.'});
  if(c.manufacturerMinMm2!==null&&(!Number.isFinite(c.manufacturerMinMm2)||c.manufacturerMinMm2<=0))
    errors.push({id:c.id,severity:'blocker',message:'Manufacturer minimum cable area must be positive or unknown.'});
  if(c.fuseId && !ids.has(c.fuseId))errors.push({id:c.id,severity:'blocker',message:'Cable references a missing fuse.'});
  if(c.designCurrentA===null)errors.push({id:c.id,severity:'incomplete',message:'Load current unknown; selected conductor and fuse are provisional.'});
  if(c.lengthEvidence==='assumed')errors.push({id:c.id,severity:'incomplete',message:'Cable length is an assumed 1m until measured.'});
 }
 const blue=plan.fuses.filter(f=>f.holderComponentId==='blue-sea');
 if(blue.length>12||blue.some(f=>(f.slot??0)>12))
  errors.push({id:'blue-sea',severity:'blocker',message:'Blue Sea 5026 has 12 fused circuits.'});
 if(blue.reduce((sum,f)=>sum+(f.ratingA??0),0)>100)
  errors.push({id:'blue-sea',severity:'warning',message:'Sum of branch fuse ratings exceeds the block’s 100A aggregate rating. This is NOT proof of overload; verify simultaneous loads and upstream protection.'});
 return errors;
}
