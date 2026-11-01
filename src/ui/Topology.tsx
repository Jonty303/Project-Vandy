import { useMemo } from 'react';
import { ArrowRight, Cable, CircuitBoard, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import type { Component, Evidence, ElectricalPort, LinkStatus, Project, ProtectionDevice, ProtectionKind, TopologyLink } from '../domain/model.ts';
import { findPort, inspectTopology } from '../domain/topology.ts';

type Props = {project: Project; change: (fn:(p:Project)=>Project)=>void};
const newId = () => crypto.randomUUID();
const fmt = (n:number|null) => n===null?'':String(n);
const asNumber = (value:string):number|null => value.trim()===''?null:Number(value);
const evidence: Evidence[] = ['unknown','reported','manual','measured','listing','estimated'];
const kinds: ProtectionKind[] = ['unknown','rcd','mcb','rcbo','isolator'];
const statuses: LinkStatus[] = ['proposed','reported','verified'];
type Option = {value:string;label:string;port:ElectricalPort;component:Component};
const endpointId=(componentId:string,portId:string)=>JSON.stringify([componentId,portId]);
const parseEndpoint=(key:string):[string,string]=>JSON.parse(key) as [string,string];

function endpoints(project:Project,direction:'input'|'output'):Option[]{
  return project.components.flatMap(c=>(c.ports??[]).filter(p=>p.direction===direction).map(p=>({
    value:endpointId(c.id,p.id),label:`${c.name} — ${p.label} (${p.voltage}V ${p.system.toUpperCase()})`,component:c,port:p
  })));
}
function logicalGraph(project:Project,system:'ac'|'dc'){
  const links=project.topologyLinks.filter(link=>findPort(project,link.fromComponentId,link.fromPortId)?.system===system &&
    findPort(project,link.toComponentId,link.toPortId)?.system===system);
  const ids=[...new Set(links.flatMap(l=>[l.fromComponentId,l.toComponentId]))];
  const rank=new Map(ids.map(id=>[id,0]));
  // Bounded passes prevent a cycle in a draft from hanging the diagram.
  for(let i=0;i<ids.length;i++){
    let moved=false;
    for(const link of links){const next=Math.min(ids.length,(rank.get(link.fromComponentId)??0)+1);
      if(next>(rank.get(link.toComponentId)??0)){rank.set(link.toComponentId,next);moved=true;}}
    if(!moved)break;
  }
  const layers=new Map<number,string[]>();
  ids.forEach(id=>{const d=rank.get(id)??0;layers.set(d,[...(layers.get(d)??[]),id]);});
  const coords=new Map<string,{x:number;y:number}>();
  [...layers.entries()].forEach(([depth,nodes])=>nodes.forEach((id,i)=>coords.set(id,{x:28+depth*240,y:36+i*110})));
  const width=Math.max(650,...[...coords.values()].map(p=>p.x+222));
  const height=Math.max(158,...[...coords.values()].map(p=>p.y+82));
  return {ids,links,coords,width,height};
}
function Diagram({project,system}:{project:Project;system:'ac'|'dc'}){
  const {ids,links,coords,width,height}=useMemo(()=>logicalGraph(project,system),[project,system]);
  if(ids.length===0)return <p className="topo-empty">No {system.toUpperCase()} logical links recorded.</p>;
  return <div className="topo-canvas-scroll"><svg className="topo-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${system.toUpperCase()} proposed logical system connections`}>
    <defs><marker id={`arrow-${system}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6" fill="none" stroke="#8798aa" strokeWidth="1.6"/></marker></defs>
    {links.map(link=>{const a=coords.get(link.fromComponentId),b=coords.get(link.toComponentId);if(!a||!b)return null;
      const mid=a.x+222+(b.x-a.x-202)/2;
      return <path key={link.id} d={`M${a.x+194} ${a.y+26} H${mid} V${b.y+26} H${b.x-9}`}
       fill="none" stroke={link.status==='verified'?'#4db89d':'#8798aa'} strokeWidth={link.status==='verified'?2.5:1.8}
       strokeDasharray={link.status==='proposed'?'5 5':undefined} markerEnd={`url(#arrow-${system})`}/>;
    })}
    {ids.map(id=>{const p=coords.get(id)!;const c=project.components.find(c=>c.id===id)!;
      return <g key={id}><rect x={p.x} y={p.y} width="194" height="56" rx="9" className="topo-node"/>
        <text x={p.x+12} y={p.y+23} className="topo-node-title">{c.name.length>25?`${c.name.slice(0,24)}…`:c.name}</text>
        <text x={p.x+12} y={p.y+41} className="topo-node-sub">{c.kind.replaceAll('-',' ')} · {c.voltage??'?' }V</text>
        <title>{c.name} — logical diagram only; not certified wiring</title></g>;
    })}
  </svg></div>;
}
function SectionTitle({title,detail}:{title:string;detail:string}){return <div className="topo-heading"><h2>{title}</h2><p>{detail}</p></div>;}

export function TopologyPage({project,change}:Props){
  const issues=useMemo(()=>inspectTopology(project),[project]);
  const sources=endpoints(project,'output'),targets=endpoints(project,'input');
  const acLoads=project.loads.filter(l=>project.circuits.some(c=>c.id===l.circuitId&&c.supply!=='dc'));
  const patchLink=(id:string,patch:Partial<TopologyLink>)=>change(p=>({...p,topologyLinks:p.topologyLinks.map(l=>l.id===id?{...l,...patch}:l)}));
  const patchProtection=(id:string,patch:Partial<ProtectionDevice>)=>change(p=>({...p,protectionDevices:p.protectionDevices.map(d=>d.id===id?{...d,...patch}:d)}));
  const addLink=()=>change(p=>({...p,topologyLinks:[...p.topologyLinks,{
    id:newId(),fromComponentId:'cu-sockets',fromPortId:'ac-out',toComponentId:'kitchen-socket',toPortId:'ac-in',
    status:'proposed' as const,notes:'Not verified'
  }]}));
  const assignSocket=(componentId:string,positionId:string,loadId:string)=>{
    change(p=>{
      const previous=p.socketAssignments.find(a=>a.socketComponentId===componentId&&a.positionId===positionId);
      const other=p.socketAssignments.filter(a=>!(a.socketComponentId===componentId&&a.positionId===positionId));
      return {...p,socketAssignments:loadId?[...other,{
        id:previous?.id??newId(),socketComponentId:componentId,positionId,loadId,evidence:previous?.evidence??'reported' as Evidence
      }]:other};
    });
  };
  const acCircuits=project.circuits.filter(c=>c.supply!=='dc');
  return <div className="topo-page">
    <div className="section-heading heading-top"><div><div className="eyebrow">ITERATION 02 / ELECTRICAL DISTRIBUTION</div>
      <h1>System topology</h1><p>Map components, protective devices and sockets once; reuse the structure in future wiring diagrams.</p></div>
      <span className="topo-status">{project.topologyLinks.length} logical links</span></div>
    <div className="topo-warning"><ShieldAlert size={21}/><div><strong>Block diagram only — not verified wiring</strong>
      <p>Port groups indicate L/N/PE or DC positive/negative/chassis as separate functions. Each link is a planning relationship, NOT a cable, tested earth bond, complete circuit, fuse recommendation or compliant installation.</p></div></div>
    <section className="topo-panel"><SectionTitle title="Generated supply overview" detail="The diagrams below are generated directly from saved logical links. Dashed = proposed; solid grey = owner-reported; green = user-marked verified."/>
      <h3>230V AC — shore, inverter and outlets</h3><Diagram project={project} system="ac"/>
      <h3>12V DC — distribution and controllers</h3><Diagram project={project} system="dc"/></section>
    <section className="topo-panel"><div className="topo-section-row"><SectionTitle title="Logical supply links" detail="Editable port-group relationships. No conductors or lengths are inferred."/>
      <button className="button small" onClick={addLink}><Plus size={15}/> Add link</button></div>
      <div className="topo-link-list">{project.topologyLinks.map(link=>{
        const fromValue=endpointId(link.fromComponentId,link.fromPortId),toValue=endpointId(link.toComponentId,link.toPortId);
        const source=sources.find(o=>o.value===fromValue);
        const matchingTargets=source?targets.filter(o=>o.port.system===source.port.system):targets;
        return <div className="topo-link" key={link.id}>
          <div className="topo-link-controls"><label><span>Source output</span><select value={fromValue} onChange={e=>{const [fromComponentId,fromPortId]=parseEndpoint(e.target.value);patchLink(link.id,{fromComponentId,fromPortId});}}>{!source&&<option value={fromValue}>Missing source</option>}{sources.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <ArrowRight size={18}/><label><span>Target input</span><select value={toValue} onChange={e=>{const [toComponentId,toPortId]=parseEndpoint(e.target.value);patchLink(link.id,{toComponentId,toPortId});}}>{!matchingTargets.some(o=>o.value===toValue)&&<option value={toValue}>Incompatible / missing target</option>}{matchingTargets.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label></div>
          <div className="topo-link-bottom"><label>Status <select value={link.status} onChange={e=>patchLink(link.id,{status:e.target.value as LinkStatus})}>{statuses.map(k=><option key={k} value={k}>{k}</option>)}</select></label>
          <input aria-label="Link notes" value={link.notes??''} placeholder="Evidence and notes" onChange={e=>patchLink(link.id,{notes:e.target.value})}/>
          <button className="icon-button danger" aria-label="Remove logical link" onClick={()=>change(p=>({...p,topologyLinks:p.topologyLinks.filter(l=>l.id!==link.id)}))}><Trash2 size={16}/></button></div>
        </div>;
      })}</div>
    </section>
    <section className="topo-panel"><SectionTitle title="Consumer units and protection" detail="Two physically separate units. Unknown device types and ratings stay unverified; assigning a breaker to a circuit does not validate safety."/>
      <div className="topo-cu-grid">{project.components.filter(c=>c.kind==='consumer-unit').map(unit=><article className="topo-cu" key={unit.id}>
        <div className="topo-cu-head"><CircuitBoard size={21}/><div><h3>{unit.name}</h3><p>{unit.notes}</p></div></div>
        {project.protectionDevices.filter(d=>d.consumerUnitId===unit.id).map(d=><div className="topo-protection" key={d.id}>
          <div className="topo-protection-head"><input aria-label="Device name" value={d.name} onChange={e=>patchProtection(d.id,{name:e.target.value})}/>
            <button className="icon-button danger" title="Delete protective device" onClick={()=>change(p=>({...p,protectionDevices:p.protectionDevices.filter(x=>x.id!==d.id)}))}><Trash2 size={16}/></button></div>
          <div className="topo-fields"><label>Type<select value={d.kind} onChange={e=>patchProtection(d.id,{kind:e.target.value as ProtectionKind})}>{kinds.map(k=><option key={k} value={k}>{k.toUpperCase()}</option>)}</select></label>
            <label>Current (A)<input type="number" min="0" placeholder="Unknown" value={fmt(d.ratedCurrentA)} onChange={e=>patchProtection(d.id,{ratedCurrentA:asNumber(e.target.value)})}/></label>
            <label>Trip (mA)<input type="number" min="0" placeholder="Unknown" value={fmt(d.residualTripMa)} onChange={e=>patchProtection(d.id,{residualTripMa:asNumber(e.target.value)})}/></label>
            <label>Evidence<select value={d.evidence} onChange={e=>patchProtection(d.id,{evidence:e.target.value as Evidence})}>{evidence.map(v=><option key={v} value={v}>{v}</option>)}</select></label></div>
          <div className="topo-circuit-assign">Claimed downstream circuits: {acCircuits.length?acCircuits.map(c=><label key={c.id}><input type="checkbox" checked={d.protectedCircuitIds.includes(c.id)} onChange={e=>patchProtection(d.id,{protectedCircuitIds:e.target.checked?[...d.protectedCircuitIds,c.id]:d.protectedCircuitIds.filter(x=>x!==c.id)})}/>{c.name}</label>):<em>None</em>}</div>
        </div>)}
        <button className="button small" onClick={()=>change(p=>({...p,protectionDevices:[...p.protectionDevices,{
          id:newId(),consumerUnitId:unit.id,name:'Unidentified protective device',kind:'unknown',ratedCurrentA:null,residualTripMa:null,protectedCircuitIds:[],evidence:'unknown'
        }]}))}><Plus size={15}/> Add protection device</button>
      </article>)}</div>
    </section>
    <section className="topo-panel"><SectionTitle title="230V socket accessories" detail="Sockets are physical endpoints with positions. Plugged-in consumers retain their own energy profiles; assignment does not add a second load."/>
      <div className="topo-sockets">{project.components.filter(c=>c.kind==='socket-outlet').map(c=><article className="topo-socket" key={c.id}><h3>{c.name}</h3>
        {(c.socketPositions??[]).map(position=>{const a=project.socketAssignments.find(a=>a.socketComponentId===c.id&&a.positionId===position.id);
          return <label key={position.id}>{position.label}<select value={a?.loadId??''} onChange={e=>assignSocket(c.id,position.id,e.target.value)}><option value="">Unassigned / unknown</option>{acLoads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>;
        })}</article>)}</div>
    </section>
    <section className="topo-panel"><SectionTitle title="Port and conductor catalogue" detail="Named electrical interfaces will support an actual netlist in Iteration 03; currently there are no individual cable or conductor edges."/>
      <div className="topo-port-grid">{project.components.filter(c=>c.ports?.length).map(c=><div className="topo-port" key={c.id}><strong>{c.name}</strong>
        {c.ports?.map(p=><p key={p.id}><Cable size={13}/>{p.label} — {p.voltage}V {p.system.toUpperCase()} · {p.conductors.join(' / ')}</p>)}</div>)}</div>
    </section>
    <section className="topo-panel"><SectionTitle title="Consistency checks" detail="Structural diagnostics only; absence of warnings does not mean the installation is safe."/>
      {issues.length===0?<p>No model-consistency warnings. Physical electrical validation has not been performed.</p>:
      <ul className="topo-issues">{issues.map((issue,i)=><li key={issue.id+i}><ShieldAlert size={14}/>{issue.message} <small>({issue.id})</small></li>)}</ul>}
    </section>
  </div>;
}
