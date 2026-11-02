/** Planned distribution groups. No terminals, conductors, fuses or real protective-earth topology. */
import {findModel,plannedInverter} from './charging.ts';
import {selectedBattery,type Planner} from './loadPlanner.ts';
export type DcVoltage=12|24;
export type NodeKind='lynx'|'blue-sea'|'busbar';
export type DistributionNode={id:string;kind:NodeKind;name:string;voltage:DcVoltage};
export type DcTarget='node'|'circuit'|'load'|'inverter';
export type DcAssignment={id:string;sourceId:string;targetType:DcTarget;targetId:string;slot:number|null};
export type ChargeAssignment={chargerId:string;destinationId:string};
export type AcAssignment={targetType:'circuit'|'load';targetId:string};
export type DistributionPlan={
 nodes:DistributionNode[];dcAssignments:DcAssignment[];
 chargerAssignments:ChargeAssignment[];
 standaloneInverterId:string|null;acAssignments:AcAssignment[];
};
export const blankDistribution=():DistributionPlan=>({
 nodes:[],dcAssignments:[],chargerAssignments:[],standaloneInverterId:null,acAssignments:[],
});
export const distributionModels={
 lynx:{name:'Victron Lynx Distributor',slots:4,sourceUrl:'https://www.victronenergy.com/media/pg/Lynx_Distributor/en/system-design.html',
  description:'Four fused MEGA positions. Positive and negative busbars; actual fuse ratings are not selected.'},
 'blue-sea':{name:'Blue Sea ST Blade 5026',slots:12,
  sourceUrl:'https://www.bluesea.com/products/5026/ST_Blade_Fuse_Block_-_12_Circuits_with_Cover',
  description:'12 ATO/ATC fused branches with an internal negative bus; rated 32 V DC, 100 A block, 30 A per branch.'},
 busbar:{name:'Generic paired DC busbars',slots:0,sourceUrl:'',
  description:'Logical positive and negative busbars; no fuse protection or chassis/earth bonding is inferred.'},
} as const;
export const standaloneInverters=[
 {id:'phoenix-12-500',name:'Victron Phoenix 12/500 230V VE.Direct',voltage:12 as DcVoltage,va:500,watts:400,
  sourceUrl:'https://www.victronenergy.com/upload/documents/Certificate-Safety-IEC-60335-1-AS-NZS-4736-Phoenix-Inverter-VE.Direct-250-375-500VA.pdf'},
 {id:'phoenix-24-500',name:'Victron Phoenix 24/500 230V VE.Direct',voltage:24 as DcVoltage,va:500,watts:400,
  sourceUrl:'https://www.victronenergy.com/upload/documents/Certificate-Safety-IEC-60335-1-AS-NZS-4736-Phoenix-Inverter-VE.Direct-250-375-500VA.pdf'},
] as const;
export type InverterChoice={id:string;name:string;voltage:DcVoltage;va:number;sourceUrl:string;combined:boolean};
export const activeInverter=(p:Planner):InverterChoice|null=>{
 const combined=plannedInverter(p.charging);
 if(combined)return {id:'combined:'+combined.id,name:combined.name,voltage:combined.outputVoltages[0],
    va:combined.inverterVA??0,sourceUrl:combined.sourceUrl,combined:true};
 const chosen=standaloneInverters.find(x=>x.id===p.distribution.standaloneInverterId);
 return chosen?{...chosen,combined:false}:null;
};
export const dcSources=(p:Planner,voltage:DcVoltage)=>[
 ...(selectedBattery(p)?.systemVoltage===voltage?[{id:'battery',name:'Planned battery system'}]:[]),
 ...p.distribution.nodes.filter(n=>n.voltage===voltage&&n.kind!=='blue-sea')
    .map(n=>({id:n.id,name:n.name||distributionModels[n.kind].name})),
 ...p.distribution.nodes.filter(n=>n.voltage===voltage&&n.kind==='blue-sea')
    .map(n=>({id:n.id,name:n.name||distributionModels[n.kind].name})),
];
export const dcTargets=(p:Planner,voltage:DcVoltage)=>[
 ...p.distribution.nodes.filter(n=>n.voltage===voltage).map(n=>({
  targetType:'node' as const,targetId:n.id,name:n.name||distributionModels[n.kind].name,voltage,
  group:'Distributors' as const,
 })),
 ...p.circuits.filter(c=>c.voltage===voltage).map(c=>({
  targetType:'circuit' as const,targetId:c.id,name:c.name||'Unnamed circuit',voltage,
  group:'Named circuits' as const,
 })),
 ...p.loads.filter(l=>!l.circuitId&&l.voltage===voltage).map(l=>({
  targetType:'load' as const,targetId:l.id,name:l.name||'Unnamed load',voltage,
  group:'Ungrouped loads' as const,
 })),
 ...(activeInverter(p)?.voltage===voltage?[{
  targetType:'inverter' as const,targetId:'inverter',name:activeInverter(p)!.name,voltage,
  group:'AC inverter DC input' as const,
 }]:[]),
];
export const assignmentFor=(d:DistributionPlan,targetType:DcTarget,targetId:string)=>
 d.dcAssignments.find(a=>a.targetType===targetType&&a.targetId===targetId);
export const slotsFor=(kind:NodeKind)=>distributionModels[kind].slots;
export function busbarRequirements(p:Planner,id:string){
 const node=p.distribution.nodes.find(n=>n.id===id);
 if(!node||node.kind!=='busbar')return null;
 const downstream=p.distribution.dcAssignments.filter(a=>a.sourceId===id).length;
 const chargers=p.distribution.chargerAssignments.filter(a=>a.destinationId===id).length;
 const upstream=assignmentFor(p.distribution,'node',id)?1:1; // reserve an upstream feed terminal even if not selected
 // One lug per upstream and per served outgoing branch; the return count is
 // indicative only, not an asserted real negative cable/netlist.
 return {upstream,downstream,chargers,positive:upstream+downstream+chargers,
  negative:upstream+downstream+chargers,minimumPerBar:upstream+downstream+chargers};
}
const unique=<T>(xs:T[])=>new Set(xs).size===xs.length;
export function validDistribution(input:unknown,p:{circuits:Planner['circuits'];loads:Planner['loads'];charging:Planner['charging']}):boolean{
 if(!input||typeof input!=='object')return false;
 const d=input as DistributionPlan;
 if(!Array.isArray(d.nodes)||!Array.isArray(d.dcAssignments)||
  !Array.isArray(d.chargerAssignments)||!Array.isArray(d.acAssignments))return false;
 const nodeIds=d.nodes.map(n=>n?.id);
 if(!nodeIds.every(id=>typeof id==='string'&&!!id)||!unique(nodeIds))return false;
 if(!d.nodes.every(n=>['lynx','blue-sea','busbar'].includes(n.kind)&&
  (n.voltage===12||n.voltage===24)&&typeof n.name==='string'))return false;
 if(d.standaloneInverterId!==null&&!standaloneInverters.some(i=>i.id===d.standaloneInverterId))return false;
 const allChargers=[...p.charging.dc2dc,...p.charging.mppt].map(u=>u.id);
 const targetKeys:string[]=[];const positionKeys:string[]=[];const assignmentIds:string[]=[];
 const nodeMap=new Map(d.nodes.map(n=>[n.id,n]));
 for(const a of d.dcAssignments){
  if(!a||!a.id||typeof a.id!=='string'||typeof a.sourceId!=='string'||
   !['node','circuit','load','inverter'].includes(a.targetType)||typeof a.targetId!=='string')return false;
  const key=a.targetType+':'+a.targetId;targetKeys.push(key);assignmentIds.push(a.id);
  if(a.targetType==='node'&&!nodeMap.has(a.targetId))return false;
  if(a.targetType==='circuit'&&!p.circuits.some(c=>c.id===a.targetId))return false;
  if(a.targetType==='load'&&!p.loads.some(l=>l.id===a.targetId&&!l.circuitId))return false;
  if(a.targetType==='inverter'&&a.targetId!=='inverter')return false;
  if(a.sourceId!=='battery'&&!nodeMap.has(a.sourceId))return false;
  if(a.targetType==='node'&&a.sourceId===a.targetId)return false;
  const source=nodeMap.get(a.sourceId);
  const slots=source?slotsFor(source.kind):0;
  if(slots){
    if(!Number.isInteger(a.slot)||a.slot===null||a.slot<1||a.slot>slots)return false;
    positionKeys.push(a.sourceId+':'+a.slot);
  }else if(a.slot!==null)return false;
  if(source?.kind==='blue-sea'&&a.targetType==='node')return false; // branch fuse block terminates at consumer
  if(source?.kind==='blue-sea'&&a.targetType==='inverter')return false;
 }
 if(!unique(targetKeys)||!unique(positionKeys)||!unique(assignmentIds))return false;
 // No feeder cycles, including longer paths; each distribution node has at most one upstream.
 const upstream=new Map(d.dcAssignments.filter(a=>a.targetType==='node').map(a=>[a.targetId,a.sourceId]));
 for(const id of nodeIds){
  const seen=new Set<string>();let current=id as string;
  while(upstream.has(current)){
   if(seen.has(current))return false;
   seen.add(current);current=upstream.get(current)!;
  }
 }
 if(!unique(d.chargerAssignments.map(a=>a?.chargerId))||
  !d.chargerAssignments.every(a=>a&&allChargers.includes(a.chargerId)&&
   (a.destinationId==='battery'||nodeMap.has(a.destinationId))))return false;
 if(!unique(d.acAssignments.map(a=>a?.targetType+':'+a?.targetId)))return false;
 if(!d.acAssignments.every(a=>a&&(
  a.targetType==='circuit'&&p.circuits.some(c=>c.id===a.targetId&&c.voltage===230)||
  a.targetType==='load'&&p.loads.some(l=>l.id===a.targetId&&!l.circuitId&&l.voltage===230))))return false;
 return true;
}
export type DistributionIssue={level:'error'|'review';message:string;relatedId?:string};
export function distributionIssues(p:Planner):DistributionIssue[]{
 const d=p.distribution,issues:DistributionIssue[]=[];
 const add=(level:'error'|'review',message:string,relatedId?:string)=>issues.push({level,message,relatedId});
 const batteryV=selectedBattery(p)?.systemVoltage;
 const inverter=activeInverter(p);
 const nodeMap=new Map(d.nodes.map(n=>[n.id,n]));
 for(const node of d.nodes){
  if(!assignmentFor(d,'node',node.id))
   add('review',(node.name||distributionModels[node.kind].name)+' has no upstream DC feed.',node.id);
  if(node.kind==='busbar'){
   const req=busbarRequirements(p,node.id);
   if(req)add('review',(node.name||'Busbar')+' needs approximately '+req.minimumPerBar+
    ' terminals per polarity (positive and negative) for the planned branches. Return routing and actual terminal capacities still require design.',node.id);
  }
 }
 for(const a of d.dcAssignments){
  const source=nodeMap.get(a.sourceId);
  const targetV=a.targetType==='node'?nodeMap.get(a.targetId)?.voltage:
   a.targetType==='circuit'?p.circuits.find(c=>c.id===a.targetId)?.voltage:
   a.targetType==='load'?p.loads.find(l=>l.id===a.targetId)?.voltage:inverter?.voltage;
  const sourceV=a.sourceId==='battery'?batteryV:source?.voltage;
  if(sourceV===undefined)
   add('error','Distribution assignment source '+a.sourceId+' has no available battery-system voltage.',a.targetId);
  else if(targetV!==undefined&&sourceV!==targetV)
   add('error','Supply '+sourceV+' V does not match target '+targetV+' V; add the appropriate real conversion source later.',a.targetId);
  if(source?.kind==='busbar')
   add('review','Generic busbar outputs are unfused; branch protection is not specified.',a.targetId);
 }
 for(const a of d.chargerAssignments){
  const u=[...p.charging.dc2dc,...p.charging.mppt].find(x=>x.id===a.chargerId);
  const m=u?findModel(u.modelId):null;
  const targetV=a.destinationId==='battery'?batteryV:nodeMap.get(a.destinationId)?.voltage;
  if(m&&targetV!==undefined&&!m.outputVoltages.includes(targetV))
   add('error',m.name+' output is not compatible with the '+targetV+' V charging destination.',a.chargerId);
  if(targetV===undefined)add('review','Charging destination has no established DC supply voltage.',a.chargerId);
 }
 for(const c of p.circuits.filter(c=>c.voltage!==230)){
  if(!assignmentFor(d,'circuit',c.id))
   add('review',(c.name||'Unnamed circuit')+' has no distribution assignment.',c.id);
 }
 for(const l of p.loads.filter(l=>!l.circuitId&&l.voltage!==230)){
  if(!assignmentFor(d,'load',l.id))
   add('review',(l.name||'Unnamed load')+' remains unassigned to a distribution branch.',l.id);
 }
 for(const u of [...p.charging.dc2dc,...p.charging.mppt]){
  if(!d.chargerAssignments.some(a=>a.chargerId===u.id))
   add('review',(findModel(u.modelId)?.name||'Charger')+' has no planned DC output destination.',u.id);
 }
 if(inverter){
  const dc=assignmentFor(d,'inverter','inverter');
  if(!dc)add('review','Inverter battery-side DC feed remains unassigned.','inverter');
  if(batteryV!==undefined&&inverter.voltage!==batteryV)
   add('error','Selected inverter '+inverter.voltage+' V DC input mismatches the '+batteryV+' V battery.','inverter');
 }
 for(const c of p.circuits.filter(c=>c.voltage===230)){
  if(!d.acAssignments.some(a=>a.targetType==='circuit'&&a.targetId===c.id))
   add('review',(c.name||'230 V circuit')+' has no AC inverter supply assignment.',c.id);
 }
 for(const l of p.loads.filter(l=>!l.circuitId&&l.voltage===230)){
  if(!d.acAssignments.some(a=>a.targetType==='load'&&a.targetId===l.id))
   add('review',(l.name||'230 V load')+' has no AC inverter supply assignment.',l.id);
 }
 if(d.acAssignments.length&&!inverter)
   add('error','AC circuits are assigned but no battery-backed inverter is selected.');
 return issues;
}
export const normaliseDistribution=(p:Planner):Planner=>{
 const d=p.distribution;
 const nodes=new Set(d.nodes.map(n=>n.id));
 const chargers=new Set([...p.charging.dc2dc,...p.charging.mppt].map(u=>u.id));
 const inverter=activeInverter(p);
 return {...p,distribution:{...d,
  dcAssignments:d.dcAssignments.filter(a=>
   (a.sourceId==='battery'||nodes.has(a.sourceId))&&
   (a.targetType==='node'?nodes.has(a.targetId):
    a.targetType==='circuit'?p.circuits.some(c=>c.id===a.targetId):
    a.targetType==='load'?p.loads.some(l=>l.id===a.targetId&&!l.circuitId):
    !!inverter)),
  chargerAssignments:d.chargerAssignments.filter(a=>chargers.has(a.chargerId)&&
   (a.destinationId==='battery'||nodes.has(a.destinationId))),
  acAssignments:d.acAssignments.filter(a=>a.targetType==='circuit'
   ?p.circuits.some(c=>c.id===a.targetId&&c.voltage===230)
   :p.loads.some(l=>l.id===a.targetId&&!l.circuitId&&l.voltage===230)),
 }};
};
