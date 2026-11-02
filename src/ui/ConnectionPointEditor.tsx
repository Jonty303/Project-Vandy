import {useState} from 'react';
import {Plus,Trash2,AlertTriangle} from 'lucide-react';
import type {Planner} from '../domain/loadPlanner.ts';
import {
  newSocket,socketName,connectedSocket,connectionIssues,type ConnectionPlan,type SocketKind,
} from '../domain/connectionPoints.ts';
import './connectionPoints.css';

type Props={planner:Planner;onChange:(next:ConnectionPlan)=>void};
export function CircuitSocketEditor({planner,onChange,circuitId}:Props&{circuitId:string}){
 const circuit=planner.circuits.find(c=>c.id===circuitId);
 const sockets=planner.connections.sockets.filter(s=>s.circuitId===circuitId);
 const [count,setCount]=useState<1|2>(2);
 const [kind,setKind]=useState<SocketKind>('usb');
 if(!circuit)return null;
 const suggestedKind=circuit.voltage===230?'uk-3pin':'usb';
 const add=()=>{
  const chosen=circuit.voltage===230?'uk-3pin':'usb';
  const socket=newSocket(chosen,circuitId,count,crypto.randomUUID());
  onChange({...planner.connections,sockets:[...planner.connections.sockets,socket]});
 };
 const links=planner.connections.loadSocketLinks;
 const issues=connectionIssues(planner);
 return <section className="cp-section">
  <h3>Socket connection points <small>(no additional electricity demand)</small></h3>
  <p className="planner-note">A socket is a distribution point, not an electrical load. Phone, tablet, laptop and Starlink demand remains in the Load Calculator.</p>
  <div className="cp-controls">
   <label className="field"><span>Type for {circuit.voltage} V circuit</span>
    <select value={circuit.voltage===230?'uk-3pin':'usb'} disabled
      onChange={e=>setKind(e.target.value as SocketKind)}>
     <option value="usb">USB charging socket (DC circuit)</option>
     <option value="uk-3pin">UK 3-pin socket (230 V circuit)</option>
    </select>
   </label>
   <label className="field"><span>{suggestedKind==='usb'?'USB ports':'3-pin outlets'}</span>
    <select value={count} onChange={e=>setCount(Number(e.target.value) as 1|2)}>
     <option value={1}>One</option><option value={2}>Two</option>
    </select>
   </label>
   <button className="button primary" type="button" onClick={add}><Plus size={15}/>
    Add {suggestedKind==='usb'?'USB':'3-pin'} socket</button>
  </div>
  {sockets.length===0?<p className="charging-empty">No sockets added to this circuit.</p>:
   <div className="cp-socket-list">{sockets.map(socket=>{
    const attached=links.filter(a=>a.socketId===socket.id);
    return <div className="cp-socket" key={socket.id}>
     <div className="cp-socket-head">
      <strong>{socket.name||socketName(socket.kind,socket.positions)}</strong>
      <button className="icon-button danger" type="button" aria-label={'Remove '+socket.name}
       onClick={()=>onChange({...planner.connections,
        sockets:planner.connections.sockets.filter(s=>s.id!==socket.id),
        loadSocketLinks:links.filter(l=>l.socketId!==socket.id)})}><Trash2 size={17}/></button>
     </div>
     <div className="cp-fields">
      <label className="field"><span>Socket name</span>
       <input value={socket.name} onChange={e=>onChange({...planner.connections,
        sockets:planner.connections.sockets.map(s=>s.id===socket.id?{...s,name:e.target.value}:s)})}/>
      </label>
      <label className="field"><span>{socket.kind==='usb'?'USB ports':'3-pin outlets'}</span>
       <select value={socket.positions} onChange={e=>{
        const positions=Number(e.target.value) as 1|2;
        onChange({...planner.connections,
          sockets:planner.connections.sockets.map(s=>s.id===socket.id?{...s,positions}:s),
          loadSocketLinks:links.filter(l=>l.socketId!==socket.id||
           links.filter(a=>a.socketId===socket.id).findIndex(a=>a.loadId===l.loadId)<positions)});
       }}>
        <option value={1}>1</option><option value={2}>2</option>
       </select>
      </label>
     </div>
     <small>{attached.length}/{socket.positions} linked device(s) · {socket.kind==='uk-3pin'?'230 V AC':'DC-to-USB conversion'} not yet specified</small>
     {attached.map(a=><div className="cp-attached" key={a.loadId}>
      {planner.loads.find(l=>l.id===a.loadId)?.name||'Unnamed device'}
      <button className="button small" onClick={()=>onChange({...planner.connections,
       loadSocketLinks:links.filter(l=>l.loadId!==a.loadId)})}>Disconnect</button>
     </div>)}
     {issues.filter(i=>i.id===socket.id).map((i,idx)=><p className="planner-note" key={idx}>
      <AlertTriangle size={13}/> {i.message}</p>)}
    </div>;
   })}</div>}
 </section>;
}
export function LoadSocketSelector({planner,onChange,loadId}:Props&{loadId:string}){
 const load=planner.loads.find(l=>l.id===loadId);
 if(!load)return null;
 const sockets=planner.connections.sockets;
 const selected=connectedSocket(planner,load.id);
 const issues=connectionIssues(planner).filter(i=>i.id===load.id);
 const links=planner.connections.loadSocketLinks;
 const compatible=sockets.filter(s=>{
  const circuit=planner.circuits.find(c=>c.id===s.circuitId);
  return s.kind==='uk-3pin'?load.voltage===230&&circuit?.voltage===230:
   load.voltage!==230&&circuit?.voltage!==230;
 });
 const list=selected&&!compatible.some(s=>s.id===selected.id)?[selected,...compatible]:compatible;
 const attach=(socketId:string)=>{
  const remaining=links.filter(l=>l.loadId!==load.id);
  if(!socketId){onChange({...planner.connections,loadSocketLinks:remaining});return;}
  const socket=sockets.find(s=>s.id===socketId);
  if(!socket)return;
  if(remaining.filter(l=>l.socketId===socketId).length>=socket.positions)return;
  onChange({...planner.connections,loadSocketLinks:[...remaining,{loadId:load.id,socketId}]});
 };
 return <section className="cp-section cp-load-choice">
  <h3>Device socket association</h3>
  <label className="field"><span>Supplied/charged through</span>
   <select value={selected?.id??''} onChange={e=>attach(e.target.value)}>
    <option value="">No socket assigned (direct/unresolved)</option>
    {list.map(socket=>{
     const taken=links.filter(a=>a.socketId===socket.id&&a.loadId!==load.id).length;
     return <option key={socket.id} value={socket.id} disabled={taken>=socket.positions}>
      {socket.name||socketName(socket.kind,socket.positions)}
      {' · '}{planner.circuits.find(c=>c.id===socket.circuitId)?.name||'Unnamed circuit'}
      {' · '}{taken}/{socket.positions} in use
     </option>;
    })}
   </select>
  </label>
  <p className="planner-note">Assigning a socket changes neither this load's hours nor its calculated Wh. Each device is linked to at most one outlet; socket capacity is a connection count, not a power rating.</p>
  {issues.map((issue,i)=><p className="validation-warning" key={i}><AlertTriangle size={14}/>{issue.message}</p>)}
 </section>;
}
