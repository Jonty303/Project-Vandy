import { useState } from 'react';
import type { Project, GroundingConnection, DcCableRun, TopologyLink, CommunicationConnection } from '../domain/model.ts';
import { effectiveWiring } from '../domain/dcWiring.ts';
import { groundingTerminal } from '../domain/grounding.ts';

type Props={project:Project;change:(fn:(p:Project)=>Project)=>void;componentId:string};
const pair=(a:string,b:string)=>JSON.stringify([a,b]);
const unpack=(value:string):[string,string]=>JSON.parse(value) as [string,string];
const id=()=>crypto.randomUUID();
const asTarget=(c:DcCableRun)=>c.toCircuitId?'circuit:'+c.toCircuitId:c.toComponentId?'device:'+c.toComponentId:'';
function names(project:Project,id:string){return project.components.find(c=>c.id===id)?.name??id;}
export function DeviceConnections({project,change,componentId}:Props){
  const component=project.components.find(c=>c.id===componentId);
  const [groundFrom,setGroundFrom]=useState('');
  const [groundTo,setGroundTo]=useState('');
  const [dcTo,setDcTo]=useState('');
  const [logicalFrom,setLogicalFrom]=useState('');
  const [logicalTo,setLogicalTo]=useState('');
  const [dataFrom,setDataFrom]=useState('');
  const [dataTo,setDataTo]=useState('');
  if(!component)return null;
  const allTerminals=project.components.flatMap(c=>(c.groundingTerminals??[]).map(t=>({key:pair(c.id,t.id),componentId:c.id,terminalId:t.id,kind:t.kind,label:c.name+' — '+t.label})));
  const ownGround=component.groundingTerminals??[];
  const chosenGround=ownGround.find(t=>t.id===groundFrom)??ownGround[0];
  const groundPeers=allTerminals.filter(t=>t.componentId!==componentId&&chosenGround&&(chosenGround.kind==='pe'||t.kind==='chassis'));
  const earths=(project.groundingConnections??[]).filter(g=>g.fromComponentId===componentId||g.toComponentId===componentId);
  function patchEarth(gid:string,peerKey:string){
    const [nextId,nextTerminal]=unpack(peerKey);
    change(p=>({...p,groundingConnections:(p.groundingConnections??[]).map(g=>g.id!==gid?g:
      g.fromComponentId===componentId?{...g,toComponentId:nextId,toTerminalId:nextTerminal}:
        {...g,fromComponentId:nextId,fromTerminalId:nextTerminal})}));
  }
  function addEarth(){
    if(!chosenGround||!groundTo)return;
    const [toComponentId,toTerminalId]=unpack(groundTo);
    const terminal=groundingTerminal(project,toComponentId,toTerminalId);
    if(!terminal||toComponentId===componentId)return;
    const entry:GroundingConnection={id:id(),fromComponentId:componentId,fromTerminalId:chosenGround.id,
      toComponentId,toTerminalId,kind:chosenGround.kind==='pe'||terminal.kind==='pe'?'protective-earth':'chassis-bond',
      notes:'Connection entered from device editor; confirm physical termination and route.'};
    change(p=>({...p,groundingConnections:[...(p.groundingConnections??[]),entry]}));setGroundTo('');
  }
  const dc=effectiveWiring(project).cables.filter(c=>c.fromComponentId===componentId||c.toComponentId===componentId);
  const dcDestinations=[
    ...project.components.filter(c=>c.id!==componentId&&c.voltage!=='230'&&!['ground-point','bonding-busbar'].includes(c.kind))
      .map(c=>({value:'device:'+c.id,label:c.name})),
    ...project.circuits.filter(c=>c.supply==='dc').map(c=>({value:'circuit:'+c.id,label:'Circuit — '+c.name}))
  ];
  function patchDc(runId:string,value:string){
    change(p=>{
      const plan=effectiveWiring(p);
      return {...p,dcWiring:{...plan,cables:plan.cables.map(c=>{
        if(c.id!==runId)return c;
        if(c.toComponentId===componentId)return {...c,fromComponentId:value.replace(/^device:/,'')};
        return {...c,toComponentId:value.startsWith('device:')?value.slice(7):undefined,
          toCircuitId:value.startsWith('circuit:')?value.slice(8):undefined};
      })}};
    });
  }
  function addDc(){
    if(!dcTo)return;
    const entry:DcCableRun={id:id(),name:'New DC conductor',fromComponentId:componentId,
      toComponentId:dcTo.startsWith('device:')?dcTo.slice(7):undefined,
      toCircuitId:dcTo.startsWith('circuit:')?dcTo.slice(8):undefined,
      polarity:'positive',lengthM:1,lengthEvidence:'assumed',designCurrentA:null,
      manufacturerMinMm2:null,voltageV:project.nominalBatteryVoltage,fuseId:null,status:'proposed',
      notes:'User-entered conductor; verify actual termination, polarity, current, fuse and cable route.'};
    change(p=>{const plan=effectiveWiring(p);return {...p,dcWiring:{...plan,cables:[...plan.cables,entry]}};});
    setDcTo('');
  }
  const ownPorts=component.ports??[];
  const selectedPort=ownPorts.find(p=>p.id===logicalFrom)??ownPorts[0];
  const logicalCandidates=project.components.flatMap(c=>(c.ports??[]).filter(p=>
    c.id!==componentId&&selectedPort&&p.direction!==selectedPort.direction&&p.system===selectedPort.system&&
    (p.voltage===selectedPort.voltage||p.voltage==='12/24'||selectedPort.voltage==='12/24')&&
    p.conductors.join(',')===selectedPort.conductors.join(','))
    .map(p=>({value:pair(c.id,p.id),label:c.name+' — '+p.label})));
  const logicalLinks=project.topologyLinks.filter(c=>c.fromComponentId===componentId||c.toComponentId===componentId);
  function patchLogical(linkId:string,value:string){
    const [otherId,otherPort]=unpack(value);
    change(p=>({...p,topologyLinks:p.topologyLinks.map(l=>l.id!==linkId?l:
      l.fromComponentId===componentId?{...l,toComponentId:otherId,toPortId:otherPort}:
        {...l,fromComponentId:otherId,fromPortId:otherPort})}));
  }
  function addLogical(){
    if(!selectedPort||!logicalTo)return;
    const [otherId,otherPort]=unpack(logicalTo);
    const outgoing=selectedPort.direction==='output';
    const entry:TopologyLink={id:id(),fromComponentId:outgoing?componentId:otherId,
      fromPortId:outgoing?selectedPort.id:otherPort,toComponentId:outgoing?otherId:componentId,
      toPortId:outgoing?otherPort:selectedPort.id,status:'proposed',notes:'Planning link from device editor.'};
    change(p=>({...p,topologyLinks:[...p.topologyLinks,entry]}));setLogicalTo('');
  }
  const ownData=project.communicationPorts.filter(p=>p.componentId===componentId&&p.protocol!=='bluetooth');
  const selectedData=ownData.find(p=>p.id===dataFrom)??ownData[0];
  const occupied=new Set(project.communicationConnections.flatMap(c=>[c.fromPortId,c.toPortId]));
  const dataCandidates=project.communicationPorts.filter(p=>selectedData&&p.componentId!==componentId&&
    p.protocol===selectedData.protocol&&p.role!==selectedData.role&&!occupied.has(p.id));
  const existingData=project.communicationConnections.filter(c=>ownData.some(p=>p.id===c.fromPortId||p.id===c.toPortId));
  function patchData(connectionId:string,newPort:string){
    change(p=>({...p,communicationConnections:p.communicationConnections.map(c=>c.id!==connectionId?c:
      project.communicationPorts.some(x=>x.componentId===componentId&&x.id===c.fromPortId)?
        {...c,toPortId:newPort}:{...c,fromPortId:newPort})}));
  }
  function addData(){
    if(!selectedData||!dataTo)return;
    const peer=project.communicationPorts.find(p=>p.id===dataTo);
    if(!peer||occupied.has(peer.id))return;
    const fromIsLocal=selectedData.role!=='controller';
    const entry:CommunicationConnection={id:id(),
      fromPortId:fromIsLocal?selectedData.id:peer.id,
      toPortId:fromIsLocal?peer.id:selectedData.id,
      status:'proposed',cable:'Select compatible cable / adapter',functions:[],
      evidence:'unverified',notes:'Planning connection from device editor.'};
    change(p=>({...p,communicationConnections:[...p.communicationConnections,entry]}));setDataTo('');
  }
  const pname=(p:string)=>{const port=project.communicationPorts.find(x=>x.id===p);return port?names(project,port.componentId)+' — '+port.name:p;};
  return <div className="device-connections">
    <h4>Connections — {component.name}</h4>
    {ownGround.length>0&&<details open><summary>Earth / chassis ({earths.length})</summary>
      {earths.map(g=>{
        const localFrom=g.fromComponentId===componentId;
        const localTerminal=groundingTerminal(project,componentId,localFrom?g.fromTerminalId:g.toTerminalId);
        const peerKey=pair(localFrom?g.toComponentId:g.fromComponentId,localFrom?g.toTerminalId:g.fromTerminalId);
        const options=allTerminals.filter(t=>t.componentId!==componentId&&
          (g.kind==='chassis-bond'?t.kind==='chassis':localTerminal?.kind==='pe'||t.kind==='pe'));
        return <label className="field" key={g.id}><span>{localTerminal?.label??'Earth terminal'} → connected to</span>
          <select value={peerKey} onChange={e=>patchEarth(g.id,e.target.value)}>
            {options.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}
          </select><small>{g.kind==='protective-earth'?'Protective earth to recorded chassis/PE termination':'Chassis bonding connection'}</small>
          <button className="button small" onClick={()=>change(p=>({...p,groundingConnections:(p.groundingConnections??[]).filter(x=>x.id!==g.id)}))}>Remove connection</button>
        </label>;
      })}
      <div className="form-grid three">
        <label className="field"><span>Local terminal</span><select value={chosenGround?.id??''} onChange={e=>{setGroundFrom(e.target.value);setGroundTo('');}}>{ownGround.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label className="field"><span>Connect to</span><select value={groundTo} onChange={e=>setGroundTo(e.target.value)}><option value="">Choose destination…</option>{groundPeers.map(t=><option value={t.key} key={t.key}>{t.label}</option>)}</select></label>
        <button className="button small" disabled={!groundTo} onClick={addEarth}>Add earth connection</button>
      </div>
      <small>DC negative, AC protective earth and chassis are never interchangeable by default.</small>
    </details>}
    {component.voltage!=='230'&&!['ground-point','bonding-busbar'].includes(component.kind)&&<details><summary>DC conductors ({dc.length})</summary>
      {dc.map(c=><div className="connect-edit" key={c.id}>
        <strong>{c.name}</strong><label className="field"><span>{c.fromComponentId===componentId?'Destination':'Source'}</span>
          <select value={c.fromComponentId===componentId?asTarget(c):'device:'+c.fromComponentId} onChange={e=>patchDc(c.id,e.target.value)}>
            <option value="">Not assigned</option>{dcDestinations.filter(t=>c.toComponentId!==componentId||t.value.startsWith('device:')).map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label><small>{c.polarity} · {c.lengthM}m nominal one-way. Edit length/fuse in DC cables & fuses.</small>
        <button className="button small" onClick={()=>change(p=>{const plan=effectiveWiring(p);return {...p,dcWiring:{...plan,cables:plan.cables.filter(x=>x.id!==c.id)}};})}>Remove conductor</button>
      </div>)}
      <div className="form-grid"><label className="field"><span>New connection destination</span><select value={dcTo} onChange={e=>setDcTo(e.target.value)}><option value="">Choose destination…</option>{dcDestinations.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <button className="button small" disabled={!dcTo} onClick={addDc}>Add DC conductor</button></div>
    </details>}
    {ownPorts.length>0&&<details><summary>Logical AC/DC supply links ({logicalLinks.length})</summary>
      {logicalLinks.map(l=>{
        const localFrom=l.fromComponentId===componentId;
        const own=ownPorts.find(p=>p.id===(localFrom?l.fromPortId:l.toPortId));
        const value=pair(localFrom?l.toComponentId:l.fromComponentId,localFrom?l.toPortId:l.fromPortId);
        const options=project.components.flatMap(c=>(c.ports??[]).filter(p=>c.id!==componentId&&own&&
          p.system===own.system&&p.direction!==own.direction&&
          (p.voltage===own.voltage||p.voltage==='12/24'||own.voltage==='12/24')&&p.conductors.join(',')===own.conductors.join(','))
          .map(p=>({key:pair(c.id,p.id),label:c.name+' — '+p.label})));
        return <label className="field" key={l.id}><span>{own?.label??'Port'} — connected to</span>
          <select value={value} onChange={e=>patchLogical(l.id,e.target.value)}>{options.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}</select>
          <button className="button small" onClick={()=>change(p=>({...p,topologyLinks:p.topologyLinks.filter(x=>x.id!==l.id)}))}>Remove link</button>
        </label>;
      })}
      <div className="form-grid three"><label className="field"><span>Local port</span><select value={selectedPort?.id??''} onChange={e=>{setLogicalFrom(e.target.value);setLogicalTo('');}}>{ownPorts.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="field"><span>Compatible counterpart</span><select value={logicalTo} onChange={e=>setLogicalTo(e.target.value)}><option value="">Choose port…</option>{logicalCandidates.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <button className="button small" disabled={!logicalTo} onClick={addLogical}>Add supply link</button></div>
    </details>}
    {ownData.length>0&&<details><summary>Data connections ({existingData.length})</summary>
      {existingData.map(c=>{
        const localFrom=ownData.some(p=>p.id===c.fromPortId);
        const own=project.communicationPorts.find(p=>p.id===(localFrom?c.fromPortId:c.toPortId));
        const other=localFrom?c.toPortId:c.fromPortId;
        const choices=project.communicationPorts.filter(p=>p.componentId!==componentId&&p.protocol===own?.protocol&&
          (p.id===other||(!occupied.has(p.id)&&p.role!==own?.role)));
        return <label className="field" key={c.id}><span>{own?.name??'Port'} — connected to</span>
          <select value={other} onChange={e=>patchData(c.id,e.target.value)}>{choices.map(p=><option key={p.id} value={p.id}>{pname(p.id)}</option>)}</select>
          <button className="button small" onClick={()=>change(p=>({...p,communicationConnections:p.communicationConnections.filter(x=>x.id!==c.id)}))}>Remove data cable</button>
        </label>;
      })}
      <div className="form-grid three"><label className="field"><span>Local data port</span><select value={selectedData?.id??''} onChange={e=>{setDataFrom(e.target.value);setDataTo('');}}>{ownData.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="field"><span>Available compatible port</span><select value={dataTo} onChange={e=>setDataTo(e.target.value)}><option value="">Choose port…</option>{dataCandidates.map(p=><option key={p.id} value={p.id}>{pname(p.id)}</option>)}</select></label>
        <button className="button small" disabled={!dataTo} onClick={addData}>Add data connection</button></div>
    </details>}
    {!earths.length&&!dc.length&&!logicalLinks.length&&!existingData.length&&<small>No connections yet. Use an available terminal or port to add one.</small>}
  </div>;
}
