import type { Circuit, Component, ElectricalPort, Project, TopologyLink } from './model.ts';

export interface TopologyIssue { id: string; message: string }
export function findPort(project: Project, componentId: string, portId: string): ElectricalPort | undefined {
  return project.components.find(c=>c.id===componentId)?.ports?.find(p=>p.id===portId);
}
export function findComponent(project: Project, id: string): Component | undefined {
  return project.components.find(c=>c.id===id);
}
export function findCircuit(project: Project, id: string): Circuit | undefined {
  return project.circuits.find(c=>c.id===id);
}
export function checkLogicalLink(project: Project, link: TopologyLink): string[] {
  const warnings: string[] = [];
  const from = findPort(project,link.fromComponentId,link.fromPortId);
  const to = findPort(project,link.toComponentId,link.toPortId);
  if (!from) warnings.push('Source component/port does not exist');
  if (!to) warnings.push('Target component/port does not exist');
  if (!from || !to) return warnings;
  if (link.fromComponentId===link.toComponentId) warnings.push('A component cannot link to itself');
  if (from.direction!=='output' || to.direction!=='input') warnings.push('Logical links must run from an output port to an input port');
  if (from.system!==to.system) warnings.push('Cannot directly link AC and DC port groups');
  if (from.voltage!==to.voltage && from.voltage!=='12/24' && to.voltage!=='12/24') warnings.push('Port voltages differ; converter/transformer model required');
  if (from.system===to.system && (from.conductors.join(',')!==to.conductors.join(','))) {
    warnings.push('Port terminal groups differ; never assume PE, chassis and DC negative are interchangeable');
  }
  return warnings;
}

/** Checks data consistency only, never electrical suitability or installation safety. */
export function inspectTopology(project: Project): TopologyIssue[] {
  const issues: TopologyIssue[] = [];
  for (const link of project.topologyLinks) {
    for (const message of checkLogicalLink(project,link)) issues.push({id:link.id,message});
  }
  const assignments = new Set<string>();
  const assignedLoads = new Set<string>();
  for (const item of project.socketAssignments) {
    const socket = findComponent(project,item.socketComponentId);
    const position = socket?.socketPositions?.find(p=>p.id===item.positionId);
    const load = project.loads.find(l=>l.id===item.loadId);
    if (!socket || socket.kind!=='socket-outlet' || !position) issues.push({id:item.id,message:'Socket accessory or position does not exist'});
    if (!load) issues.push({id:item.id,message:'Assigned consumer does not exist'});
    if (load && !['ac-inverter','ac-shore'].includes(findCircuit(project,load.circuitId)?.supply??'')) issues.push({id:item.id,message:'Socket consumer must be supplied on an AC circuit'});
    const key=item.socketComponentId+'/'+item.positionId;
    if(assignments.has(key)) issues.push({id:item.id,message:'More than one consumer assigned to the same socket position'});
    assignments.add(key);
    if(assignedLoads.has(item.loadId)) issues.push({id:item.id,message:'Consumer assigned to multiple sockets; check for duplicate modelling'});
    assignedLoads.add(item.loadId);
  }
  for (const device of project.protectionDevices) {
    const unit=findComponent(project,device.consumerUnitId);
    if (!unit || unit.kind!=='consumer-unit') issues.push({id:device.id,message:'Protective device must belong to an existing consumer unit'});
    if (device.ratedCurrentA!==null && (!Number.isFinite(device.ratedCurrentA)||device.ratedCurrentA<=0)) issues.push({id:device.id,message:'Invalid rated current'});
    if (device.residualTripMa!==null && (!Number.isFinite(device.residualTripMa)||device.residualTripMa<=0)) issues.push({id:device.id,message:'Invalid residual trip rating'});
    for (const circuitId of device.protectedCircuitIds) {
      const circuit=findCircuit(project,circuitId);
      if(!circuit || circuit.supply==='dc') issues.push({id:device.id,message:'Protected AC circuit ID is missing or incompatible'});
    }
  }
  return issues;
}
