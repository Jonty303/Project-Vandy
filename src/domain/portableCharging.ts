import type { Circuit, PortableCharge, Project } from './model.ts';

/**
 * Device batteries store Wh, not charger wattage. "80% charge" means replacing
 * 80 percentage points of capacity; the user can change this assumption.
 * USB charging efficiency includes the USB-C converter and device charging losses.
 * AC inverter losses, if any, are accounted for separately in the source circuit.
 */
export function portableChargeEnergy(charge:PortableCharge, project:Project, profileId:string) {
  const issues:string[]=[];
  const events=charge.chargesPerDay[profileId]??0;
  const circuit: Circuit|undefined=project.circuits.find(c=>c.id===charge.circuitId);
  if(!Number.isFinite(events)||events<0||events>24)issues.push('Charges/day must be between 0 and 24.');
  if(!Number.isFinite(charge.rechargeFraction)||charge.rechargeFraction<=0||charge.rechargeFraction>1)
    issues.push('Charge replenishment fraction must be greater than 0% and at most 100%.');
  if(!Number.isFinite(charge.chargingEfficiency)||charge.chargingEfficiency<=0||charge.chargingEfficiency>1)
    issues.push('USB charging efficiency must be greater than 0% and at most 100%.');
  if(charge.batteryWh!==null&&(!Number.isFinite(charge.batteryWh)||charge.batteryWh<=0))
    issues.push('Battery capacity must be positive Wh or left unknown.');
  if(!circuit)issues.push('Select a valid supply circuit.');
  const active=Number.isFinite(events)&&events>0;
  if(active&&charge.batteryWh===null)issues.push('Battery capacity is unknown: daily charge energy cannot be rated.');
  if(circuit?.supply==='dc'&&circuit.voltage!==project.nominalBatteryVoltage&&active)
    issues.push('DC circuit voltage differs from the battery system; a converter is not verified.');
  if(circuit?.supply==='ac-inverter'&&project.acOperatingMode!=='shore'&&
      (!Number.isFinite(project.inverterEfficiency)||project.inverterEfficiency<=0||project.inverterEfficiency>1)&&active)
    issues.push('Invalid inverter efficiency.');
  const usable=issues.length===0&&charge.batteryWh!==null&&active;
  const deviceWh=usable?charge.batteryWh!*charge.rechargeFraction*events:0;
  const supplyWh=usable?deviceWh/charge.chargingEfficiency:0;
  let batteryWh=supplyWh;
  if(circuit?.supply==='ac-shore'||(circuit?.supply==='ac-inverter'&&project.acOperatingMode==='shore'))
    batteryWh=0;
  else if(circuit?.supply==='ac-inverter'&&usable)batteryWh=supplyWh/project.inverterEfficiency;
  return {id:charge.id,name:charge.name,circuitId:charge.circuitId,
    deviceWh,supplyWh,batteryWh,charges:events,peakWatts:null as number|null,
    incomplete:issues.length>0,issues};
}

export function portableChargingIssues(project:Project):string[]{
  const issues:string[]=[];
  const ids=new Set<string>();
  for(const c of project.portableCharges??[]){
    if(!c.name.trim())issues.push('A portable device needs a name.');
    if(ids.has(c.id))issues.push(`Duplicate charging device identifier: ${c.id}`);
    ids.add(c.id);
    if(!project.circuits.some(x=>x.id===c.circuitId))issues.push(`${c.name}: the source circuit no longer exists.`);
    if(c.batteryWh!==null&&(!Number.isFinite(c.batteryWh)||c.batteryWh<=0))
      issues.push(`${c.name}: capacity must be positive or unknown.`);
    if(!Number.isFinite(c.rechargeFraction)||c.rechargeFraction<=0||c.rechargeFraction>1)
      issues.push(`${c.name}: percent charged must be between 0 and 100 (not zero).`);
    if(!Number.isFinite(c.chargingEfficiency)||c.chargingEfficiency<=0||c.chargingEfficiency>1)
      issues.push(`${c.name}: charging efficiency must be between 0 and 100 (not zero).`);
    if(Object.values(c.chargesPerDay).some(v=>!Number.isFinite(v)||v<0||v>24))
      issues.push(`${c.name}: daily charge events must be between 0 and 24.`);
  }
  return issues;
}
const defaultUsage={normal:1,working:1,winter:1};
export const vandyPortableCharging:PortableCharge[]=[
  {id:'iphone-one',name:'iPhone 1',category:'iphone',batteryWh:15.5,batteryEvidence:'estimated',
    specificationUrl:'',rechargeFraction:.8,chargingEfficiency:.85,
    chargesPerDay:{...defaultUsage},circuitId:'usb-charging',
    notes:'Illustrative modern iPhone 15.5Wh, not a claim about the installed model. 0→80% once/day is an adjustable example.'},
  {id:'iphone-two',name:'iPhone 2',category:'iphone',batteryWh:15.5,batteryEvidence:'estimated',
    specificationUrl:'',rechargeFraction:.8,chargingEfficiency:.85,
    chargesPerDay:{...defaultUsage},circuitId:'usb-charging',
    notes:'Illustrative modern iPhone 15.5Wh. Set the actual model/capacity or daily charge count when known.'},
  {id:'ipad-one',name:'iPad',category:'ipad',batteryWh:28.93,batteryEvidence:'manual',
    specificationUrl:'https://www.apple.com/uk/ipad-11/specs/',
    rechargeFraction:.8,chargingEfficiency:.85,chargesPerDay:{...defaultUsage},circuitId:'usb-charging',
    notes:'28.93Wh is the documented battery capacity of the 11-inch iPad (A16), used as an example. Actual installed iPad model not confirmed.'},
];
