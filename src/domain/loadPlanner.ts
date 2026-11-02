/** Focused load-side daily planner. No battery, inverter, or wiring assumptions. */
export type Voltage = 12 | 24 | 230;
export type Category = 'standard' | 'led' | 'fridge' | 'diesel';
export type Control = 'direct' | 'remote6';
export type PlannerCircuit = {
  id: string; name: string; voltage: Voltage;
  physicalSwitch: boolean; control: Control;
};
export type PlannerLoad = {
  id: string; name: string; circuitId: string; voltage: Voltage; category: Category;
  ratingUnit: 'W' | 'A'; rating: number | null; quantity: number;
  length: number | null; hours: number | null; notes: string;
  basis: string; sourceUrl: string;
  /** Retained only for a possible future seasonal feature; not used in totals. */
  legacySeasonal?: unknown;
};
export type Planner = { version: 2; circuits: PlannerCircuit[]; loads: PlannerLoad[] };
export type Template = {
  name: string; category: Category; voltage: Voltage; watts: number; hours: number;
  length?: number; quantity?: number; basis: string; sourceUrl?: string;
};
export const blankPlanner = (): Planner => ({version:2,circuits:[],loads:[]});
export const uid = () => crypto.randomUUID();
export const newCircuit = (): PlannerCircuit => ({
  id:uid(),name:'',voltage:12,physicalSwitch:false,control:'direct',
});
/** Remote control replaces, rather than adds to, physical on/off switch topology.
 * The raw switch preference is retained if a circuit changes back to direct.
 */
export const effectivePhysicalSwitch = (c:PlannerCircuit):boolean =>
  c.control==='direct' && c.physicalSwitch;

/** Watt figures are average daily-planning inputs, not peak cable/fuse design loads.
 * Each entry identifies where it is manufacturer-confirmed vs a working estimate.
 */
export const catalogue:Template[] = [
  {name:'CR65X fridge',category:'fridge',voltage:12,watts:21,hours:24,
   basis:'Estimated day-average = 60 W model rated input x assumed 35% compressor duty. The CR65X 60 W rating is published by Alpicool (not Vitrifrigo); confirm the fitted fridge label/brand and measure actual duty. 21 W is NOT manufacturer-verified average.',sourceUrl:'https://www.alpicool.com/product-207.html'},
  {name:'VEVOR diesel heater',category:'diesel',voltage:12,watts:40,hours:4,
   basis:'40 W is published electrical rating for XMZ-F-D1 family, used provisionally as average. Startup/shutdown peaks are omitted from daily estimate, not from eventual wiring/protection design. Measure real average and do not disconnect electrical power while shutting down.',sourceUrl:'https://www.gov.uk/product-safety-alerts-reports-recalls/product-safety-report-vevor-diesel-heater-2511-0312'},
  {name:'Gas water heater (12 V input)',category:'standard',voltage:12,watts:60,hours:0.2,
   basis:'Owner-reported 12 V / 5 A nominal maximum, provisionally treated as average while active. 12 minutes/day is estimated. Gas heating energy excluded.'},
  {name:'Floor LED strip',category:'led',voltage:12,watts:5,length:2,hours:5,
   basis:'Estimate: 5 W/m at typical brightness, 2 m, 5 hours/day. Use the actual strip specification and typical dimming.'},
  {name:'Kitchen LED strip',category:'led',voltage:12,watts:5,length:1.5,hours:3,
   basis:'Estimate: 5 W/m at typical brightness, 1.5 m, 3 hours/day.'},
  {name:'Toilet LED strip',category:'led',voltage:12,watts:5,length:1,hours:0.2,
   basis:'Estimate: 5 W/m, 1 m, 12 minutes/day. Distinct from the floor light.'},
  {name:'Main lights',category:'standard',voltage:12,watts:8,hours:4,basis:'Working estimate for lights used simultaneously; inspect LEDs.'},
  {name:'Outside light',category:'standard',voltage:12,watts:5,hours:1,basis:'Working estimate of typical daily draw.'},
  {name:'Garage light',category:'standard',voltage:12,watts:5,hours:0.25,basis:'Working estimate; 15 minutes/day.'},
  {name:'Maxxair roof vent',category:'standard',voltage:12,watts:8.4,hours:4,
   basis:'Illustrative 50% fan speed of MaxxFan Deluxe: 0.70 A at 12 V, giving 8.4 W. Exact fitted model and usual setting unverified.',sourceUrl:'https://files.ekmcdn.com/grasshopper/resources/other/maxxfan-deluxe-amp-draw.pdf'},
  {name:'Water pump',category:'standard',voltage:12,watts:48,hours:0.2,basis:'Estimate: 4 A water pump, running 12 minutes/day. Confirm the actual motor model.'},
  {name:'Thetford toilet flush control',category:'standard',voltage:12,watts:5,hours:0.05,
   basis:'Placeholder for standalone toilet flush electrical draw. If it activates the main water pump, avoid counting pump energy here and under Water pump.'},
  {name:'USB socket 1 (idle draw)',category:'standard',voltage:12,watts:0.5,hours:24,
   basis:'Estimated idle consumption of an energised USB charging panel; device-charging energy is counted separately.'},
  {name:'USB socket 2 (idle draw)',category:'standard',voltage:12,watts:0.5,hours:24,
   basis:'Estimated idle consumption only; do not use maximum advertised socket output as continuous draw.'},
  {name:'Cerbo GX',category:'standard',voltage:12,watts:2.8,hours:24,
   basis:'Manufacturer specification: Cerbo GX without GX Touch 2.8 W at 12 V. GX Touch increases consumption.',sourceUrl:'https://www.victronenergy.com/upload/documents/Datasheet-Cerbo-GX-GX-Touch-EN.pdf'},
  {name:'Starlink',category:'standard',voltage:230,watts:85,hours:4,
   basis:'Provisional AC average for newer Starlink Standard 4/4X (manufacturer 75-100 W including router and supply). Model not confirmed. Inverter losses are excluded.',sourceUrl:'https://starlink.com/support/article/18836c7e-2d97-6153-fe67-c18427bd0558'},
  {name:'Laptop charger',category:'standard',voltage:230,watts:50,hours:5,
   basis:'Estimate of actual wall input while working. Your 80 W adaptor rating is capacity, not measured average. Inverter losses excluded.'},
  {name:'Hob igniter',category:'standard',voltage:230,watts:10,hours:0.02,
   basis:'Illustrative brief ignition event. Check whether fitted igniter actually draws from 230 V. Gas heat excluded.'},
  {name:'Phone charging',category:'standard',voltage:12,watts:12,hours:1.5,quantity:2,
   basis:'Estimated charging energy for two phones at roughly 80% daily replenishment; includes average conversion loss only implicitly. Avoid double-counting USB socket output.'},
  {name:'Tablet charging',category:'standard',voltage:12,watts:15,hours:1.5,
   basis:'Estimated average charging input for roughly 80% replenishment/day.'},
  {name:'Custom load',category:'standard',voltage:12,watts:10,hours:1,
   basis:'Illustrative initial values only (10 W for 1 hour); replace both with actual values.'},
];
export function newLoad(template:Template,circuitId=''):PlannerLoad {
  return {id:uid(),name:template.name==='Custom load'?'':template.name,circuitId,
    voltage:template.voltage,category:template.category,ratingUnit:'W',rating:template.watts,
    quantity:template.quantity??1,length:template.category==='led'?template.length??1:null,
    hours:template.hours,notes:'',basis:template.basis,sourceUrl:template.sourceUrl??''};
}
const valid = (v:unknown,max=Number.MAX_VALUE):v is number =>
  typeof v==='number' && Number.isFinite(v) && v>=0 && v<=max;
export function loadEnergy(l:PlannerLoad) {
  const issues:string[]=[];
  let watts:number|null=valid(l.rating)?(l.ratingUnit==='A'?l.rating*l.voltage:l.rating):null;
  if(l.category==='led')watts=watts!==null&&valid(l.length)?watts*l.length:null;
  if(watts===null)issues.push(l.category==='led'?'Enter average power per metre and length.':'Enter average power or current.');
  if(!valid(l.hours,24))issues.push('Enter typical hours per day (0-24).');
  if(!valid(l.quantity,10000)||l.quantity<1||!Number.isInteger(l.quantity))issues.push('Quantity must be a positive whole number.');
  if(![12,24,230].includes(l.voltage))issues.push('Select 12, 24 or 230 V.');
  const wh=issues.length?null:watts!*l.hours!*l.quantity;
  return {watts:watts===null?null:watts*l.quantity,amps:watts===null?null:watts*l.quantity/l.voltage,
    wh,ah:wh===null?null:wh/l.voltage,issues};
}
export function plannerTotal(p:Planner) {
  const results=p.loads.map(loadEnergy);
  return {wh:results.reduce((sum,r)=>sum+(r.wh??0),0),
    missing:results.filter(r=>r.wh===null).length,
    byVoltage:([12,24,230] as const).map(voltage=>({
      voltage,ah:p.loads.filter(l=>l.voltage===voltage).reduce((sum,l)=>sum+(loadEnergy(l).ah??0),0),
    }))};
}
export function isPlanner(x:unknown):x is Planner {
  if(!x||typeof x!=='object')return false;
  const p=x as Planner;
  if(p.version!==2||!Array.isArray(p.loads)||!Array.isArray(p.circuits))return false;
  const ids=new Set<string>();
  const numberOrNull=(n:unknown,max=Number.MAX_VALUE)=>n===null||valid(n,max);
  for(const c of p.circuits) {
    if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.name!=='string'
       ||![12,24,230].includes(c.voltage)||typeof c.physicalSwitch!=='boolean'
       ||!['direct','remote6'].includes(c.control))return false;
    ids.add(c.id);
  }
  for(const l of p.loads) {
    if(!l||typeof l.id!=='string'||!l.id||ids.has(l.id)
       ||typeof l.name!=='string'||typeof l.notes!=='string'
       ||typeof l.basis!=='string'||typeof l.sourceUrl!=='string'
       ||!['standard','led','fridge','diesel'].includes(l.category)
       ||!['W','A'].includes(l.ratingUnit)||![12,24,230].includes(l.voltage)
       ||typeof l.circuitId!=='string'
       ||(l.circuitId&&!p.circuits.some(c=>c.id===l.circuitId&&c.voltage===l.voltage))
       ||!valid(l.quantity,10000)||l.quantity<1||!Number.isInteger(l.quantity))return false;
    ids.add(l.id);
    if(!numberOrNull(l.rating)||!numberOrNull(l.hours,24)||!numberOrNull(l.length))return false;
  }
  return true;
}
/** Legacy import converts the selected older Summer profile into a single typical day,
 * retaining all original seasons for future explicit re-introduction.
 * Do not overwrite a current v2 record when migrating local storage.
 */
export function importPlanner(x:unknown):Planner|null {
  if(isPlanner(x))return x;
  if(!x||typeof x!=='object')return null;
  const old=x as {version?:unknown;loads?:unknown;circuits?:unknown};
  if(old.version!==1||!Array.isArray(old.loads)||!Array.isArray(old.circuits))return null;
  try {
    const circuits:PlannerCircuit[]=old.circuits.map((raw:unknown)=>{
      const c=raw as {id:string;name:string;voltage:Voltage};
      return {id:c.id,name:c.name,voltage:c.voltage,physicalSwitch:false,control:'direct'};
    });
    const loads:PlannerLoad[]=old.loads.map((raw:unknown)=>{
      const l=raw as {id:string;name:string;circuitId:string;voltage:Voltage;category:Category;
        rating:number|null;ratingUnit:'W'|'A';quantity:number;length:number|null;brightness:number|null;
        fridgeMode:'compressor'|'average';usage:Record<string,{hours:number|null;duty:number|null;cycles:number|null}>;
        startupWatts:number|null;startupMinutes:number|null;shutdownWatts:number|null;
        shutdownMinutes:number|null;notes:string};
      const u=l.usage?.Summer;
      let watts=l.rating===null?null:l.ratingUnit==='A'?l.rating*l.voltage:l.rating;
      let hours=u?.hours??null;
      if(l.category==='led'&&watts!==null)watts*=((l.brightness??100)/100);
      if(l.category==='fridge'&&l.fridgeMode==='compressor'&&watts!==null)watts*=((u?.duty??0)/100);
      if(l.category==='diesel'&&watts!==null&&hours!==null) {
        const cycles=u?.cycles??0;
        const extra=cycles*((l.startupWatts??0)*(l.startupMinutes??0)+(l.shutdownWatts??0)*(l.shutdownMinutes??0))/60;
        if(cycles>0&&(l.startupWatts===null||l.startupMinutes===null||l.shutdownWatts===null||l.shutdownMinutes===null)) {
          watts=null;
        } else if(hours>0) watts+=extra/hours;
        else if(extra>0){watts=extra;hours=1;}
      }
      return {id:l.id,name:l.name,circuitId:l.circuitId,voltage:l.voltage,category:l.category,
        rating:watts,ratingUnit:'W',quantity:l.quantity,length:l.length,hours,
        notes:l.notes,basis:'Migrated average from legacy Summer usage. Review power, duty, startup and daily hours.',
        sourceUrl:'',legacySeasonal:l};
    });
    const p:Planner={version:2,circuits,loads};
    return isPlanner(p)?p:null;
  } catch {return null;}
}
