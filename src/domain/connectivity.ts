import type { CommunicationConnection, CommunicationPort, MonitoringAuthority, Project } from './model.ts';

const cerboDoc='https://www.victronenergy.com/media/pg/Cerbo_GX/en/technical-specifications.html';
const shuntDoc='https://www.victronenergy.com/media/pg/SmartShunt/en/technical-data.html';
const orionDoc='https://www.victronenergy.com/media/pg/Orion_XS_12-12-50A_DC-DC_battery_charger/en/operation%2C-configuration-and-monitoring.html';
const port=(id:string,componentId:string,name:string,protocol:CommunicationPort['protocol'],
  role:CommunicationPort['role'],url:string,functions:string[],notes=''):CommunicationPort=>
  ({id,componentId,name,protocol,role,documentationUrl:url,evidence:'documented',functions,notes});
export const vandyCommunicationPorts:CommunicationPort[]=[
  ...[1,2,3].map(i=>port(`cerbo-ved-${i}`,'cerbo',`VE.Direct ${i}`,'ve-direct','controller',cerboDoc,['telemetry','configuration'],'Cerbo GX variant to verify; three VE.Direct on documented models')),
  port('cerbo-vebus','cerbo','VE.Bus RJ45 pair (single bus)','ve-bus','controller',cerboDoc,['telemetry','control'],'Two parallel sockets are one logical VE.Bus; not two independent buses'),
  port('cerbo-vecan','cerbo','VE.Can / BMS CAN','ve-can','controller',cerboDoc,['telemetry','managed-control'],'Exact Cerbo hardware generation, CAN settings and BMS protocol must be verified'),
  ...[1,2,3,4].map(i=>port(`cerbo-temp-${i}`,'cerbo',`Temperature input ${i}`,'temperature','controller',cerboDoc,['temperature'],'Compatible dedicated sensor required; not the SmartShunt AUX probe')),
  port('cerbo-ethernet','cerbo','Ethernet','ethernet','controller',cerboDoc,['network','vrm']),
  port('smartshunt-ved','smartshunt','VE.Direct','ve-direct','device',shuntDoc,['soc','current','voltage','aux-telemetry']),
  port('smartshunt-aux','smartshunt','AUX input (one function)','aux-voltage','device',shuntDoc,['starter-voltage','battery-temperature','midpoint'],'Choose exactly ONE: starter voltage, battery temperature, or midpoint; compatible accessories differ'),
  port('smartshunt-bluetooth','smartshunt','Bluetooth VictronConnect','bluetooth','app',shuntDoc,['local-monitoring']),
  port('mppt-ved','mppt','VE.Direct','ve-direct','device','https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/',['solar-telemetry','settings'],'SmartSolar MPPT 100/50 VE.Direct port'),
  port('orion-ved','orion','VE.Direct','ve-direct','device',orionDoc,['dc-dc-telemetry','remote-on-off','supported-dvcc'],'DVCC depends on connected managed BMS, firmware and charge mode'),
  port('multiplus-vebus','multiplus','VE.Bus','ve-bus','device','https://www.victronenergy.com/media/pg/MultiPlus_500VA_-_1600VA/en/',['inverter-telemetry','charger-telemetry','supported-control'],'Verify exact MultiPlus variant before cabling'),
  port('battery-bt','battery','WattCycle Bluetooth app','bluetooth','app','','vendor-app-only'.split('|'), 'Bluetooth is vendor-app-only absent explicit manufacturer documentation; not a Cerbo link')
];
export const vandyAuthorities:MonitoringAuthority[]=[
  {metric:'habitation-soc',componentId:'smartshunt',method:'local',evidence:'unverified',
    notes:'Recommended primary bank SOC reference; verify shunt setup and Cerbo connection.'},
  {metric:'cell-voltages',componentId:'battery',method:'vendor-app',evidence:'reported',
    notes:'WattCycle app BMS cell readings; no documented Cerbo integration.'}
];
export interface ConnectionDiagnostic {id:string;level:'blocker'|'incomplete'|'warning';message:string}
export function connectionDiagnostics(project:Project):ConnectionDiagnostic[]{
  const results:ConnectionDiagnostic[]=[];
  const seen=new Map<string,string>();
  for(const c of project.communicationConnections){
    const from=project.communicationPorts.find(p=>p.id===c.fromPortId);
    const to=project.communicationPorts.find(p=>p.id===c.toPortId);
    if(!from||!to){results.push({id:c.id,level:'blocker',message:'Missing communication port. Select an existing source and target.'});continue;}
    if(from.componentId===to.componentId)results.push({id:c.id,level:'blocker',message:'Communication connection must link separate devices.'});
    if(from.protocol!==to.protocol && !(from.protocol==='can'&&to.protocol==='ve-can') &&
      !(from.protocol==='ve-can'&&to.protocol==='can'))
      results.push({id:c.id,level:'blocker',message:`Incompatible port protocols: ${from.protocol} → ${to.protocol}. No conversion is assumed.`});
    for(const p of [from,to]){
      if(seen.has(p.id))results.push({id:c.id,level:'blocker',message:`${p.name} is already occupied by another communication connection. Select another port or remove the competing link.`});
      else seen.set(p.id,c.id);
    }
    if(from.protocol==='bluetooth'||to.protocol==='bluetooth')
      results.push({id:c.id,level:'blocker',message:'Bluetooth app connectivity does not imply wired GX integration. Remove this proposed link unless a documented supported bridge is modelled.'});
    if((from.protocol==='can'||from.protocol==='ve-can')&&
       (!from.documentationUrl||!to.documentationUrl))
       results.push({id:c.id,level:'warning',message:'CAN connector shape alone does not prove Victron protocol/BMS-DVCC compatibility.'});
  }
  for(const a of project.monitoringAuthorities){
    if(!project.components.some(c=>c.id===a.componentId))
      results.push({id:a.metric,level:'blocker',message:'Monitoring authority references a missing device.'});
    if(a.method==='gx'&&!project.communicationConnections.some(c=>{
      const left=project.communicationPorts.find(p=>p.id===c.fromPortId);
      const right=project.communicationPorts.find(p=>p.id===c.toPortId);
      return [left?.componentId,right?.componentId].includes(a.componentId)&&[left?.componentId,right?.componentId].includes('cerbo');
    }))results.push({id:a.metric,level:'incomplete',message:`${a.metric}: GX data path not recorded; source is only proposed.`});
  }
  return results;
}
export interface ConnectivityRecommendation{
  id:string; title:string; deviceId:string;
  sourcePortId:string; targetPortId:string|null;
  verdict:'recommended'|'optional'|'verify';
  cable:string; benefits:string; reason:string; documentationUrl:string;
}
function usedPorts(project:Project){return new Set(project.communicationConnections.flatMap(c=>[c.fromPortId,c.toPortId]));}
export function recommendConnections(project:Project):ConnectivityRecommendation[]{
  const used=usedPorts(project);
  const items:ConnectivityRecommendation[]=[];
  const cerbo=project.components.some(c=>c.id==='cerbo');
  if(!cerbo)return items;
  const candidates=[
    {component:'smartshunt',source:'smartshunt-ved',protocol:'ve-direct' as const,cable:'VE.Direct cable',
      benefits:'Bank SOC, voltage, current and selected AUX measurement on Cerbo/VRM',url:shuntDoc},
    {component:'mppt',source:'mppt-ved',protocol:'ve-direct' as const,cable:'VE.Direct cable',
      benefits:'Solar production and MPPT state on GX',url:'https://www.victronenergy.com/media/pg/Cerbo_GX/en/installation.html'},
    {component:'orion',source:'orion-ved',protocol:'ve-direct' as const,cable:'VE.Direct cable',
      benefits:'DC-DC telemetry and supported on/off control; managed charging requires compatible BMS and firmware',url:orionDoc},
    {component:'multiplus',source:'multiplus-vebus',protocol:'ve-bus' as const,cable:'Suitable VE.Bus RJ45 cable',
      benefits:'MultiPlus monitoring and supported inverter/charger controls',url:cerboDoc}
  ];
  for(const c of candidates){
    if(!project.components.some(x=>x.id===c.component))continue;
    const source=project.communicationPorts.find(p=>p.id===c.source);
    if(!source||used.has(source.id))continue;
    const targets=project.communicationPorts.filter(p=>p.componentId==='cerbo'&&p.protocol===c.protocol&&!used.has(p.id));
    const target=targets[0];
    items.push({
      id:`recommend-${c.component}`,title:`${project.components.find(p=>p.id===c.component)?.name??c.component} → Cerbo GX`,
      deviceId:c.component,sourcePortId:c.source,targetPortId:target?.id??null,
      verdict:target?'recommended':'verify',cable:target?c.cable:c.protocol==='ve-direct'?
        'Native VE.Direct ports occupied; consider documented VE.Direct-to-USB adapter (USB capacity must be verified)':'Check available Cerbo VE.Bus ports',
      benefits:c.benefits,
      reason:target?'Documented interface match. This recommendation is NOT an installed connection.':'No matching unoccupied recorded controller port.',
      documentationUrl:c.url
    });
    if(target)used.add(target.id);
  }
  const aux=project.communicationPorts.find(p=>p.id==='smartshunt-aux');
  if(aux&&!used.has(aux.id))items.push({
    id:'smartshunt-aux-choice',title:'SmartShunt AUX → starter-battery voltage OR temperature',
    deviceId:'smartshunt',sourcePortId:'smartshunt-aux',targetPortId:null,verdict:'optional',
    cable:'Included fused AUX lead for starter voltage; compatible optional temperature sensor is a different accessory',
    benefits:'Starter voltage monitoring OR battery temperature; NOT both from one AUX input.',
    reason:'Select the AUX purpose in the monitor details before allocating an accessory. Dedicated Cerbo temperature inputs may preserve AUX for the starter battery.',
    documentationUrl:shuntDoc
  });
  const battery=project.batteries.find(b=>b.componentId==='battery');
  if(battery && (battery.bms.externalManagement==='documented'||battery.bms.externalManagement==='verified'))
    items.push({
      id:'battery-bms',title:'Battery BMS → Cerbo GX (compatibility verification)',
      deviceId:'battery',sourcePortId:'battery-bt',targetPortId:null,verdict:'verify',
      cable:'No cable recommended until exact documented external protocol and Victron BMS compatibility are confirmed',
      benefits:'Potential managed BMS monitoring/control, only where explicitly supported.',
      reason:'External BMS capability reported, but Bluetooth and CAN connector presence do not establish protocol interoperability.',
      documentationUrl:battery.bms.documentationUrl
    });
  return items;
}
/** Save-blocking errors are structural; unknown measurements are allowed with warnings. */
export function validateCommunicationDraft(project:Project):ConnectionDiagnostic[]{
  return connectionDiagnostics(project).filter(d=>d.level==='blocker');
}
