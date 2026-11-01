import type { Component, DcCableRun, DcCablePolarity, PhysicalTerminal, Project, TerminalKind } from './model.ts';

/** Names are stable planning interfaces, not measured terminal locations or installation claims. */
export function defaultTerminals(component:Component):PhysicalTerminal[]{
  const terminals:PhysicalTerminal[]=[];
  const add=(id:string,label:string,kind:TerminalKind,role?:PhysicalTerminal['role'])=>{
    if(!terminals.some(t=>t.id===id))terminals.push({id,label,kind,role});
  };
  for(const g of component.groundingTerminals??[])
    add(g.id,g.label,g.kind==='pe'?'protective-earth':'chassis');
  const positive=(id:string,label:string,role?:PhysicalTerminal['role'])=>add(id,label,'dc-positive',role);
  const negative=(id:string,label:string,role?:PhysicalTerminal['role'])=>add(id,label,'dc-negative',role);
  switch(component.id){
    case 'battery':case 'starter-battery':
      positive('positive','Battery positive (+)','bidirectional');
      negative('negative','Battery negative (−)','bidirectional');break;
    case 'isolator':
      positive('input-positive','Positive from main fuse','input');
      positive('output-positive','Positive to distribution','output');break;
    case 'lynx':
      positive('input-positive','Positive bus / battery feed','bidirectional');
      negative('negative-bus','Common negative bus','bidirectional');
      for(let n=1;n<=4;n++)positive('output-'+n+'-positive','Fused output '+n+' (+) — position provisional','bidirectional');
      break;
    case 'blue-sea':
      positive('input-positive','Main positive supply','input');
      negative('negative-bus','Common negative supply','bidirectional');
      for(let n=1;n<=12;n++){
        positive('fuse-'+n,'Fused output '+n+' (+) — assignment provisional','output');
        negative('return-'+n,'Negative return '+n+' (bus connection) — provisional','bidirectional');
      }
      break;
    case 'smartshunt':
      negative('battery-minus','BATTERY MINUS (battery-only side)','bidirectional');
      negative('system-minus','SYSTEM MINUS (load/charger side)','bidirectional');
      positive('positive-sense','Battery voltage sense (+), fused','input');break;
    case 'orion':
      positive('input-positive','Starter battery IN (+)','input');
      positive('output-positive','Habitation battery OUT (+)','output');
      negative('gnd','Orion XS common GND (return destination unknown)','bidirectional');break;
    case 'mppt':
      positive('pv-positive','PV input (+)','input');negative('pv-negative','PV input (−)','input');
      positive('battery-positive','Battery output (+)','bidirectional');negative('battery-negative','Battery output (−)','bidirectional');break;
    case 'multiplus':
      positive('battery-positive','Battery DC (+)','bidirectional');
      negative('battery-negative','Battery DC (−)','bidirectional');break;
    case 'remote-six':
      positive('input-positive','Controller supply (+)','input');
      negative('input-negative','Controller supply (−)','input');
      // Output switching topology and polarity are unconfirmed.
      for(let n=1;n<=6;n++)add('remote-'+n,'Channel '+n+' switched contact — polarity unknown','switch-contact','output');
      break;
    case 'votronic-1':case 'votronic-2':
      add('input-contact','Switch input contact — polarity unknown','switch-contact','input');
      add('output-contact','Switch output contact — polarity unknown','switch-contact','output');break;
    default:
      if(component.voltage===12||component.voltage===24||component.voltage==='12/24'){
        if(component.kind!=='bonding-busbar'&&component.kind!=='ground-point'){
          positive('supply-positive','DC supply (+) — terminal to confirm','input');
          negative('supply-negative','DC return (−) — terminal to confirm','input');
        }
      }
  }
  // An AC port group is NOT a cable. List each conductor contact separately.
  // Existing grounding terminals are intentionally not converted to DC negative.
  for(const port of component.ports??[]){
    if(port.system!=='ac')continue;
    const id=port.id;
    if(port.conductors.includes('L'))add(id+'-L',port.label+' — line (L)','ac-line',port.direction);
    if(port.conductors.includes('N'))add(id+'-N',port.label+' — neutral (N)','ac-neutral',port.direction);
    if(port.conductors.includes('PE'))add(id+'-PE',port.label+' — protective earth (PE)','protective-earth');
  }
  return terminals;
}

export const terminal=(project:Project,componentId:string,terminalId:string)=>
  project.components.find(c=>c.id===componentId)?.terminals?.find(t=>t.id===terminalId);
export const dcKind=(polarity:DcCablePolarity):TerminalKind=>
  polarity==='positive'?'dc-positive':polarity==='negative'?'dc-negative':'chassis';
export const acKind=(conductor:'L'|'N'|'PE'):TerminalKind=>
  conductor==='L'?'ac-line':conductor==='N'?'ac-neutral':'protective-earth';

/** A legacy run receives endpoint IDs only when its original component endpoints match.
 * Edited wiring is never silently reconnected to a guessed terminal.
 */
const seedRunEndpoints:Record<string,[string,string|undefined,string|undefined,string|undefined,string|undefined]>={
 'battery-fuse-isolator':['battery','isolator',undefined,'positive','input-positive'],
 'isolator-lynx':['isolator','lynx',undefined,'output-positive','input-positive'],
 'battery-shunt':['battery','smartshunt',undefined,'negative','battery-minus'],
 'shunt-lynx':['smartshunt','lynx',undefined,'system-minus','negative-bus'],
 'starter-orion':['starter-battery','orion',undefined,'positive','input-positive'],
 'orion-battery':['orion','battery',undefined,'output-positive','positive'],
 'orion-ground':['orion',undefined,undefined,'gnd',undefined],
 'lynx-remote':['lynx','remote-six',undefined,undefined,'input-positive'],
 'lynx-blue-sea':['lynx','blue-sea',undefined,'output-2-positive','input-positive'],
 'lynx-mppt':['lynx','mppt',undefined,undefined,'battery-positive'],
 'lynx-multi':['lynx','multiplus',undefined,undefined,'battery-positive']
};
for(let n=1;n<=12;n++){
  const circuits=['refrigeration','floor-lighting','toilet','water','diesel-heating','hot-water',
    'ventilation','usb-charging','kitchen-lighting','main-lighting','outside-lighting','garage-lighting'];
  seedRunEndpoints['dc-'+n+'-positive']=['blue-sea',undefined,circuits[n-1],'fuse-'+n,undefined];
  seedRunEndpoints['dc-'+n+'-negative']=['blue-sea',undefined,circuits[n-1],'return-'+n,undefined];
}
export function hydrateCableTerminals(run:DcCableRun):DcCableRun{
  const seed=seedRunEndpoints[run.id];
  if(!seed||run.fromTerminalId!==undefined||run.toTerminalId!==undefined)return run;
  const [from,to,circuit,fromTerminalId,toTerminalId]=seed;
  if(run.fromComponentId!==from||run.toComponentId!==to||run.toCircuitId!==circuit)return run;
  return {...run,...(fromTerminalId?{fromTerminalId}:{}),...(toTerminalId?{toTerminalId}:{})};
}
export function validateTerminals(project:Project):string[]{
 const issues:string[]=[];
 for(const c of project.components){
   const ids=new Set<string>();
   for(const t of c.terminals??[]){
     if(!t.id.trim()||!t.label.trim())issues.push(c.name+': terminal ID and label are required.');
     if(ids.has(t.id))issues.push(c.name+': duplicate terminal '+t.id+'.');
     ids.add(t.id);
   }
 }
 const ids=new Set(project.components.map(c=>c.id));
 for(const c of project.dcWiring?.cables??[]){
   if(!ids.has(c.fromComponentId))issues.push(c.id+': source device is missing.');
   if(c.toComponentId&&!ids.has(c.toComponentId))issues.push(c.id+': destination device is missing.');
   if(c.toCircuitId&&!project.circuits.some(x=>x.id===c.toCircuitId))issues.push(c.id+': destination circuit is missing.');
   if(c.toCircuitId&&c.toComponentId)issues.push(c.id+': conductor must target a device OR circuit, not both.');
   if(c.toTerminalId&&!c.toComponentId)issues.push(c.id+': destination terminal has no device.');
   const expected=dcKind(c.polarity);
   if(c.fromTerminalId&&terminal(project,c.fromComponentId,c.fromTerminalId)?.kind!==expected)
     issues.push(c.id+': source terminal is absent or incompatible with '+c.polarity+'.');
   if(c.toTerminalId&&c.toComponentId&&terminal(project,c.toComponentId,c.toTerminalId)?.kind!==expected)
     issues.push(c.id+': destination terminal is absent or incompatible with '+c.polarity+'.');
   if(c.toComponentId===c.fromComponentId)issues.push(c.id+': cable cannot connect a device to itself.');
 }
 const seenAc=new Set<string>();
 for(const c of project.acConductors??[]){
   const kind=acKind(c.conductor);
   const from=terminal(project,c.fromComponentId,c.fromTerminalId);
   const to=terminal(project,c.toComponentId,c.toTerminalId);
   if(!from||from.kind!==kind)issues.push(c.id+': AC source terminal is missing or not '+c.conductor+'.');
   if(!to||to.kind!==kind)issues.push(c.id+': AC destination terminal is missing or not '+c.conductor+'.');
   if(c.fromComponentId===c.toComponentId)issues.push(c.id+': AC conductor cannot join a device to itself.');
   if((c.fromComponentId&&c.toComponentId)&&(c.fromComponentId===c.toComponentId&&c.fromTerminalId===c.toTerminalId))
     issues.push(c.id+': AC self-loop.');
   const key=[c.fromComponentId+'/'+c.fromTerminalId,c.toComponentId+'/'+c.toTerminalId].sort().join('~');
   if(seenAc.has(key))issues.push(c.id+': duplicate AC conductor between the same terminals.');
   seenAc.add(key);
 }
 for(const c of project.circuits){
   const seen=new Set<string>();
   for(const a of c.switchAssignments??[]){
     const device=project.components.find(x=>x.id===a.componentId);
     if(!device||!(device.kind==='switch'||device.kind==='controller'))
       issues.push(c.name+': assigned switch/controller is missing.');
     else if(a.outputId&&!device.outputs?.some(o=>o.id===a.outputId))
       issues.push(c.name+': switch channel '+a.outputId+' is not present.');
     const key=a.componentId+'/'+(a.outputId??'');
     if(seen.has(key))issues.push(c.name+': duplicate switch assignment.');
     seen.add(key);
   }
 }
 return issues;
}
