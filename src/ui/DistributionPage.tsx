import {useState} from 'react';
import {AlertTriangle,Plus,Trash2,ExternalLink} from 'lucide-react';
import {selectedBattery,voltageIssues,type Planner} from '../domain/loadPlanner.ts';
import {findModel} from '../domain/charging.ts';
import {
  activeInverter,assignmentFor,busbarRequirements,dcSources,dcTargets,distributionIssues,
  distributionModels,slotsFor,standaloneInverters,occupiedSlots,firstFreeSlot,chargeOutputUnits,type DistributionPlan,
  type DistributionNode,type NodeKind,type DcTarget,type DcAssignment,
} from '../domain/distribution.ts';
import './distribution.css';

type Props={planner:Planner;onChange:(next:DistributionPlan)=>void};
type Tab=12|24|230;
const typeLabel=(t:DcTarget)=>t==='node'?'Distributor':t==='circuit'?'Circuit':t==='load'?'Ungrouped load':'Inverter DC input';
const safeName=(n:string,kind:NodeKind)=>n.trim()||distributionModels[kind].name;
const nextId=()=>crypto.randomUUID();
export function DistributionPage({planner:p,onChange}:Props){
 const [tab,setTab]=useState<Tab>(12);
 const [addKind,setAddKind]=useState<NodeKind>('lynx');
 const [selectedId,setSelectedId]=useState('');
 const [localMessage,setLocalMessage]=useState('');
 const d=p.distribution;
 const battery=selectedBattery(p);
 const batteryV=battery?.systemVoltage;
 const inverter=activeInverter(p);
 const isDc=tab!==230;
 const blocked24=tab===24&&batteryV!==24;
 const nodes=d.nodes.filter(n=>n.voltage===tab);
 const chosen=d.nodes.find(n=>n.id===selectedId&&n.voltage===tab);
 const targets=isDc?dcTargets(p,tab):[];
 const issues=distributionIssues(p);
 const change=(update:Partial<DistributionPlan>)=>{onChange({...d,...update});setLocalMessage('');};
 const addNode=()=>{
  if(tab===230||blocked24)return;
  const node:DistributionNode={id:nextId(),kind:addKind,voltage:tab,
    name:distributionModels[addKind].name+(d.nodes.some(n=>n.kind===addKind)?' '+(1+d.nodes.filter(n=>n.kind===addKind).length):'')};
  change({nodes:[...d.nodes,node]});setSelectedId(node.id);
 };
 const dropNode=(nodeId:string)=>{
  change({nodes:d.nodes.filter(n=>n.id!==nodeId),
   dcAssignments:d.dcAssignments.filter(a=>a.sourceId!==nodeId&&!(a.targetType==='node'&&a.targetId===nodeId)),
   chargerAssignments:d.chargerAssignments.filter(a=>a.destinationId!==nodeId)});
  setSelectedId('');
 };
 const assignDc=(targetType:DcTarget,targetId:string,sourceId:string)=>{
  const current=d.dcAssignments.filter(a=>!(a.targetType===targetType&&a.targetId===targetId));
  if(!sourceId){change({dcAssignments:current});return;}
  const source=d.nodes.find(n=>n.id===sourceId);
  const slots=source?slotsFor(source.kind):0;
  const occupied=new Set([
   ...current.filter(a=>a.sourceId===sourceId).map(a=>a.slot),
   ...d.chargerAssignments.filter(a=>a.destinationId===sourceId).map(a=>a.slot),
  ]);
  let slot:number|null=null;
  if(slots){
   slot=Array.from({length:slots},(_,i)=>i+1).find(pos=>!occupied.has(pos))??null;
   if(slot===null){setLocalMessage('No free branch position on '+safeName(source!.name,source!.kind)+'. Unassign a branch or choose another device.');return;}
  }
  const assignment:DcAssignment={id:nextId(),sourceId,targetType,targetId,slot};
  change({dcAssignments:[...current,assignment]});
 };
 const changeSlot=(id:string,newSlot:number)=>{
  const item=d.dcAssignments.find(a=>a.id===id);if(!item)return;
  const occupied=d.dcAssignments.some(a=>a.id!==id&&a.sourceId===item.sourceId&&a.slot===newSlot)||
   d.chargerAssignments.some(a=>a.destinationId===item.sourceId&&a.slot===newSlot);
  if(occupied){setLocalMessage('That fused position is occupied by another branch or charger.');return;}
  change({dcAssignments:d.dcAssignments.map(a=>a.id===id?{...a,slot:newSlot}:a)});
 };
 const assignCharge=(chargerId:string,destinationId:string)=>{
  const remaining=d.chargerAssignments.filter(a=>a.chargerId!==chargerId);
  if(!destinationId){change({chargerAssignments:remaining});return;}
  const node=d.nodes.find(n=>n.id===destinationId);
  let slot:number|null=null;
  if(node?.kind==='lynx'){
   slot=firstFreeSlot({...d,chargerAssignments:remaining},destinationId);
   if(slot===null){
    setLocalMessage('All four Lynx fused positions are occupied. Free a position before assigning another charger.');
    return;
   }
  }
  change({chargerAssignments:[...remaining,{chargerId,destinationId,slot}]});
 };
 const changeChargeSlot=(chargerId:string,slot:number)=>{
  const charger=d.chargerAssignments.find(a=>a.chargerId===chargerId);
  if(!charger)return;
  const taken=occupiedSlots({...d,chargerAssignments:d.chargerAssignments.filter(a=>a.chargerId!==chargerId)},charger.destinationId);
  if(taken.has(slot)){setLocalMessage('Position '+slot+' is already occupied.');return;}
  change({chargerAssignments:d.chargerAssignments.map(a=>a.chargerId===chargerId?{...a,slot}:a)});
 };
 const assignAc=(targetType:'circuit'|'load',targetId:string,enabled:boolean)=>{
  change({acAssignments:[...d.acAssignments.filter(a=>!(a.targetType===targetType&&a.targetId===targetId)),
   ...(enabled?[{targetType,targetId}]:[])]});
 };
 const sourceOptions=(type:DcTarget,targetId:string)=>{
  if(tab===230)return [];
  return dcSources(p,tab).filter(s=>{
   if(s.id===targetId&&type==='node')return false;
   const node=d.nodes.find(n=>n.id===s.id);
   if((type==='node'||type==='inverter')&&node?.kind==='blue-sea')return false;
   if(type==='node'&&node){
    let cursor=node.id;const visited=new Set<string>();
    while(!visited.has(cursor)){
     if(cursor===targetId)return false;
     visited.add(cursor);
     const parent=assignmentFor(d,'node',cursor)?.sourceId;
     if(!parent||parent==='battery')break;
     cursor=parent;
    }
   }
   return true;
  });
 };
 const destName=(a:DcAssignment)=>a.targetType==='node'?
    safeName(d.nodes.find(n=>n.id===a.targetId)?.name||'','busbar'):
    a.targetType==='circuit'?p.circuits.find(c=>c.id===a.targetId)?.name||'Unnamed circuit':
    a.targetType==='load'?p.loads.find(l=>l.id===a.targetId)?.name||'Unnamed load':
    inverter?.name||'Inverter';
 const sourcesForCharge=tab===230?[]:[
  ...(batteryV===tab?[{id:'battery',name:'Planned battery system'}]:[]),
  ...nodes.filter(n=>n.kind==='lynx'||n.kind==='busbar').map(n=>({id:n.id,name:n.name})),
 ];
 const charges=tab===230?[]:chargeOutputUnits(p).filter(u=>{
  const m=findModel(u.modelId);return m?.outputVoltages.includes(tab);
 });
 const acTargets=[
  ...p.circuits.filter(c=>c.voltage===230).map(c=>({id:c.id,type:'circuit' as const,
    name:c.name||'Unnamed circuit',count:p.loads.filter(l=>l.circuitId===c.id).length})),
  ...p.loads.filter(l=>!l.circuitId&&l.voltage===230).map(l=>({id:l.id,type:'load' as const,
    name:l.name||'Unnamed load',count:1})),
 ];
 const assignedCount=d.dcAssignments.length+d.chargerAssignments.length+d.acAssignments.length;
 return <div className="dist-page">
  <div className="section-heading heading-top"><div>
   <div className="eyebrow">LOGICAL POWER DISTRIBUTION</div>
   <h1>Distribution</h1>
   <p>Associate charging equipment, named circuits and ungrouped loads with planned distribution devices. No cabling or protective-device sizing is inferred.</p>
  </div></div>
  <section className="panel dist-overview">
   <div><span>Distribution devices</span><strong>{d.nodes.length}</strong></div>
   <div><span>Planned associations</span><strong>{assignedCount}</strong></div>
   <div><span>Items for review</span><strong>{issues.length+voltageIssues(p).length}</strong></div>
  </section>
  <div className="planner-tabs dist-tabs" role="tablist" aria-label="Distribution voltage">
   <button role="tab" aria-selected={tab===12} className={tab===12?'active':''}
    onClick={()=>{setTab(12);setSelectedId('');}}>12 V DC</button>
   <button role="tab" aria-selected={tab===24} className={tab===24?'active':''}
    disabled={batteryV!==24} title={batteryV!==24?'Select a 24 V battery or suitable source to enable.':''}
    onClick={()=>{setTab(24);setSelectedId('');}}>24 V DC {batteryV!==24?'(unavailable)':''}</button>
   <button role="tab" aria-selected={tab===230} className={tab===230?'active':''}
    onClick={()=>{setTab(230);setSelectedId('');}}>230 V AC</button>
  </div>
  {localMessage&&<p role="alert" className="validation-warning"><AlertTriangle size={16}/>{localMessage}</p>}
  {blocked24?<section className="panel planner-detail-panel">
   <h2>24 V distribution is unavailable</h2>
   <p>Select a 24 V-capable battery or source first. A 24 V load alone does not create a usable 24 V supply.</p>
  </section>:isDc?<div className="dist-sections">
   <div className="planner-toolbar dist-toolbar">
    <label className="field"><span>Distribution device</span>
     <select value={addKind} onChange={e=>setAddKind(e.target.value as NodeKind)}>
      <option value="lynx">Victron Lynx Distributor · 4 fused positions</option>
      <option value="blue-sea">Blue Sea ST Blade 5026 · 12 fused positions</option>
      <option value="busbar">Generic positive + negative busbars</option>
     </select>
    </label>
    <button className="button primary" onClick={addNode}><Plus size={16}/>Add distribution device</button>
   </div>
   <section className="panel planner-list-panel">
    <div className="panel-head"><h2>{tab} V DC distribution devices</h2><small>{nodes.length} devices · click to edit below</small></div>
    {nodes.length?<div className="planner-list-scroll"><table className="planner-table">
     <thead><tr><th>Device</th><th>Slots</th><th>Used</th><th>Upstream</th><th>Connections required</th></tr></thead>
     <tbody>{nodes.map(n=>{
      const upstream=assignmentFor(d,'node',n.id);
      const slots=slotsFor(n.kind);
      const used=occupiedSlots(d,n.id).size;
      const req=busbarRequirements(p,n.id);
      return <tr key={n.id} className={'planner-select-row '+(selectedId===n.id?'selected':'')}
       onClick={()=>setSelectedId(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedId(n.id);}}}
       tabIndex={0} aria-selected={selectedId===n.id}>
       <td><strong>{safeName(n.name,n.kind)}</strong><small className="dist-small">{distributionModels[n.kind].name}</small></td>
       <td>{slots||'Unfused'}</td><td>{used}</td>
       <td>{upstream?.sourceId==='battery'?'Battery':d.nodes.find(x=>x.id===upstream?.sourceId)?.name||'Unassigned'}</td>
       <td>{req?req.minimumPerBar+' per polarity':'—'}</td>
      </tr>;
     })}</tbody>
    </table></div>:<p className="charging-empty">No {tab} V distribution devices yet. Add a Lynx, Blue Sea 5026, or generic busbar.</p>}
   </section>
   {chosen&&<section className="panel planner-detail-panel dist-detail">
    <div className="panel-head"><h2>Edit distribution device</h2>
     <button className="icon-button danger" aria-label={'Delete '+chosen.name} onClick={()=>dropNode(chosen.id)}><Trash2 size={18}/></button>
    </div>
    <div className="dist-field-grid">
     <label className="field"><span>Friendly name</span>
      <input value={chosen.name} onChange={e=>change({nodes:d.nodes.map(n=>n.id===chosen.id?{...n,name:e.target.value}:n)})}/>
     </label>
     <label className="field"><span>Upstream logical supply</span>
      <select value={assignmentFor(d,'node',chosen.id)?.sourceId||''}
       onChange={e=>assignDc('node',chosen.id,e.target.value)}>
       <option value="">Not assigned</option>
       {sourceOptions('node',chosen.id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
     </label>
    </div>
    <p className="planner-note">{distributionModels[chosen.kind].description}</p>
    {distributionModels[chosen.kind].sourceUrl&&<a href={distributionModels[chosen.kind].sourceUrl}
     target="_blank" rel="noreferrer" className="dist-source">Manufacturer specifications <ExternalLink size={13}/></a>}
    {chosen.kind==='busbar'&&(()=>{
      const req=busbarRequirements(p,chosen.id)!;
      return <div className="dist-busbar-sizing">
       <h3>Recommended minimum terminal capacity</h3>
       <div className="dist-count-grid">
        <div><span>Positive busbar</span><strong>{req.positive}</strong> connections</div>
        <div><span>Negative busbar</span><strong>{req.negative}</strong> connections</div>
       </div>
       <p>Includes {req.upstream} reserved supply connection, {req.downstream} outgoing branch(es) and {req.chargers} charging source(s).</p>
       <p className="planner-note">Allow one terminal per planned branch; negative return paths are indicative, not wired or verified. Confirm current ratings, terminal sizes and protective devices later.</p>
      </div>;
    })()}
    {slotsFor(chosen.kind)>0&&<div className="dist-positions">
      <h3>{chosen.kind==='lynx'?'Four MEGA-fused branches':'Twelve ATC/ATO fused branches'}</h3>
      <div className="dist-slot-grid">
       {Array.from({length:slotsFor(chosen.kind)},(_,i)=>i+1).map(slot=>{
        const a=d.dcAssignments.find(a=>a.sourceId===chosen.id&&a.slot===slot);
        const charger=chosen.kind==='lynx'?
          d.chargerAssignments.find(c=>c.destinationId===chosen.id&&c.slot===slot):undefined;
        const modelUnit=charger?chargeOutputUnits(p).find(u=>u.id===charger.chargerId):undefined;
        const model=modelUnit?findModel(modelUnit.modelId):undefined;
        const used=occupiedSlots({...d,
          dcAssignments:d.dcAssignments.filter(x=>x.id!==a?.id),
          chargerAssignments:d.chargerAssignments.filter(x=>x.chargerId!==charger?.chargerId)},chosen.id);
        return <div key={slot} className={'dist-slot '+(a||charger?'occupied':'')}>
         <strong>Position {slot}</strong>
         {a||charger?<><span>{a?(a.targetType==='inverter'&&inverter?.combined?'Inverter/charger DC connection':typeLabel(a.targetType))+': '+destName(a):
           'Charging source: '+(model?.name||'Unknown charger')}</span>
          <div className="dist-slot-actions">
           <label className="field"><span>Move position</span>
            <select value={slot} onChange={e=>a?changeSlot(a.id,Number(e.target.value)):
              changeChargeSlot(charger!.chargerId,Number(e.target.value))}>
             {Array.from({length:slotsFor(chosen.kind)},(_,x)=>x+1).map(pos=>
              <option key={pos} value={pos} disabled={used.has(pos)}>{pos}</option>)}
            </select>
           </label>
           <button className="button small" onClick={()=>a?assignDc(a.targetType,a.targetId,''):
             assignCharge(charger!.chargerId,'')}>Unassign</button>
          </div></>:<span>Available · fuse not configured</span>}
        </div>;
       })}
      </div>
    </div>}
   </section>}
   <section className="panel planner-list-panel">
    <div className="panel-head"><h2>Named circuits and ungrouped loads</h2>
     <small>Assign a whole named circuit or each individual ungrouped load</small></div>
    {targets.filter(t=>t.targetType==='circuit'||t.targetType==='load').length?<div className="planner-list-scroll">
     <table className="planner-table dist-assignment-table">
      <thead><tr><th>Target</th><th>Type</th><th>Logical source</th><th>Slot</th></tr></thead>
      <tbody>{targets.filter(t=>t.targetType==='circuit'||t.targetType==='load').map(t=>{
       const a=assignmentFor(d,t.targetType,t.targetId);
       return <tr key={t.targetType+':'+t.targetId}>
        <td><strong>{t.name}</strong>{t.targetType==='circuit'&&
         <small className="dist-small">{p.loads.filter(l=>l.circuitId===t.targetId).length} member load(s) · inherited distribution</small>}</td>
        <td>{typeLabel(t.targetType)}</td>
        <td><select aria-label={'Logical supply for '+t.name} value={a?.sourceId||''}
         onChange={e=>assignDc(t.targetType,t.targetId,e.target.value)}>
         <option value="">Unassigned</option>
         {sourceOptions(t.targetType,t.targetId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select></td>
        <td>{a?.slot??'—'}</td>
       </tr>;
      })}</tbody>
     </table>
    </div>:<p className="charging-empty">No {tab} V circuits or ungrouped loads. Create these in Load Calculator.</p>}
   </section>
   <section className="panel planner-list-panel">
    <div className="panel-head"><h2>DC equipment connections</h2>
     <small>MPPT, DC–DC and shore chargers, alongside selected inverter or inverter/charger</small></div>
    {(charges.length>0||inverter?.voltage===tab)?<div className="planner-list-scroll"><table className="planner-table">
     <thead><tr><th>Equipment</th><th>DC side</th><th>Battery / DC distribution</th><th>Lynx position</th></tr></thead>
     <tbody>{charges.map(u=>{
      const m=findModel(u.modelId)!;
      const current=d.chargerAssignments.find(a=>a.chargerId===u.id);
      return <tr key={u.id}>
       <td><strong>{m.name}</strong><small className="dist-small">
         {m.kind==='mppt'?'Solar MPPT':m.kind==='shoreCharger'?'Shore battery charger':'DC–DC'}
         {' · '}{m.kind==='shoreCharger'?'Selected in Shore Power':u.id.slice(0,8)}
        </small></td>
       <td>{m.outputVoltages.join('/')} V</td>
       <td><select value={current?.destinationId||''} aria-label={'Output destination for '+m.name}
        onChange={e=>assignCharge(u.id,e.target.value)}>
        <option value="">Unassigned</option>
        {sourcesForCharge.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
       </select></td>
       <td>{current&&nodes.find(n=>n.id===current.destinationId)?.kind==='lynx'
        ?<select aria-label={'Lynx position for '+m.name} value={current.slot??''}
          onChange={e=>changeChargeSlot(u.id,Number(e.target.value))}>
          <option value="" disabled>Unallocated</option>
          {[1,2,3,4].map(pos=><option key={pos} value={pos}
            disabled={occupiedSlots({...d,chargerAssignments:d.chargerAssignments.filter(a=>a.chargerId!==u.id)},current.destinationId).has(pos)}>
            Position {pos}</option>)}
         </select>:<span>—</span>}</td>
      </tr>;
     })}
     {inverter?.voltage===tab&&(()=>{
      const link=assignmentFor(d,'inverter','inverter');
      const lynx=nodes.find(n=>n.id===link?.sourceId&&n.kind==='lynx');
      return <tr key="inverter-battery-link">
       <td><strong>{inverter.name}</strong>
        <small className="dist-small">{inverter.combined?'Combined inverter / charger · bidirectional DC':'Standalone inverter · DC input'}
         {' · '}selected for 230 V loads</small>
       </td>
       <td>{inverter.voltage} V {inverter.combined?'charge / discharge':'DC input'}</td>
       <td><select value={link?.sourceId||''} aria-label={'DC battery-side association for '+inverter.name}
         onChange={e=>assignDc('inverter','inverter',e.target.value)}>
         <option value="">Unassigned</option>
         {sourceOptions('inverter','inverter').map(source=>
          <option key={source.id} value={source.id}>{source.name}</option>)}
       </select></td>
       <td>{lynx&&link?
        <select value={link.slot??''} aria-label={'Lynx position for '+inverter.name}
          onChange={e=>changeSlot(link.id,Number(e.target.value))}>
          <option value="" disabled>Unallocated</option>
          {[1,2,3,4].map(pos=><option key={pos} value={pos}
            disabled={occupiedSlots({...d,
              dcAssignments:d.dcAssignments.filter(a=>a.id!==link.id)},lynx.id).has(pos)}>
             Position {pos}
            </option>)}
        </select>:<span>—</span>}</td>
      </tr>;
     })()}</tbody>
    </table></div>:<p className="charging-empty">No battery-side charging or inverter equipment selected for this voltage. Select equipment in Charging or the 230 V Distribution tab.</p>}
    <p className="planner-note">Every item uses one logical battery-side association. A combined inverter/charger draws DC when inverting and charges the battery over the same link, so it occupies only one Lynx position. Actual fuse ratings, terminals and return conductors are not yet designed.</p>
   </section>
  </div>:<div className="dist-sections">
   <section className="panel planner-detail-panel">
    <h2>230 V inverter source</h2>
    {p.charging.shoreModelId&&findModel(p.charging.shoreModelId)?.kind==='shoreCharger'&&
     <p className="planner-note">Selected shore charger: {findModel(p.charging.shoreModelId)?.name}. This consumes AC to charge the battery; it does not provide an AC inverter output.</p>}
    {inverter?.combined?<div className="dist-inverter">
     <h3>{inverter.name}</h3>
     <p>Selected in Shore Power. Automatically offered here as the 230 V AC source. No second inverter has been created.</p>
     <p>{inverter.voltage} V DC input · {inverter.va} VA AC output</p>
     <a href={inverter.sourceUrl} target="_blank" rel="noreferrer">Manufacturer specifications</a>
    </div>:<>
     <label className="field"><span>Select standalone inverter</span>
      <select value={d.standaloneInverterId||''}
       onChange={e=>change({standaloneInverterId:e.target.value||null})}>
       <option value="">No standalone inverter</option>
       {standaloneInverters.map(m=><option key={m.id} value={m.id}>{m.name} · {m.va} VA</option>)}
      </select>
     </label>
     {inverter&&<div className="dist-inverter">
      <h3>{inverter.name}</h3><p>{inverter.voltage} V battery side · {inverter.va} VA · 230 V AC output</p>
      <a href={inverter.sourceUrl} target="_blank" rel="noreferrer">Manufacturer specifications</a>
     </div>}
    </>}
    {inverter&&batteryV!==inverter.voltage&&<p className="validation-warning">
     <AlertTriangle size={17}/>The selected inverter DC input is {inverter.voltage} V; the planned battery {batteryV===undefined?'is missing':'is '+batteryV+' V'}.</p>}
    <p className="planner-note">Inverter DC input is listed under the matching DC voltage tab for assignment. AC transfer switching, shore topology, consumer units, breakers and PE/N are deferred.</p>
   </section>
   <section className="panel planner-list-panel">
    <div className="panel-head"><h2>230 V circuits and ungrouped loads</h2>
     <small>One logical inverter output grouping, not physical AC wiring</small></div>
    {acTargets.length?<div className="planner-list-scroll">
     <table className="planner-table">
      <thead><tr><th>Target</th><th>Type</th><th>Member loads</th><th>Inverter output</th></tr></thead>
      <tbody>{acTargets.map(t=>{
       const checked=d.acAssignments.some(a=>a.targetType===t.type&&a.targetId===t.id);
       return <tr key={t.type+':'+t.id}>
        <td>{t.name}</td><td>{t.type==='circuit'?'Named circuit':'Ungrouped load'}</td><td>{t.count}</td>
        <td><select value={checked?'inverter':''} disabled={!inverter}
         aria-label={'230 V source for '+t.name}
         onChange={e=>assignAc(t.type,t.id,e.target.value==='inverter')}>
         <option value="">Unassigned</option>
         <option value="inverter">Planned inverter output</option>
        </select></td>
       </tr>;
      })}</tbody>
     </table>
    </div>:<p className="charging-empty">No 230 V circuits or ungrouped loads. Add them in Load Calculator.</p>}
   </section>
  </div>}
  {issues.length>0&&<section className="panel planner-detail-panel">
   <div className="panel-head"><h2>Distribution review</h2><small>{issues.length} finding(s), including incomplete assignments</small></div>
   <div className="dist-issues">{issues.map((issue,i)=><div key={i}
    className={issue.level==='error'?'validation-warning':'dist-review'}>
     <AlertTriangle size={15}/><span>{issue.message}</span>
    </div>)}</div>
  </section>}
  <p className="planner-note">Staged planning assignments only: no physical terminals, fuse ratings, cable lengths, earthing or 230 V consumer-unit protection have been created. Press Update to save, or Reset to revert.</p>
 </div>;
}
