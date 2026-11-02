/** Standalone appliance-side energy planner. No battery or conversion assumptions. */
export const seasons = ['Spring','Summer','Autumn','Winter'] as const;
export type Season = typeof seasons[number];
export type Category = 'standard'|'led'|'fridge'|'diesel';
export type Usage = {hours:number|null; duty:number|null; cycles:number|null};
export type PlannerLoad = {
  id:string; name:string; circuitId:string; voltage:12|24|230; category:Category;
  ratingUnit:'W'|'A'; rating:number|null; quantity:number;
  length:number|null; brightness:number|null; fridgeMode:'compressor'|'average';
  startupWatts:number|null; startupMinutes:number|null; shutdownWatts:number|null; shutdownMinutes:number|null;
  usage:Record<Season,Usage>; notes:string;
};
export type Planner = {version:1; circuits:{id:string;name:string;voltage:12|24|230}[]; loads:PlannerLoad[]};
export const blankPlanner = ():Planner=>({version:1,circuits:[],loads:[]});
export const uid = ()=>crypto.randomUUID();
export const catalogue = [
  {name:'Vitrifrigo CR65X fridge',category:'fridge',voltage:12},
  {name:'VEVOR diesel heater',category:'diesel',voltage:12},
  {name:'Gas water heater (electrical input)',category:'standard',voltage:12},
  ...['Floor LED strip','Kitchen LED strip','Toilet LED strip'].map(name=>({name,category:'led',voltage:12})),
  ...['Main lights','Outside light','Garage light','Maxxair roof vent','Water pump','Thetford toilet flush','Dual USB socket 1','Dual USB socket 2','Cerbo GX','Six-way remote controller'].map(name=>({name,category:'standard',voltage:12})),
  ...['Starlink','Laptop charger','Hob igniter'].map(name=>({name,category:'standard',voltage:230})),
  {name:'Phone charging',category:'standard',voltage:12},
  {name:'Tablet charging',category:'standard',voltage:12},
  {name:'Custom load',category:'standard',voltage:12},
] as {name:string;category:Category;voltage:12|24|230}[];
export function newLoad(template:typeof catalogue[number],circuitId=''):PlannerLoad {
  return {id:uid(),name:template.name==='Custom load'?'':template.name,circuitId,voltage:template.voltage,category:template.category,
    ratingUnit:'W',rating:null,quantity:1,length:null,brightness:100,fridgeMode:'compressor',
    startupWatts:null,startupMinutes:null,shutdownWatts:null,shutdownMinutes:null,
    usage:Object.fromEntries(seasons.map(s=>[s,{hours:null,duty:template.category==='fridge'?null:100,cycles:template.category==='diesel'?null:0}])) as Record<Season,Usage>,notes:''};
}
const valid=(v:unknown,max=Number.MAX_VALUE):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
export function loadEnergy(l:PlannerLoad,season:Season) {
  const u=l.usage[season]; const issues:string[]=[];
  let watts:number|null=null;
  if(valid(l.rating)) watts=l.ratingUnit==='A'?l.rating*l.voltage:l.rating;
  if(l.category==='led') watts=watts!==null&&valid(l.length)?watts*l.length:null;
  if(watts===null)issues.push(l.category==='led'?'Enter strip length and power per metre.':'Enter operating power or current.');
  if(!valid(u.hours,24))issues.push('Enter hours per day (0–24).');
  const needsDuty=l.category==='fridge'&&l.fridgeMode==='compressor';
  if(needsDuty&&!valid(u.duty,100))issues.push('Enter compressor duty cycle (0–100%).');
  if(l.category==='led'&&!valid(l.brightness,100))issues.push('Enter brightness (0–100%).');
  let transient=0;
  if(l.category==='diesel'){
    if(!valid(u.cycles,1000)||!Number.isInteger(u.cycles))issues.push('Enter whole start/stop cycles per day.');
    if(valid(u.cycles)&&u.cycles>0){
      if(!valid(l.startupWatts)||!valid(l.startupMinutes,1440)||!valid(l.shutdownWatts)||!valid(l.shutdownMinutes,1440))issues.push('Enter startup and shutdown power and duration.');
      else {
        transient=u.cycles*(l.startupWatts*l.startupMinutes+l.shutdownWatts*l.shutdownMinutes)/60;
        if(valid(u.hours)&&u.hours+u.cycles*(l.startupMinutes+l.shutdownMinutes)/60>24)issues.push('Running plus startup/shutdown time exceeds 24 hours.');
      }
    }
  }
  if(!valid(l.quantity,10000)||l.quantity<1||!Number.isInteger(l.quantity))issues.push('Quantity must be a positive whole number.');
  if(![12,24,230].includes(l.voltage))issues.push('Select 12, 24 or 230V.');
  const wh=issues.length?null:((watts! * u.hours! * (needsDuty?u.duty!/100:1) * (l.category==='led'?l.brightness!/100:1))+transient)*l.quantity;
  return {watts:watts===null?null:watts*l.quantity,amps:watts===null?null:watts*l.quantity/l.voltage,wh,ah:wh===null?null:wh/l.voltage,issues};
}
export function plannerTotal(p:Planner,s:Season){
  const results=p.loads.map(l=>loadEnergy(l,s));
  return {wh:results.reduce((n,r)=>n+(r.wh??0),0),missing:results.filter(r=>r.wh===null).length,
    byVoltage:([12,24,230] as const).map(voltage=>({voltage,ah:p.loads.filter(l=>l.voltage===voltage).reduce((n,l)=>n+(loadEnergy(l,s).ah??0),0)}))};
}
export function isPlanner(x:unknown):x is Planner {
  if(!x||typeof x!=='object')return false;
  const p=x as Planner;
  if(p.version!==1||!Array.isArray(p.loads)||!Array.isArray(p.circuits))return false;
  const ids=new Set<string>();
  const numberOrNull=(v:unknown,max=Number.MAX_VALUE)=>v===null||valid(v,max);
  for(const c of p.circuits){if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.name!=='string'||![12,24,230].includes(c.voltage))return false;ids.add(c.id);}
  for(const l of p.loads){
    if(!l||typeof l.id!=='string'||!l.id||ids.has(l.id)||typeof l.name!=='string'||typeof l.notes!=='string'||!['standard','led','fridge','diesel'].includes(l.category)||!['W','A'].includes(l.ratingUnit)||!['compressor','average'].includes(l.fridgeMode)||![12,24,230].includes(l.voltage)||typeof l.circuitId!=='string'||(l.circuitId&&!p.circuits.some(c=>c.id===l.circuitId&&c.voltage===l.voltage))||!valid(l.quantity,10000)||l.quantity<1||!Number.isInteger(l.quantity))return false;
    ids.add(l.id);
    if(!['rating','length','startupWatts','shutdownWatts'].every(k=>numberOrNull(l[k as keyof PlannerLoad])))return false;
    if(!numberOrNull(l.brightness,100)||!numberOrNull(l.startupMinutes,1440)||!numberOrNull(l.shutdownMinutes,1440))return false;
    if(!seasons.every(s=>l.usage?.[s]&&numberOrNull(l.usage[s].hours,24)&&numberOrNull(l.usage[s].duty,100)&&numberOrNull(l.usage[s].cycles,1000)&&(l.usage[s].cycles===null||Number.isInteger(l.usage[s].cycles))))return false;
  }
  return true;
}
