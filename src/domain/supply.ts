import type { Circuit, Component, LinkStatus, Load, Project, Supply } from './model.ts';
import { checkLogicalLink, findPort } from './topology.ts';

export type SupplyOrigin = 'inverter' | 'shore' | 'dc' | 'unresolved';
export type SupplyConfidence = 'verified' | 'reported' | 'proposed' | 'unassigned';
export interface LogicalSupply {
  origin: SupplyOrigin;
  /** Ordered source-to-consumer component IDs; logical blocks, NOT physical conductors. */
  path: string[];
  anchorComponentId?: string;
  inferredAnchor: boolean;
  confidence: SupplyConfidence;
  issues: string[];
}

const confidenceRank: Record<LinkStatus,number> = {proposed:0,reported:1,verified:2};
function validAcLinks(project:Project){
  return project.topologyLinks.filter(link=>{
    const a=findPort(project,link.fromComponentId,link.fromPortId);
    const b=findPort(project,link.toComponentId,link.toPortId);
    return a?.system==='ac' && b?.system==='ac' && checkLogicalLink(project,link).length===0;
  });
}
interface Route { ids:string[]; statuses:LinkStatus[] }
/** Reverse-only traversal: a path exists only through recorded logical AC links. */
function upstreamRoutes(project:Project,start:string,kind:Component['kind']):Route[]{
  const links=validAcLinks(project);
  const found:Route[]=[];
  const pending:Route[]=[{ids:[start],statuses:[]}];
  while(pending.length){
    const route=pending.shift()!;
    const current=route.ids[route.ids.length-1];
    if(project.components.find(c=>c.id===current)?.kind===kind){found.push(route);continue;}
    for(const link of links.filter(l=>l.toComponentId===current)){
      if(route.ids.includes(link.fromComponentId))continue;
      pending.push({ids:[...route.ids,link.fromComponentId],statuses:[...route.statuses,link.status]});
    }
  }
  return found.sort((a,b)=>a.ids.length-b.ids.length);
}
function confidenceOf(route:Route):SupplyConfidence {
  return route.statuses.length===0?'unassigned':route.statuses.reduce((min,status)=>
    confidenceRank[status]<confidenceRank[min]?status:min,'verified' as LinkStatus);
}
export function suggestedCircuitSource(project:Project,supply:Supply):string|undefined{
  if(supply==='dc')return undefined;
  const kind=supply==='ac-inverter'?'inverter':'shore-inlet';
  const candidates=project.components.filter(c=>c.kind==='consumer-unit'&&upstreamRoutes(project,c.id,kind).length>0);
  return candidates.length===1?candidates[0].id:undefined;
}
export function resolveLogicalSupply(project:Project,load:Load):LogicalSupply{
  const circuit=project.circuits.find(c=>c.id===load.circuitId);
  if(!circuit)return {origin:'unresolved',path:[],inferredAnchor:false,confidence:'unassigned',issues:['Consumer has no valid circuit']};
  if(circuit.supply==='dc')return {
    origin:'dc',path:circuit.sourceComponentId?[circuit.sourceComponentId]:[],
    anchorComponentId:circuit.sourceComponentId,inferredAnchor:false,confidence:'unassigned',
    issues:[] // DC netlist tracing is outside this AC refinement.
  };
  const issues:string[]=[];
  const socketAssignments=project.socketAssignments.filter(a=>a.loadId===load.id);
  if(socketAssignments.length>1)issues.push('Consumer is assigned to multiple socket positions');
  const socket=socketAssignments.length===1?project.components.find(c=>c.id===socketAssignments[0].socketComponentId):undefined;
  const automaticSource=!circuit.sourceComponentId?suggestedCircuitSource(project,circuit.supply):undefined;
  const anchor=socket?.id??circuit.sourceComponentId??automaticSource;
  const inferredAnchor=!socket&&!circuit.sourceComponentId&&!!automaticSource;
  if(!anchor)issues.push('No downstream AC attachment is specified; choose a socket or a circuit distribution source');
  if(socket && circuit.sourceComponentId && socket.id!==circuit.sourceComponentId){
    const toCircuit=upstreamRoutesToComponent(project,socket.id,circuit.sourceComponentId);
    if(toCircuit.length===0)issues.push('Assigned socket is not linked upstream to the circuit distribution component');
  }
  if(inferredAnchor)issues.push('Distribution attachment inferred from one matching consumer unit; confirm circuit assignment');
  const desiredKind=circuit.supply==='ac-inverter'?'inverter':'shore-inlet';
  const routes=anchor?upstreamRoutes(project,anchor,desiredKind):[];
  const path=routes[0]?.ids.slice().reverse()??[];
  if(routes.length===0)issues.push(circuit.supply==='ac-inverter'
    ?'No valid logical path from consumer/circuit to an inverter AC output'
    :'No direct shore-only logical path (a path through an inverter is not shore-only)');
  if(routes.length>1 && routes.some(r=>r.ids[r.ids.length-1]!==routes[0].ids[routes[0].ids.length-1]))
    issues.push('Multiple possible AC supplies; select a unique circuit feed');
  if(circuit.supply==='ac-inverter'&& (project.acOperatingMode??'inverter')==='shore' && path.length){
    const inverterId=path[0];
    if(upstreamRoutes(project,inverterId,'shore-inlet').length===0)
      issues.push('Shore scenario selected but upstream shore feed to inverter is not recorded');
  }
  return {origin:routes.length?(circuit.supply==='ac-inverter'?'inverter':'shore'):'unresolved',
    path,anchorComponentId:anchor,inferredAnchor,confidence:routes[0]?confidenceOf(routes[0]):'unassigned',issues};
}
function upstreamRoutesToComponent(project:Project,start:string,target:string):Route[]{
  const links=validAcLinks(project);
  const pending:Route[]=[{ids:[start],statuses:[]}],found:Route[]=[];
  while(pending.length){
    const path=pending.shift()!;
    const current=path.ids[path.ids.length-1];
    if(current===target){found.push(path);continue;}
    for(const link of links.filter(l=>l.toComponentId===current)){
      if(!path.ids.includes(link.fromComponentId))pending.push({
        ids:[...path.ids,link.fromComponentId],statuses:[...path.statuses,link.status]
      });
    }
  }
  return found;
}
