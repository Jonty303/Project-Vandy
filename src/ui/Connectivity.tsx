import { useMemo } from 'react';
import { Cable, Network, Plus, Trash2, AlertTriangle, CheckCircle, CircleHelp } from 'lucide-react';
import type { CommunicationConnection, CommunicationStatus, MonitoringAuthority, MonitoringMetric, Project, CapabilityEvidence } from '../domain/model.ts';
import { connectionDiagnostics, recommendConnections } from '../domain/connectivity.ts';

type Props={project:Project;change:(fn:(p:Project)=>Project)=>void};
const measures:[MonitoringMetric,string][]=[
  ['habitation-soc','Habitation battery SOC'],
  ['starter-voltage','Starter battery voltage'],
  ['battery-temperature','Habitation battery temperature'],
  ['cell-voltages','Individual cell voltages'],
  ['charging-state','Charging / inverter state']
];
const statuses:CommunicationStatus[]=['proposed','reported','verified'];
const evidences:CapabilityEvidence[]=['unverified','documented','verified','not-supported'];
export function ConnectivityPage({project,change}:Props){
  const recommendations=useMemo(()=>recommendConnections(project),[project]);
  const diagnostics=useMemo(()=>connectionDiagnostics(project),[project]);
  const name=(id:string)=>project.components.find(c=>c.id===id)?.name??id;
  const portName=(id:string)=>{const p=project.communicationPorts.find(p=>p.id===id);return p?`${name(p.componentId)} — ${p.name}`:id;};
  function addConnection(fromPortId:string,toPortId:string){
    if(!fromPortId||!toPortId)return;
    change(p=>({...p,communicationConnections:[...p.communicationConnections,{
      id:crypto.randomUUID(),fromPortId,toPortId,status:'proposed',cable:'Cable/accessory to verify',
      functions:[],evidence:'unverified',notes:'Proposed, not confirmed installed.'
    }]}));
  }
  function patchConnection(id:string,patch:Partial<CommunicationConnection>){
    change(p=>({...p,communicationConnections:p.communicationConnections.map(c=>c.id===id?{...c,...patch}:c)}));
  }
  function setAuthority(metric:MonitoringMetric,patch:Partial<MonitoringAuthority>){
    change(p=>{
      const before=p.monitoringAuthorities.find(x=>x.metric===metric);
      const record:MonitoringAuthority={metric,componentId:'',method:'manual',evidence:'unverified',notes:'',...before,...patch};
      return {...p,monitoringAuthorities:[...p.monitoringAuthorities.filter(x=>x.metric!==metric),record]};
    });
  }
  function auxPurpose(value:string){
    change(p=>({...p,auxiliaryAssignments:value?[{
      portId:'smartshunt-aux',purpose:value as 'starter-voltage'|'battery-temperature'|'midpoint',
      targetComponentId:value==='battery-temperature'?'battery':null,
      accessory:value==='starter-voltage'?'SmartShunt included fused AUX lead':
        value==='battery-temperature'?'Compatible Victron SmartShunt temperature sensor (optional)':
        'Midpoint cabling and configuration to verify',
      status:'proposed' as const,notes:'Proposed accessory and function; never imply it is installed.'
    }]:[]}));
  }
  const aux=project.auxiliaryAssignments.find(x=>x.portId==='smartshunt-aux');
  const devices=project.components.filter(c=>project.communicationPorts.some(p=>p.componentId===c.id));
  return <div className="connectivity-page">
    <div className="section-heading heading-top"><div><div className="eyebrow">ITERATION 03 / DEVICE COMMUNICATIONS</div><h1>Connectivity & monitoring</h1><p>Data ports, compatible cables, documented integrations and which device supplies each measurement.</p></div></div>
    <div className="notice"><CircleHelp size={20}/><div><strong>Connection status is evidence, not an electrical test</strong><p>Recommended links are not assumed installed. Bluetooth on a third-party battery remains vendor-app-only unless external management is expressly documented. VE.Direct, VE.Bus and CAN cannot be substituted for one another.</p></div></div>
    <section className="panel"><div className="panel-head"><h2><Network size={18}/> Recommended GX connections</h2><span className="topo-status">{recommendations.length} suggestions</span></div>
      <div className="connection-recs">{recommendations.map(rec=><article key={rec.id} className="connect-rec">
        <div className="connect-rec-head"><strong>{rec.title}</strong><span>{rec.verdict}</span></div>
        <p>{rec.benefits}</p><p>{rec.reason}</p><p><strong>Cable / accessory:</strong> {rec.cable}</p>
        {rec.documentationUrl&&<a href={rec.documentationUrl} target="_blank" rel="noreferrer">Manufacturer guidance</a>}
        {rec.targetPortId?<button className="button small" onClick={()=>addConnection(rec.sourcePortId,rec.targetPortId!)}><Plus size={14}/> Propose this connection</button>:
          <p className="field-warning"><AlertTriangle size={14}/> No automatically allocated port. Review compatibility or available input capacity.</p>}
      </article>)}</div>
      {!recommendations.length&&<p>No additional documented recommendations for the currently selected equipment. Verify the connected cable inventory below.</p>}
    </section>
    <section className="panel"><div className="panel-head"><h2><Cable size={18}/> Port inventory & proposed data cables</h2></div>
      <div className="connection-port-grid">{devices.map(device=><div key={device.id} className="connection-device"><strong>{device.name}</strong>{project.communicationPorts.filter(p=>p.componentId===device.id).map(p=>{
        const used=project.communicationConnections.find(c=>c.fromPortId===p.id||c.toPortId===p.id);
        return <div key={p.id} className="port-line"><span>{p.name}</span><small>{p.protocol}</small><small>{used?`Assigned: ${used.status}`:'Free / status unconfirmed'}</small>{p.documentationUrl&&<a href={p.documentationUrl} target="_blank" rel="noreferrer" aria-label={`Documentation for ${p.name}`}>Docs</a>}</div>;
      })}</div>)}</div>
      <h3>Connections recorded in this project</h3>
      {project.communicationConnections.map(link=><div className="connect-edit" key={link.id}>
        <div className="form-grid three">
          <label className="field"><span>From device port</span><select value={link.fromPortId} onChange={e=>patchConnection(link.id,{fromPortId:e.target.value})}>{project.communicationPorts.filter(p=>p.role!=='controller'&&p.protocol!=='bluetooth').map(p=><option key={p.id} value={p.id}>{portName(p.id)}</option>)}</select></label>
          <label className="field"><span>To controller port</span><select value={link.toPortId} onChange={e=>patchConnection(link.id,{toPortId:e.target.value})}>{project.communicationPorts.filter(p=>p.role==='controller').map(p=><option key={p.id} value={p.id}>{portName(p.id)}</option>)}</select></label>
          <label className="field"><span>Installation evidence</span><select value={link.status} onChange={e=>patchConnection(link.id,{status:e.target.value as CommunicationStatus})}>{statuses.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="field"><span>Cable / adapter</span><input value={link.cable} onChange={e=>patchConnection(link.id,{cable:e.target.value})}/></label>
          <label className="field"><span>Compatibility evidence</span><select value={link.evidence} onChange={e=>patchConnection(link.id,{evidence:e.target.value as CapabilityEvidence})}>{evidences.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label className="field"><span>Notes</span><input value={link.notes} onChange={e=>patchConnection(link.id,{notes:e.target.value})}/></label>
        </div>
        <button className="button small destructive" onClick={()=>change(p=>({...p,communicationConnections:p.communicationConnections.filter(c=>c.id!==link.id)}))}><Trash2 size={14}/> Remove cable assignment</button>
      </div>)}
      {!project.communicationConnections.length&&<p className="autonomy-note">No external data cables recorded as installed or proposed yet. Use a recommendation above to plan one.</p>}
      <button className="button small" onClick={()=>{
        const occupied=new Set(project.communicationConnections.flatMap(c=>[c.fromPortId,c.toPortId]));
        const from=project.communicationPorts.find(p=>p.role==='device'&&p.protocol==='ve-direct'&&!occupied.has(p.id));
        const to=project.communicationPorts.find(p=>p.role==='controller'&&p.protocol==='ve-direct'&&!occupied.has(p.id));
        if(from&&to)addConnection(from.id,to.id);
      }}><Plus size={14}/> Add manual VE.Direct connection</button>
    </section>
    <section className="panel"><div className="panel-head"><h2>SmartShunt AUX: one of three functions</h2></div>
      <p className="autonomy-note">AUX can monitor starter battery voltage, battery temperature or bank midpoint, but only one function at a time. Temperature requires a separate compatible sensor; the starter-voltage AUX lead is included with documented SmartShunt variants.</p>
      <label className="field"><span>Planned AUX use</span><select value={aux?.purpose??''} onChange={e=>auxPurpose(e.target.value)}>
        <option value="">Unassigned / unknown</option><option value="starter-voltage">Starter battery voltage</option><option value="battery-temperature">Battery temperature</option><option value="midpoint">Battery bank midpoint</option>
      </select></label>
      {aux&&<div className="aux-plan"><p><strong>Proposed accessory:</strong> {aux.accessory}</p><label className="field"><span>Actual installation state</span><select value={aux.status} onChange={e=>change(p=>({...p,auxiliaryAssignments:p.auxiliaryAssignments.map(a=>a.portId===aux.portId?{...a,status:e.target.value as CommunicationStatus}:a)}))}>{statuses.map(x=><option value={x} key={x}>{x}</option>)}</select></label></div>}
      <p className="field-warning"><AlertTriangle size={14}/> Changing the AUX assignment replaces the previous function; it does not change any physical cabling automatically.</p>
    </section>
    <section className="panel"><div className="panel-head"><h2>Monitoring source of truth</h2></div>
      <p className="autonomy-note">Record the authoritative measurement and how it is accessed. A SmartShunt bank SOC is separate from internal BMS cell readings. Choosing GX does not establish that a cable is installed.</p>
      <div className="authority-list">{measures.map(([metric,title])=>{
        const a=project.monitoringAuthorities.find(a=>a.metric===metric);
        return <div className="authority-row" key={metric}><h3>{title}</h3><div className="form-grid three">
          <label className="field"><span>Measuring device</span><select value={a?.componentId??''} onChange={e=>setAuthority(metric,{componentId:e.target.value})}><option value="">Unknown / not assigned</option>{project.components.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span>How the value is available</span><select value={a?.method??'manual'} onChange={e=>setAuthority(metric,{method:e.target.value as MonitoringAuthority['method']})}>
            <option value="manual">Manual / unassigned</option><option value="local">Local device/app</option><option value="vendor-app">Vendor app only</option><option value="gx">Cerbo GX (requires data path)</option>
          </select></label>
          <label className="field"><span>Evidence</span><select value={a?.evidence??'unverified'} onChange={e=>setAuthority(metric,{evidence:e.target.value as CapabilityEvidence})}>
            {evidences.map(x=><option value={x} key={x}>{x}</option>)}</select></label>
        </div><label className="field"><span>Why this is the source of truth</span><input value={a?.notes??''} onChange={e=>setAuthority(metric,{notes:e.target.value})}/></label></div>;
      })}</div>
    </section>
    <section className="panel"><div className="panel-head"><h2>Connectivity consistency checks</h2></div>
      {diagnostics.length===0?<p><CheckCircle size={15}/> No structural contradictions in the recorded communications. This is not proof of physical connectivity.</p>:
        <div className="diagnostics">{diagnostics.map((d,i)=><p className={d.level} key={d.id+i}><AlertTriangle size={14}/> {d.message}</p>)}</div>}
    </section>
  </div>;
}
