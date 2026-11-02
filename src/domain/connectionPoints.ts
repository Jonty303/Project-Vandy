/** Logical socket and shore-inlet planning. Never treats a receptacle as an energy load.
 * Consumer-unit roles are derived, not physical protection specifications.
 */
import type {Planner,PlannerCircuit,PlannerLoad} from './loadPlanner.ts';
import {activeInverter,assignmentFor} from './distribution.ts';

export type SocketKind='usb'|'uk-3pin';
export type CircuitSocket={
 id:string;name:string;kind:SocketKind;circuitId:string;positions:1|2;
};
export type ShoreInlet={id:string;name:string};
export type LoadSocketLink={loadId:string;socketId:string};
export type ConnectionPlan={
 sockets:CircuitSocket[];
 shoreInlet:ShoreInlet|null;
 loadSocketLinks:LoadSocketLink[];
};
export type ConnectionContext={circuits:PlannerCircuit[];loads:PlannerLoad[]};
export const blankConnections=():ConnectionPlan=>({
 sockets:[],shoreInlet:null,loadSocketLinks:[],
});
export const socketName=(kind:SocketKind,positions:1|2)=>
 kind==='usb'?(positions===2?'Dual USB charging socket':'USB charging socket'):
 (positions===2?'Double 3-pin socket':'Single 3-pin socket');
export const newSocket=(kind:SocketKind,circuitId:string,positions:1|2,id:string):CircuitSocket=>({
 id,name:socketName(kind,positions),kind,circuitId,positions,
});
export function validConnections(data:unknown,context:ConnectionContext):data is ConnectionPlan{
 if(!data||typeof data!=='object')return false;
 const p=data as ConnectionPlan;
 if(!Array.isArray(p.sockets)||!Array.isArray(p.loadSocketLinks))return false;
 if(!(p.shoreInlet===null||p.shoreInlet&&
  typeof p.shoreInlet.id==='string'&&!!p.shoreInlet.id&&
  typeof p.shoreInlet.name==='string'))return false;
 const ids=new Set<string>();
 for(const socket of p.sockets){
  if(!socket||typeof socket.id!=='string'||!socket.id||ids.has(socket.id)||
   typeof socket.name!=='string'||!['usb','uk-3pin'].includes(socket.kind)||
   ![1,2].includes(socket.positions)||
   !context.circuits.some(c=>c.id===socket.circuitId))return false;
  ids.add(socket.id);
 }
 if(p.shoreInlet){
  if(ids.has(p.shoreInlet.id))return false;
  ids.add(p.shoreInlet.id);
 }
 const attachedLoads=new Set<string>(),socketCount=new Map<string,number>();
 for(const link of p.loadSocketLinks){
  if(!link||typeof link.loadId!=='string'||typeof link.socketId!=='string'||
   !context.loads.some(l=>l.id===link.loadId)||!ids.has(link.socketId)||
   p.shoreInlet?.id===link.socketId||attachedLoads.has(link.loadId))return false;
  attachedLoads.add(link.loadId);
  const count=(socketCount.get(link.socketId)??0)+1;
  socketCount.set(link.socketId,count);
  const socket=p.sockets.find(s=>s.id===link.socketId);
  if(!socket||count>socket.positions)return false;
 }
 return true;
}
export const connectedSocket=(p:Pick<Planner,'connections'>,loadId:string)=>
 p.connections.sockets.find(s=>s.id===p.connections.loadSocketLinks.find(l=>l.loadId===loadId)?.socketId)??null;
export function normaliseConnections(p:Planner):Planner{
 const circuits=new Set(p.circuits.map(c=>c.id));
 const loads=new Set(p.loads.map(l=>l.id));
 const sockets=p.connections.sockets.filter(s=>circuits.has(s.circuitId));
 const ids=new Set(sockets.map(s=>s.id));
 return {...p,connections:{...p.connections,sockets,
  loadSocketLinks:p.connections.loadSocketLinks.filter(l=>ids.has(l.socketId)&&loads.has(l.loadId))}};
}
export type ConsumerUnitRole='shore-input'|'inverter-output';
export type ConsumerUnit={id:ConsumerUnitRole;name:string;side:'input'|'output';reason:string};
export function plannedConsumerUnits(p:Planner):ConsumerUnit[]{
 const outputRequired=p.connections.sockets.some(s=>s.kind==='uk-3pin')||
  p.loads.some(l=>l.voltage===230);
 const shoreRequired=p.charging.shoreModelId!==null||p.connections.shoreInlet!==null;
 return [
  ...(shoreRequired?[{id:'shore-input' as const,name:'Shore input consumer unit',
    side:'input' as const,reason:'Planned shore inlet or AC-powered battery charging'}]:[]),
  ...(outputRequired?[{id:'inverter-output' as const,name:'Inverter-fed 230 V consumer unit',
    side:'output' as const,reason:'230 V loads or 3-pin outlets require AC distribution'}]:[]),
 ];
}
export type ConnectionIssue={kind:'review'|'mismatch';message:string;id:string};
export function connectionIssues(p:Planner):ConnectionIssue[]{
 const issues:ConnectionIssue[]=[];
 const inverter=activeInverter(p);
 const units=plannedConsumerUnits(p);
 const connectedTo=(id:string)=>p.connections.loadSocketLinks.filter(l=>l.socketId===id);
 for(const socket of p.connections.sockets){
  const circuit=p.circuits.find(c=>c.id===socket.circuitId);
  if(!circuit)continue;
  if(socket.kind==='uk-3pin'&&circuit.voltage!==230)
   issues.push({kind:'mismatch',id:socket.id,message:socket.name+' belongs to a '+circuit.voltage+
     ' V circuit. A 3-pin outlet requires a 230 V AC circuit.'});
  if(socket.kind==='usb'&&circuit.voltage===230)
   issues.push({kind:'mismatch',id:socket.id,message:socket.name+
     ' is a DC USB outlet assigned to a 230 V circuit. Plan a suitable DC supply or converter.'});
  if(socket.kind==='uk-3pin'&&!inverter)
   issues.push({kind:'review',id:socket.id,message:socket.name+
     ' has no selected inverter. Select one on Distribution → 230 V.'});
  if(socket.kind==='uk-3pin'&&!p.distribution.acAssignments.some(a=>a.targetType==='circuit'&&a.targetId===circuit.id))
   issues.push({kind:'review',id:socket.id,message:socket.name+
     ' circuit is not yet associated with the inverter-fed 230 V distribution.'});
  if(socket.kind==='usb'&&!assignmentFor(p.distribution,'circuit',circuit.id))
   issues.push({kind:'review',id:socket.id,message:socket.name+
     ' is not yet associated with a DC distribution branch via its circuit.'});
  const requiredPositions=connectedTo(socket.id).reduce((sum,link)=>
    sum+(p.loads.find(l=>l.id===link.loadId)?.quantity??1),0);
  if(requiredPositions>socket.positions)
   issues.push({kind:'review',id:socket.id,message:(socket.name||'Socket')+
     ' has '+requiredPositions+' individual device connection(s) planned, but only '+
     socket.positions+' outlet/port position(s). Reduce quantity or reassign devices.'});
  for(const link of connectedTo(socket.id)){
   const load=p.loads.find(l=>l.id===link.loadId);
   if(!load)continue;
   if(socket.kind==='uk-3pin'&&load.voltage!==230||
      socket.kind==='usb'&&load.voltage===230)
    issues.push({kind:'mismatch',id:load.id,message:(load.name||'Unnamed load')+' is recorded as '+
      load.voltage+' V, but uses '+socket.name+'. Review its electrical input; no voltage was changed.'});
   if(load.circuitId&&load.circuitId!==socket.circuitId)
    issues.push({kind:'review',id:load.id,message:(load.name||'Unnamed load')+
      ' is grouped in a different circuit from its chosen outlet; review the distribution hierarchy.'});
  }
 }
 if(units.some(c=>c.id==='shore-input')&&!p.connections.shoreInlet)
  issues.push({kind:'review',id:'shore-inlet',message:'Shore charging is planned, but no shore-power inlet connection point has been added.'});
 if(p.connections.shoreInlet&&!p.charging.shoreModelId)
  issues.push({kind:'review',id:'shore-inlet',message:'Shore inlet is planned but no shore-powered charger or inverter/charger has been selected.'});
 if(units.some(c=>c.id==='inverter-output')&&!inverter)
  issues.push({kind:'review',id:'inverter-output',message:'An inverter-fed consumer unit is required for 230 V outlets/loads, but no inverter is selected.'});
 return issues;
}
