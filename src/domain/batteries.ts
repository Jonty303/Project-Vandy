import type { BatteryBank, BatteryRecord, Project } from './model.ts';

export interface Diagnostic {
  field:string; level:'blocker'|'incomplete'|'warning'; message:string;
}
const positive=(n:number|null):n is number=>n!==null&&Number.isFinite(n)&&n>0;
const finite=(n:number|null):n is number=>n!==null&&Number.isFinite(n);
export function validateBattery(b:BatteryRecord):Diagnostic[]{
  const errors:Diagnostic[]=[];
  if(!b.name.trim())errors.push({field:'name',level:'blocker',message:'A name is required to identify this battery.'});
  const pos:(key:keyof BatteryRecord,label:string)=>void=(key,label)=>{
    const v=b[key];if(v!==null && typeof v==='number'&&(!Number.isFinite(v)||v<=0))
      errors.push({field:key,level:'blocker',message:`${label} must be positive or left unknown.`});
  };
  pos('nominalVoltageV','Nominal voltage');pos('capacityAh','Capacity');
  pos('weightKg','Weight');pos('maxChargeA','Charge limit');pos('maxDischargeA','Discharge limit');
  for(const [key,value] of Object.entries(b.dimensionsMm)){
    if(value!==null&&(!Number.isFinite(value)||value<=0))errors.push({field:'dimensions.'+key,level:'blocker',message:'Dimension must be positive or unknown.'});
  }
  for(const key of ['onC','offC','heaterWatts'] as const){
    const v=b.thermal[key];if(v!==null&&(!Number.isFinite(v)||(key==='heaterWatts'&&v<0)))
      errors.push({field:'thermal.'+key,level:'blocker',message:'Enter a valid heater value or leave it unknown.'});
  }
  if(b.thermal.onC!==null && b.thermal.offC!==null && b.thermal.onC>b.thermal.offC)
    errors.push({field:'thermal.offC',level:'blocker',message:'Heating switch-off temperature must be at or above switch-on temperature.'});
  for(const [a,c] of [['chargeMinC','chargeMaxC'],['dischargeMinC','dischargeMaxC']] as const){
    if(finite(b[a])&&finite(b[c])&&b[a]>b[c])errors.push({field:c,level:'blocker',message:'Maximum operating temperature cannot be below minimum.'});
  }
  if(b.nominalVoltageV===null)errors.push({field:'nominalVoltageV',level:'incomplete',message:'Voltage unknown: bank voltage and compatibility cannot be calculated.'});
  if(b.capacityAh===null)errors.push({field:'capacityAh',level:'incomplete',message:'Capacity unknown: bank Wh and off-grid autonomy cannot be rated.'});
  if(b.bms.bluetooth==='yes' && b.bms.externalManagement==='unverified')
    errors.push({field:'bms.externalManagement',level:'warning',message:'Bluetooth defaults to vendor-app-only. Do not assume external GX integration without documented support.'});
  if(b.thermal.selfHeating==='yes'&&b.thermal.heaterWatts===null)
    errors.push({field:'thermal.heaterWatts',level:'incomplete',message:'Self-heating confirmed but heater draw unknown; winter consumption remains incomplete.'});
  if(b.thermal.lowTemperatureChargeCutoff==='unknown')
    errors.push({field:'thermal.lowTemperatureChargeCutoff',level:'incomplete',message:'Low-temperature charge protection not documented.'});
  return errors;
}
export interface BankSummary {
  id:string; nominalVoltageV:number|null; capacityAh:number|null; nominalWh:number|null;
  diagnostics:Diagnostic[];
}
export function summarizeBank(project:Project,bank:BatteryBank):BankSummary{
  const diagnostics:Diagnostic[]=[];
  if(!bank.name.trim())diagnostics.push({field:'name',level:'blocker',message:'Bank name is required.'});
  if(bank.strings.length===0||bank.strings.some(s=>s.length===0))
    diagnostics.push({field:'strings',level:'incomplete',message:'This bank has no complete series strings yet. You may save it, but nominal capacity and autonomy remain unknown.'});
  const used=new Set<string>();
  const lengths=new Set(bank.strings.map(s=>s.length));
  if(lengths.size>1)diagnostics.push({field:'strings',level:'blocker',message:'Parallel strings must have matching series counts.'});
  const strings=bank.strings.map((string,index)=>{
    const batteries=string.map(id=>{
      if(used.has(id))diagnostics.push({field:'strings',level:'blocker',message:`Battery ${id} is used more than once in this bank.`});
      used.add(id);
      const found=project.batteries.find(b=>b.id===id);
      if(!found)diagnostics.push({field:'strings',level:id===''?'incomplete':'blocker',
        message:id===''?'A series position is unassigned; this draft bank can be saved but not rated.':`Bank references missing battery ${id}.`});
      return found;
    });
    const volts=batteries.every(b=>b&&positive(b.nominalVoltageV))?batteries.reduce((n,b)=>n+b!.nominalVoltageV!,0):null;
    const capacities=batteries.map(b=>b?.capacityAh);
    const cap=capacities.every(c=>c!==null&&c!==undefined&&positive(c))?Math.min(...(capacities as number[])):null;
    if(capacities.filter(c=>positive(c??null)).length>1&&new Set(capacities).size>1)
      diagnostics.push({field:'strings',level:'warning',message:`Series string ${index+1} contains unequal Ah ratings. Using the lowest rating for planning, not asserting electrical compatibility.`});
    if(batteries.some(b=>!b||b.capacityAh===null||b.nominalVoltageV===null))
      diagnostics.push({field:'strings',level:'incomplete',message:`Series string ${index+1} has missing battery voltage/capacity.`});
    return {volts,cap};
  });
  const volts=strings.length&&strings.every(s=>s.volts!==null)&&new Set(strings.map(s=>s.volts)).size===1?strings[0].volts:null;
  if(strings.length>1&&new Set(strings.map(s=>s.volts).filter(v=>v!==null)).size>1)
    diagnostics.push({field:'strings',level:'blocker',message:'Parallel strings must have matching nominal voltages.'});
  if(strings.length>1&&new Set(strings.map(s=>s.cap).filter(v=>v!==null)).size>1)
    diagnostics.push({field:'strings',level:'warning',message:'Parallel strings have different capacities; validate manufacturer mixing rules.'});
  const ah=strings.every(s=>s.cap!==null)&&strings.length?strings.reduce((total,s)=>total+s.cap!,0):null;
  return {id:bank.id,nominalVoltageV:volts,capacityAh:ah,nominalWh:volts!==null&&ah!==null?volts*ah:null,diagnostics};
}
export function activeBankSummary(project:Project):BankSummary|null{
  const bank=project.batteryBanks.find(b=>b.id===project.activeBatteryBankId);
  return bank?summarizeBank(project,bank):null;
}
export function batteryCapacityForPlanning(project:Project):number|null{
  const bank=activeBankSummary(project);
  return bank?bank.diagnostics.some(d=>d.level==='blocker')?null:bank.capacityAh:project.batteryCapacityAh;
}
export const newBattery=(id:string):BatteryRecord=>({
  id,name:'New battery',manufacturer:'',model:'',chemistry:'unknown',componentId:undefined,
  nominalVoltageV:null,capacityAh:null,weightKg:null,
  dimensionsMm:{length:null,width:null,height:null},maxChargeA:null,maxDischargeA:null,
  chargeMinC:null,chargeMaxC:null,dischargeMinC:null,dischargeMaxC:null,
  bms:{integrated:'unknown',manufacturer:'',model:'',bluetooth:'unknown',vendorApp:'',
    externalManagement:'unverified',protocol:'',documentationUrl:'',cellVoltageMonitoring:'unknown',
    balancing:'unknown',alarms:'unknown',protectionNotes:''},
  thermal:{selfHeating:'unknown',control:'unknown',onC:null,offC:null,heaterWatts:null,
    source:'unknown',lowTemperatureChargeCutoff:'unknown',heatingStatusReported:'unknown'},
  evidence:'unknown',documentationUrl:'',notes:''
});
