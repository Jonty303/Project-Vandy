import { useMemo, useState } from 'react';
import { AlertTriangle, Cable, CircleHelp, Info, ShieldCheck } from 'lucide-react';
import type { DcCableRun, DcFuseRecord, DcWiringPlan, Project } from '../domain/model.ts';
import { effectiveWiring, sizeCable, validateWiring } from '../domain/dcWiring.ts';
import { dcKind } from '../domain/terminals.ts';

type Props={project:Project;change:(fn:(p:Project)=>Project)=>void};
const asNumber=(value:string):number|null=>value.trim()===''?null:Number(value);
const num=(value:number|null)=>value===null?'':String(value);
const fuseStatuses=['proposed','reported','unknown'] as const;
const placements=['unconfirmed','battery-end','distribution-end','equipment-end','integrated-in-distributor'] as const;
export function DcWiringPage({project,change}:Props){
 const plan=effectiveWiring(project);
 const [section,setSection]=useState<'all'|'trunk'|'lynx'|'blue-sea'>('all');
 const issues=useMemo(()=>validateWiring(plan),[plan]);
 const blockers=issues.filter(i=>i.severity==='blocker');
 const componentName=(id?:string)=>project.components.find(c=>c.id===id)?.name??(id??'Unconfirmed');
 const circuitName=(id?:string)=>project.circuits.find(c=>c.id===id)?.name??(id??'Unconfirmed');
 const patchPlan=(fn:(x:DcWiringPlan)=>DcWiringPlan)=>change(p=>({...p,dcWiring:fn(structuredClone(effectiveWiring(p)))}));
 const patchFuse=(id:string,patch:Partial<DcFuseRecord>)=>patchPlan(p=>({...p,fuses:p.fuses.map(f=>f.id===id?{...f,...patch}:f)}));
 const patchCable=(id:string,patch:Partial<DcCableRun>)=>patchPlan(p=>({...p,cables:p.cables.map(c=>c.id===id?{...c,...patch}:c)}));
 const fuseSection=(f:DcFuseRecord)=>f.holderComponentId==='lynx'?'lynx':f.holderComponentId==='blue-sea'?'blue-sea':'trunk';
 const shownFuses=plan.fuses.filter(f=>section==='all'||fuseSection(f)===section);
 const shownCables=plan.cables.filter(c=>{
    if(section==='all')return true;
    if(section==='trunk')return !c.fuseId||fuseSection(plan.fuses.find(f=>f.id===c.fuseId)??{holderComponentId:null} as DcFuseRecord)==='trunk';
    return c.fuseId?fuseSection(plan.fuses.find(f=>f.id===c.fuseId)??{holderComponentId:null} as DcFuseRecord)===section:
       section==='blue-sea'&&c.fromComponentId==='blue-sea';
 });
 return <div className="dc-wiring-page">
  <div className="section-heading heading-top"><div><div className="eyebrow">ITERATION 03 / PROVISIONAL WIRING PLAN</div>
    <h1>DC cables & fuses</h1><p>As-reported battery connections plus provisional Lynx and Blue Sea fuse assignments. Set the length of every cable and review metric / US cable sizes.</p></div></div>
  <div className="notice"><AlertTriangle size={20}/><div><strong>Planning only — not a safe-to-build cable schedule</strong>
     <p>All cable lengths default to 1m <em>per conductor</em> unless changed. Suggested conductors are computed from design-current assumptions, manufacturer minimums and a 3% voltage-drop target; they are <strong>not ampacity or fault-clearance approvals</strong>. Final fuse sizing depends on cable construction, grouping, terminal limits, overcurrent behaviour and the battery's prospective short-circuit current.</p></div></div>
  <div className="wiring-mini-facts">
    <span><ShieldCheck size={15}/> 150A main fuse — owner checked</span>
    <span><ShieldCheck size={15}/> 70A Orion input — owner checked</span>
    <span><ShieldCheck size={15}/> 70A Orion output — owner checked</span>
    <span><CircleHelp size={15}/> Remaining fuses — proposed</span>
  </div>
  <div className="overview-tabs" role="group" aria-label="Filter DC circuit protection">
   {([['all','All runs'],['trunk','Battery & charging'],['lynx','Lynx distributor'],['blue-sea','Blue Sea 5026']] as const).map(([id,label])=>
    <button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}>{label}</button>)}
  </div>
  <section className="panel"><div className="panel-head"><div><h2>Fuse schedule and physical position</h2><p>Source-side/battery-side versus equipment-end is recorded separately from its nominal amp rating.</p></div></div>
    <div className="fuse-schedule">{shownFuses.map(f=><div className="fuse-row" key={f.id}>
      <div className="fuse-title"><strong>{f.label}</strong><small>{f.holderComponentId?componentName(f.holderComponentId):'Independent in-line fuse'}{f.slot!==null?` · position ${f.slot}`:''}</small></div>
      <div className="fuse-fields">
       <label>{f.status==='reported'?'Current fuse rating (A)':'Proposed fuse rating (A)'}<input type="number" min="0" step="1" placeholder="Unknown" value={num(f.ratingA)} onChange={e=>patchFuse(f.id,{ratingA:asNumber(e.target.value)})}/></label>
       <label>Fuse status<select value={f.status} onChange={e=>patchFuse(f.id,{status:e.target.value as DcFuseRecord['status']})}>{fuseStatuses.map(x=><option key={x}>{x}</option>)}</select></label>
       <label>Current fuse location<select value={f.placement} onChange={e=>patchFuse(f.id,{placement:e.target.value as DcFuseRecord['placement']})}>{placements.map(x=><option key={x} value={x}>{x.replaceAll('-',' ')}</option>)}</select></label>
       <label>Nearest device<select value={f.nearComponentId??''} onChange={e=>patchFuse(f.id,{nearComponentId:e.target.value||null})}><option value="">Unconfirmed</option>{project.components.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
       <label>Fuse form<select value={f.fuseForm} onChange={e=>patchFuse(f.id,{fuseForm:e.target.value as DcFuseRecord['fuseForm']})}>{(['unknown','inline','MEGA','ATO-ATC'] as const).map(x=><option key={x}>{x}</option>)}</select></label>
      </div>
      <div className="fuse-notes">{f.notes}
        {f.relativeElectricalOrder&&<p><strong>Reported electrical order:</strong> {f.relativeElectricalOrder}</p>}
        {f.recommendedPlacement&&<p><strong>Recommended fuse position:</strong> {f.recommendedPlacement.replaceAll('-',' ')} near {componentName(f.recommendedNearComponentId??undefined)}. This recommendation does not confirm the installed distance.</p>}
      </div>
      {f.id.startsWith('orion-')&&<p className="field-warning"><Info size={15}/> The owner confirmed 70A on both Orion sides; their physical distances from the two batteries remain unverified. A fuse at the Orion/load end alone does not protect the battery-to-fuse conductor.</p>}
      {f.status==='proposed'&&<p className="field-warning"><Info size={15}/> Provisional rating and position. Not confirmed installed.</p>}
      {issues.filter(i=>i.id===f.id&&i.severity==='blocker').map((i,index)=><p key={index} className="field-blocker"><AlertTriangle size={15}/>{i.message}</p>)}
    </div>)}</div>
  </section>
  <section className="panel"><div className="panel-head"><div><h2><Cable size={19}/> Cable lengths & conductor sizing</h2>
    <p>Update a length to recalculate the provisional conductor size and an indicative voltage drop assuming an equal-length return. Actual positive and negative lengths may differ and must be checked together.</p></div></div>
    <div className="dc-cable-list">{shownCables.map(c=>{
      const linkedFuse=plan.fuses.find(f=>f.id===c.fuseId)??(c.toCircuitId?
        plan.fuses.find(f=>f.holderComponentId==='blue-sea'&&
          project.circuits.find(t=>t.id===c.toCircuitId)?.sourceOutputId==='fuse-'+f.slot):undefined);
      const result=sizeCable(c,linkedFuse?.ratingA??null);
      return <div key={c.id} className="dc-cable-row">
       <div className="cable-name"><strong>{c.name}</strong><small>{componentName(c.fromComponentId)} → {c.toCircuitId?circuitName(c.toCircuitId):componentName(c.toComponentId)} · {c.polarity}</small></div>
       <div className="dc-cable-fields">
        <label>Source terminal<select value={c.fromTerminalId??''} onChange={e=>patchCable(c.id,{fromTerminalId:e.target.value||undefined})}>
          <option value="">Unknown / not assigned</option>
          {(project.components.find(x=>x.id===c.fromComponentId)?.terminals??[]).filter(t=>t.kind===dcKind(c.polarity))
            .map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
        </select></label>
        {c.toComponentId&&<label>Destination terminal<select value={c.toTerminalId??''} onChange={e=>patchCable(c.id,{toTerminalId:e.target.value||undefined})}>
          <option value="">Unknown / not assigned</option>
          {(project.components.find(x=>x.id===c.toComponentId)?.terminals??[]).filter(t=>t.kind===dcKind(c.polarity))
            .map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
        </select></label>}
        <label>One-way length (m)<input type="number" step=".1" min=".1" value={c.lengthM} onChange={e=>patchCable(c.id,{lengthM:Number(e.target.value)})}/></label>
        <label>Length evidence<select value={c.lengthEvidence} onChange={e=>patchCable(c.id,{lengthEvidence:e.target.value as DcCableRun['lengthEvidence']})}>
         {(['assumed','reported','measured'] as const).map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Design current (A)<input type="number" min="0" step=".1" placeholder="Unknown" value={num(c.designCurrentA)}
          onChange={e=>patchCable(c.id,{designCurrentA:asNumber(e.target.value)})}/></label>
        <label>Manufacturer minimum (mm²)<input type="number" min="0" step=".5" placeholder="Unknown" value={num(c.manufacturerMinMm2)}
          onChange={e=>patchCable(c.id,{manufacturerMinMm2:asNumber(e.target.value)})}/></label>
        <label>Wire (UK metric)<div className="computed-size">{result.mm2===null?'Unknown':`${result.mm2} mm²`}</div></label>
        <label>Wire (US AWG)<div className="computed-size">{result.awg===null?'Unknown':`AWG ${result.awg.awg} (${result.awg.actualMm2} mm²)`}</div></label>
        <label>Indicative voltage drop<div className="computed-size">{result.voltageDropPct===null?'Unknown':`${result.voltageDropPct.toFixed(2)}%`}</div></label>
        <label>Protective fuse<div className="computed-size">{linkedFuse?`${linkedFuse.ratingA??'?'}A · ${linkedFuse.placement}`:'None recorded — check required'}</div></label>
       </div>
       <p className="cable-notes">{c.notes}</p>
       <p className="cable-notes"><strong>Sizing basis:</strong> {result.note}</p>
       {c.lengthEvidence==='assumed'&&<p className="field-warning"><AlertTriangle size={14}/> 1m planning assumption, not measured.</p>}
       {c.designCurrentA===null&&<p className="field-warning"><AlertTriangle size={14}/> Load current is unknown. The indicated wire size uses the proposed fuse rating as a conservative sizing envelope, not a measured device demand. You may save this incomplete circuit.</p>}
       {issues.filter(i=>i.id===c.id&&i.severity==='blocker').map((i,index)=><p className="field-blocker" key={index}><AlertTriangle size={14}/>{i.message}</p>)}
      </div>;
    })}</div>
    <p className="autonomy-note">Generic conversions round up to the smallest AWG with an area no less than the metric nominal. <strong>Exception:</strong> Victron explicitly approves either 16mm² or AWG6 (13.3mm²) for the Orion XS under 5m; AWG4 (21.2mm²) is specified for 5–10m. These are approved alternatives, not equivalent cross-sectional areas, and the Orion XS terminal maximum is AWG4.</p>
  </section>
  <section className="panel"><div className="panel-head"><h2>Outstanding verification</h2></div>
   <p className="autonomy-note">There are {blockers.length} structural blockers and {issues.filter(i=>i.severity==='incomplete').length} incomplete records. Missing specifications can be saved; impossible cable lengths, negative current or fuses over Blue Sea's 30A/circuit limit cannot.</p>
   {issues.filter(i=>i.severity==='warning').map((i,index)=><p key={index} className="field-warning"><AlertTriangle size={15}/>{i.message}</p>)}
   <label className="field"><span>Wiring schedule notes</span><textarea value={plan.notes} rows={3} onChange={e=>patchPlan(p=>({...p,notes:e.target.value}))}/></label>
  </section>
 </div>;
}
