import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, AlertTriangle, BatteryCharging, Cable, Check, ChevronDown, CloudSun, CircleHelp, Cpu, Download, Gauge, Layers, Network, Plus, RotateCcw, Save, Settings, ShieldAlert, Trash2, Upload, Zap, GitBranch, BatteryFull } from 'lucide-react';
import type { Circuit, Evidence, Load, LoadKind, OperatingMode, Project, Supply } from '../domain/model.ts';
import { calculateProject, ledRatedWatts } from '../domain/calculations.ts';
import { loadProject, saveProject, migrateProject } from '../domain/storage.ts';
import { TopologyPage } from './Topology.tsx';
import { resolveLogicalSupply, suggestedCircuitSource } from '../domain/supply.ts';
import { AutonomyPage } from './Autonomy.tsx';
import { seedProject } from '../data/vandy.ts';
import { BatteriesPage } from './Batteries.tsx';
import { ConnectivityPage } from './Connectivity.tsx';
import { SystemOverviewPage } from './SystemOverview.tsx';
import { validateProject } from '../domain/storage.ts';
import { validateBattery, summarizeBank, activeBankSummary, batteryCapacityForPlanning } from '../domain/batteries.ts';
import { validateCommunicationDraft } from '../domain/connectivity.ts';

type Page = 'overview' | 'system-2d' | 'loads' | 'topology' | 'autonomy' | 'batteries' | 'connectivity' | 'equipment' | 'settings';
const fmt = (value: number, digits = 0) => value.toLocaleString('en-GB', { maximumFractionDigits: digits });
const makeId = () => crypto.randomUUID();
const toNullable = (value: string) => value.trim() === '' ? null : Math.max(0, Number(value));
const inputNumeric = (value: number | null | undefined) => value === null || value === undefined ? '' : value;
const evidenceLabels: Record<Evidence, string> = { manual:'Manufacturer manual', measured:'Measured', reported:'Owner-reported', listing:'Online listing', estimated:'Estimated', unknown:'Unknown' };
const supplyLabels: Record<Supply,string> = { dc:'DC', 'ac-inverter':'230V via inverter', 'ac-shore':'230V shore only' };

function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'accent' }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}
function Field({ label, children, hint }: { label:string; children:ReactNode; hint?:string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Empty({ children }: {children:ReactNode}) { return <div className="empty"><CircleHelp size={26}/><p>{children}</p></div>; }
function createMode(project: Project): OperatingMode {
  return { id: makeId(), name:'Running', watts:null, evidence:'unknown', usage:Object.fromEntries(project.profiles.map(p => [p.id,{minutesPerDay:0,dutyFraction:1}])) };
}
function createLoad(project: Project, circuitId: string): Load {
  return {id:makeId(),name:'New appliance',circuitId,kind:'standard',modes:[createMode(project)]};
}

export function App() {
  const [savedProject,setSavedProject] = useState<Project>(loadProject);
  const [project,setProject] = useState<Project>(()=>structuredClone(savedProject));
  const [page,setPage] = useState<Page>('overview');
  const [profileId,setProfileId] = useState('normal');
  const [selectedCircuit,setSelectedCircuit] = useState('toilet');
  const [selectedLoad,setSelectedLoad] = useState<string | null>('toilet-light');
  const [message,setMessage] = useState('');
  const [persisted,setPersisted] = useState(true);
  const [saveErrors,setSaveErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = project.profiles.find(p => p.id === profileId) ?? project.profiles[0];
  const activeProfileId = profile?.id ?? 'normal';
  const totals = useMemo(() => calculateProject(project,activeProfileId),[project,activeProfileId]);
  const circuit = project.circuits.find(c=>c.id===selectedCircuit) ?? project.circuits[0];
  const load = project.loads.find(l=>l.id===selectedLoad) ?? null;
  useEffect(() => {setPersisted(saveProject(savedProject));},[savedProject]);
  const dirty=JSON.stringify(project)!==JSON.stringify(savedProject);
  const editBlockers=[
    ...(!project.name.trim()?['Project settings: a project name is required.']:[]),
    ...project.batteries.flatMap(b=>validateBattery(b).filter(d=>d.level==='blocker').map(d=>`${b.name||'Unnamed battery'} — ${d.message}`)),
    ...project.batteryBanks.flatMap(b=>summarizeBank(project,b).diagnostics.filter(d=>d.level==='blocker').map(d=>`${b.name||'Unnamed bank'} — ${d.message}`)),
    ...validateCommunicationDraft(project).map(d=>d.message),
    ...(!validateProject(project)?['Project data is structurally invalid. Check field values and referenced components before updating.']:[])
  ];
  function resetPageEdits(){setProject(structuredClone(savedProject));setSaveErrors([]);setMessage('Changes discarded; last saved values restored.');}
  function updatePage(){
    if(editBlockers.length){setSaveErrors(editBlockers);return;}
    setSavedProject(structuredClone(project));setSaveErrors([]);setMessage('Updated and saved to this browser.');
  }
  function navigate(next:Page){
    if(next===page)return;
    if(dirty&&!confirm('You have changes not yet updated. Discard them and switch sections?'))return;
    if(dirty)setProject(structuredClone(savedProject));
    setSaveErrors([]);setPage(next);
  }
  useEffect(()=>{
    const handler=(event:BeforeUnloadEvent)=>{
      if(dirty){event.preventDefault();event.returnValue='';}
    };
    window.addEventListener('beforeunload',handler);
    return ()=>window.removeEventListener('beforeunload',handler);
  },[dirty]);
  function patchProject(fn:(p:Project)=>Project) { setProject(current=>fn(current)); }
  function patchCircuit(id:string,patch:Partial<Circuit>) {
    patchProject(p=>({...p,circuits:p.circuits.map(c=>c.id===id?{...c,...patch}:c)}));
  }
  function patchLoad(id:string,patch:Partial<Load>) {
    patchProject(p=>({...p,loads:p.loads.map(l=>l.id===id?{...l,...patch}:l)}));
  }
  function patchMode(loadId:string,modeId:string,patch:Partial<OperatingMode>) {
    patchProject(p=>({...p,loads:p.loads.map(l=>l.id===loadId?{...l,modes:l.modes.map(m=>m.id===modeId?{...m,...patch}:m)}:l)}));
  }
  function patchModeUsage(loadId:string,modeId:string,key:'minutesPerDay'|'dutyFraction',value:number) {
    patchProject(p=>({...p,loads:p.loads.map(l=>l.id===loadId?{...l,modes:l.modes.map(m=>m.id===modeId?{
      ...m, usage:{...m.usage,[activeProfileId]:{...(m.usage[activeProfileId] ?? {minutesPerDay:0,dutyFraction:1}),[key]:value}}
    }:m)}:l)}));
  }
  function addCircuit() {
    const id=makeId();
    patchProject(p=>({...p,circuits:[...p.circuits,{id,name:'New circuit',supply:'dc',voltage:p.nominalBatteryVoltage}]}));
    setSelectedCircuit(id);setSelectedLoad(null);setPage('loads');
  }
  function moveConsumerToSupply(loadId:string,supply:Supply,voltage:12|24|230){
    const existing=project.circuits.find(c=>c.supply===supply&&c.voltage===voltage);
    let targetId=existing?.id;
    if(!targetId){
      targetId=makeId();
      const id=targetId;
      patchProject(p=>({...p,circuits:[...p.circuits,{id,name:supply==='dc'?`${voltage}V DC consumers`:supply==='ac-inverter'?'Inverter-backed AC consumers':'Shore-only AC consumers',supply,voltage,sourceComponentId:suggestedCircuitSource(p,supply)}],
        loads:p.loads.map(l=>l.id===loadId?{...l,circuitId:id}:l)}));
    }else{
      const id=targetId;
      patchProject(p=>({...p,loads:p.loads.map(l=>l.id===loadId?{...l,circuitId:id}:l)}));
    }
    setSelectedCircuit(targetId);
  }
  function addLoad() {
    if (!circuit) return;
    const next=createLoad(project,circuit.id);
    patchProject(p=>({...p,loads:[...p.loads,next]}));setSelectedLoad(next.id);
  }
  function removeLoad(id:string) {
    if (!confirm('Remove this consumer from the project?')) return;
    patchProject(p=>({...p,loads:p.loads.filter(l=>l.id!==id)}));setSelectedLoad(null);
  }
  function removeCircuit(id:string) {
    if (project.loads.some(l=>l.circuitId===id)) {setMessage('Move or delete the consumers before removing this circuit.');return;}
    if (!confirm('Remove this empty circuit?')) return;
    patchProject(p=>({...p,circuits:p.circuits.filter(c=>c.id!==id)}));setSelectedCircuit(project.circuits.find(c=>c.id!==id)?.id ?? '');
  }
  function exportProject() {
    if(dirty){setMessage('Update your edited fields before exporting, or Reset to export the last saved values.');return;}
    const blob=new Blob([JSON.stringify(savedProject,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='vandy-project-v3.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setMessage('Project JSON exported.');
  }
  async function importProject(file:File | undefined) {
    if (!file) return;
    try {
      if (file.size>2_000_000) throw Error('Project file is too large (maximum 2MB).');
      const value: unknown=JSON.parse(await file.text());
      const imported=migrateProject(value);
      if (!imported) throw Error('Unsupported or invalid Project Vandy schema.');
      setSavedProject(structuredClone(imported));setProject(structuredClone(imported));setProfileId(imported.profiles[0]?.id ?? 'normal');
      setSelectedCircuit(imported.circuits[0]?.id ?? '');setSelectedLoad(null);setMessage('Project imported successfully (older projects migrated to v3).');
    } catch(e) {setMessage(e instanceof Error?e.message:'Unable to import project.');}
    finally {if(fileRef.current) fileRef.current.value='';}
  }
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Zap size={24} fill="currentColor" /></div><div><strong>VANDY</strong><small>POWER STUDIO</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {([
          ['overview','Dashboard',Gauge],['system-2d','2D system overview',GitBranch],['batteries','Batteries & BMS',BatteryFull],['connectivity','Connectivity',Cable],['loads','Circuits & loads',Layers],['topology','Logical topology',Network],['autonomy','Off-grid autonomy',CloudSun],['equipment','Equipment library',Cpu],['settings','Project settings',Settings]
        ] as const).map(([id,label,Icon])=><button key={id} className={`nav-item ${page===id?'active':''}`} onClick={()=>navigate(id)}><Icon size={18}/>{label}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="supply-pill"><span className="status-dot"/> ENGINE ONLINE <span>v0.3</span></div><p>12V / 24V ready<br/>Iteration 03 · Batteries & 2D</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">PROJECTS <span>/</span> VANDY <span>/</span> <b>{page==='overview'?'DASHBOARD':page==='system-2d'?'2D OVERVIEW':page==='batteries'?'BATTERIES & BMS':page==='connectivity'?'CONNECTIVITY':page==='loads'?'CIRCUITS & LOADS':page==='topology'?'TOPOLOGY':page==='autonomy'?'CHARGING & AUTONOMY':page==='equipment'?'EQUIPMENT':'SETTINGS'}</b></div><div className="top-actions"><Tag tone={persisted?'good':'warn'}><Save size={12}/>{persisted?' Saved locally':' Storage unavailable'}</Tag><Tag tone="accent">ITERATION 03</Tag></div></header>
      <div className="content">
        {page==='overview' && <>
          <div className="hero"><div className="eyebrow"><span className="eyebrow-line"/> ENERGY PLANNING / VANDY V1</div><div className="hero-row"><div><h1>Know your power.<br/><em>Before you need it.</em></h1><p>Understand consumption, identify missing measurements and organise every appliance into its electrical circuit.</p></div><div className="voltage-card"><span>SYSTEM VOLTAGE</span><strong>{project.nominalBatteryVoltage}<small>V</small></strong><p>Habitation battery</p></div></div></div>
          <div className="section-heading"><div><h2>Daily energy snapshot</h2><p>Projected consumption under your selected usage profile.</p></div><Field label="USAGE PROFILE"><select value={activeProfileId} onChange={e=>setProfileId(e.target.value)}>{project.profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div>
          <div className="metric-grid">
            <div className="metric"><div className="metric-top"><span>BATTERY DEMAND</span><BatteryCharging size={19}/></div><strong>{fmt(totals.batteryWh)} <small>Wh/day</small></strong><p>Partial estimate at battery terminals</p></div>
            <div className="metric"><div className="metric-top"><span>EQUIVALENT CHARGE</span><Activity size={19}/></div><strong>{fmt(totals.equivalentAh,1)} <small>Ah/day</small></strong><p>At {project.nominalBatteryVoltage}V nominal</p></div>
            <div className="metric"><div className="metric-top"><span>CONNECTED MAXIMUM</span><Gauge size={19}/></div><strong>{fmt(totals.worstCaseConnectedWatts)} <small>W</small></strong><p>Sum of known load maxima only</p></div>
            <div className="metric incomplete"><div className="metric-top"><span>INCOMPLETE LOADS</span><AlertTriangle size={19}/></div><strong>{totals.incompleteLoads.length} <small>/ {project.loads.length}</small></strong><p>Need ratings or conversion details</p></div>
          </div>
          <div className="notice"><AlertTriangle size={20}/><div><strong>Planning estimates — not an electrical safety certificate</strong><p>Totals are partial while any active load has unknown electrical demand. Power figures do not establish safe conductor sizes, overcurrent protection, electrical compliance or actual battery autonomy.</p></div></div>
          <div className="section-heading table-title"><div><h2>Circuits at a glance</h2><p>{project.circuits.length} named circuits · {project.loads.length} individual consumers</p></div><button className="button primary" onClick={()=>setPage('loads')}><Layers size={16}/> Manage circuits</button></div>
          <div className="table-wrap"><table><thead><tr><th>Electrical circuit</th><th>Supply</th><th>Consumers</th><th>Battery Wh/day</th><th>Status</th></tr></thead><tbody>{totals.circuitResults.map(c=>{const source=project.circuits.find(x=>x.id===c.circuitId)!;return <tr key={c.circuitId} onClick={()=>{setSelectedCircuit(c.circuitId);setSelectedLoad(null);setPage('loads')}} className="clickable"><td><strong>{c.name}</strong></td><td>{supplyLabels[source.supply]} · {source.voltage}V</td><td>{c.loads.length}</td><td className="num">{fmt(c.batteryWh,1)}</td><td>{c.incomplete?<Tag tone="warn">Needs data</Tag>:<Tag tone="good">Calculated</Tag>}</td></tr>})}</tbody></table></div>
          <p className="footer-note">Battery capacity: {project.batteryCapacityAh===null?'not provided':`${fmt(project.batteryCapacityAh)} Ah nominal`} · Inverter efficiency: {fmt(project.inverterEfficiency*100)}% assumed · This snapshot does not predict usable battery runtime.</p>
        </>}
        {page==='loads' && <>
          <div className="section-heading heading-top"><div><div className="eyebrow">BUILD YOUR ELECTRICAL INVENTORY</div><h1>Circuits & loads</h1><p>Define the groups that will become your future electrical schematic.</p></div><button className="button primary" onClick={addCircuit}><Plus size={16}/> New circuit</button></div>
          <div className="editor-grid"><div className="left-pane"><div className="panel-header">CIRCUITS <span>{project.circuits.length}</span></div><div className="circuit-list">{project.circuits.map(c=><button key={c.id} className={`circuit-item ${c.id===selectedCircuit?'chosen':''}`} onClick={()=>{setSelectedCircuit(c.id);setSelectedLoad(null)}}><span className="circuit-symbol"><Cable size={17}/></span><span className="circuit-copy"><strong>{c.name}</strong><small>{project.loads.filter(l=>l.circuitId===c.id).length} consumers · {c.voltage}V</small></span><ChevronDown size={16} className="circuit-chevron"/></button>)}</div></div>
          <div className="right-pane">{circuit ? <>
            <section className="panel circuit-editor"><div className="panel-head"><div><div className="overline">SELECTED CIRCUIT</div><h2>{circuit.name}</h2></div><button className="icon-button danger" title="Delete empty circuit" onClick={()=>removeCircuit(circuit.id)}><Trash2 size={17}/></button></div>
              <div className="form-grid"><Field label="Circuit name"><input value={circuit.name} onChange={e=>patchCircuit(circuit.id,{name:e.target.value})}/></Field><Field label="Supply type"><select value={circuit.supply} onChange={e=>{const supply=e.target.value as Supply;patchCircuit(circuit.id,{supply,voltage:supply==='dc'?project.nominalBatteryVoltage:230,sourceComponentId:suggestedCircuitSource(project,supply),sourceOutputId:undefined});}}>{Object.entries(supplyLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field><Field label="Circuit voltage"><select value={circuit.voltage} onChange={e=>patchCircuit(circuit.id,{voltage:Number(e.target.value) as 12|24|230})}>{circuit.supply==='dc'?<><option value={12}>12V</option><option value={24}>24V</option></>:<option value={230}>230V AC</option>}</select></Field>
              <Field label="Distribution attachment (not verified)"><select value={circuit.sourceComponentId??''} onChange={e=>patchCircuit(circuit.id,{sourceComponentId:e.target.value||undefined,sourceOutputId:undefined})}><option value="">Unassigned / infer from topology</option>{project.components.filter(c=>circuit.supply==='dc'?!!c.outputs?.length:!!c.ports?.some(p=>p.system==='ac'&&p.direction==='output')).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              {circuit.sourceComponentId && <Field label="Output channel"><select value={circuit.sourceOutputId??''} onChange={e=>patchCircuit(circuit.id,{sourceOutputId:e.target.value||undefined})}><option value="">Unassigned</option>{project.components.find(c=>c.id===circuit.sourceComponentId)?.outputs?.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>}
              </div><Field label="Notes"><textarea rows={2} value={circuit.notes??''} onChange={e=>patchCircuit(circuit.id,{notes:e.target.value})}/></Field>
              <div className="subtle-hint"><ShieldAlert size={16}/> Output assignments are labels for future diagrams; they do not validate fuses, switching or wiring.</div>
            </section>
            <section className="panel"><div className="panel-head"><div><div className="overline">CONNECTED CONSUMERS</div><h2>{circuit.name} loads</h2></div><button className="button small" onClick={addLoad}><Plus size={16}/> Add consumer</button></div><div className="load-list">{project.loads.filter(l=>l.circuitId===circuit.id).length===0&&<Empty>No consumers assigned to this circuit yet.</Empty>}{project.loads.filter(l=>l.circuitId===circuit.id).map(l=><button key={l.id} onClick={()=>setSelectedLoad(l.id)} className={`load-row ${selectedLoad===l.id?'active':''}`}><span><strong>{l.name}</strong><small>{l.kind.replace('-',' ')} · {l.modes.length} operating mode{l.modes.length!==1?'s':''}</small></span><span>{l.modes.some(m=>m.watts===null) && l.kind!=='led-strip'?<Tag tone="warn">Unrated</Tag>:<Tag tone="accent">Defined</Tag>}</span></button>)}</div></section>
            {load && <section className="panel load-editor" key={load.id}><div className="panel-head"><div><div className="overline">CONSUMER DETAILS</div><h2>{load.name}</h2></div><button className="icon-button danger" title="Delete consumer" onClick={()=>removeLoad(load.id)}><Trash2 size={17}/></button></div><div className="form-grid"><Field label="Consumer name"><input value={load.name} onChange={e=>patchLoad(load.id,{name:e.target.value})}/></Field><Field label="Load type"><select value={load.kind} onChange={e=>patchLoad(load.id,{kind:e.target.value as LoadKind,led:e.target.value==='led-strip'?(load.led??{lengthMetres:null,wattsPerMetre:null,brightnessFraction:1,evidence:'unknown'}):undefined})}><option value="standard">Standard</option><option value="compressor">Compressor / duty cycle</option><option value="led-strip">LED strip</option><option value="multi-state">Multi-state (heaters etc.)</option></select></Field><Field label="Assigned circuit"><select value={load.circuitId} onChange={e=>{patchLoad(load.id,{circuitId:e.target.value});setSelectedCircuit(e.target.value)}}>{project.circuits.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Linked equipment"><select value={load.componentId??''} onChange={e=>patchLoad(load.id,{componentId:e.target.value||undefined})}><option value="">Not linked</option>{project.components.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
            {(()=>{
              const connectedCircuit=project.circuits.find(c=>c.id===load.circuitId);
              const source=resolveLogicalSupply(project,load);
              return <div className="derived-supply">
                <div className="overline">CONSUMER SUPPLY & TOPOLOGY</div>
                <div className="form-grid"><Field label="Electrical input"><select value={connectedCircuit?`${connectedCircuit.supply}:${connectedCircuit.voltage}`:'dc:12'}
                  onChange={e=>{const [kind,voltage]=e.target.value.split(':');moveConsumerToSupply(load.id,kind as Supply,Number(voltage) as 12|24|230)}}>
                  <option value="dc:12">12V DC</option><option value="dc:24">24V DC</option><option value="ac-inverter:230">230V — inverter-backed AC output</option><option value="ac-shore:230">230V — shore-only</option>
                </select></Field></div>
                <p><strong>Upstream logical source: </strong>{source.origin==='dc'?'DC bus (not yet traced)':
                  source.origin==='unresolved'?'Not resolved — configure a supply path':
                  source.path.map(id=>project.components.find(c=>c.id===id)?.name??id).join(' → ')}</p>
                {source.origin==='inverter'&&<p className="supply-explainer">MultiPlus AC OUT supplies this circuit. Battery/inverter or shore pass-through depends on the selected 230V scenario.</p>}
                {source.issues.map((issue,i)=><p className="supply-issue" key={i}><AlertTriangle size={14}/>{issue}</p>)}
                {source.origin!=='dc'&&source.origin!=='unresolved'&&<p className="supply-explainer">Logical connection confidence: {source.confidence}. This is not verified electrical wiring.</p>}
              </div>
            })()}
            {load.kind==='led-strip'&&<div className="led-panel"><div className="overline">LED STRIP PARAMETERS</div><div className="form-grid three"><Field label="Length (metres)"><input type="number" min="0" step="0.1" placeholder="Measure length" value={inputNumeric(load.led?.lengthMetres)} onChange={e=>patchLoad(load.id,{led:{...load.led!,lengthMetres:toNullable(e.target.value)}})}/></Field><Field label="Wattage per metre"><input type="number" min="0" step="0.1" value={inputNumeric(load.led?.wattsPerMetre)} onChange={e=>patchLoad(load.id,{led:{...load.led!,wattsPerMetre:toNullable(e.target.value)}})}/></Field><Field label="Typical brightness (%)"><input type="number" min="0" max="100" step="5" value={Math.round((load.led?.brightnessFraction??1)*100)} onChange={e=>patchLoad(load.id,{led:{...load.led!,brightnessFraction:Math.min(1,Math.max(0,Number(e.target.value)/100))}})}/></Field></div><p>Rated maximum: <strong>{ledRatedWatts(load)===null?'unknown':`${fmt(ledRatedWatts(load)!,1)} W`}</strong>. Dimming affects estimated energy, not the maximum rating used for future cable checks.</p></div>}
            <div className="modes-heading"><div><div className="overline">OPERATING MODES</div><p>Adjust run times for <strong>{profile?.name}</strong>.</p></div>{load.modes.length<8 && <button className="button small" onClick={()=>patchLoad(load.id,{modes:[...load.modes,{...createMode(project),id:makeId()}]})}><Plus size={14}/> Add mode</button>}</div>
            {load.modes.map(m=><div className="mode-box" key={m.id}><div className="mode-title"><strong>{m.name}</strong>{load.modes.length>1&&<button className="icon-button" title="Remove mode" onClick={()=>patchLoad(load.id,{modes:load.modes.filter(x=>x.id!==m.id)})}><Trash2 size={15}/></button>}</div><div className="form-grid three"><Field label="Mode name"><input value={m.name} onChange={e=>patchMode(load.id,m.id,{name:e.target.value})}/></Field>{load.kind!=='led-strip'&&<Field label="Power (watts)"><input type="number" min="0" step="0.1" placeholder="Unknown" value={inputNumeric(m.watts)} onChange={e=>patchMode(load.id,m.id,{watts:toNullable(e.target.value)})}/></Field>}<Field label="Minutes / day"><input type="number" min="0" max="1440" step="1" value={m.usage[activeProfileId]?.minutesPerDay??0} onChange={e=>patchModeUsage(load.id,m.id,'minutesPerDay',Math.min(1440,Math.max(0,Number(e.target.value))))}/></Field><Field label="Duty cycle (%)"><input type="number" min="0" max="100" step="5" value={Math.round((m.usage[activeProfileId]?.dutyFraction??1)*100)} onChange={e=>patchModeUsage(load.id,m.id,'dutyFraction',Math.min(1,Math.max(0,Number(e.target.value)/100)))}/></Field><Field label="Power evidence"><select value={m.evidence} onChange={e=>patchMode(load.id,m.id,{evidence:e.target.value as Evidence})}>{Object.entries(evidenceLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field></div></div>)}
            <Field label="Notes / assumptions"><textarea rows={2} value={load.notes??''} onChange={e=>patchLoad(load.id,{notes:e.target.value})}/></Field></section>}
          </>:<Empty>Add your first circuit to begin.</Empty>}</div></div>
        </>}
        {page==='system-2d' && <SystemOverviewPage project={project} change={patchProject} onOpenDevice={id=>{
          const c=project.components.find(c=>c.id===id);
          navigate(c?.kind==='battery'?'batteries':project.communicationPorts.some(p=>p.componentId===id)?'connectivity':'equipment');
        }}/>}
        {page==='batteries' && <BatteriesPage project={project} change={patchProject}/>}
        {page==='connectivity' && <ConnectivityPage project={project} change={patchProject}/>}
        {page==='topology' && <TopologyPage project={project} change={patchProject}/>}
        {page==='autonomy' && <AutonomyPage project={project} profileId={activeProfileId} change={patchProject}/>}
        {page==='equipment' && <><div className="section-heading heading-top"><div><div className="eyebrow">REFERENCE EQUIPMENT LIBRARY</div><h1>Known components</h1><p>Installed hardware, protection and controller placeholders — kept distinct from power consumers.</p></div><Tag>{project.components.filter(c=>c.kind!=='battery').length} ITEMS</Tag></div><div className="notice"><CircleHelp size={19}/><div><strong>Inventory only in this iteration</strong><p>Battery specifications have a dedicated workspace. Electrical and data connections are in the topology and connectivity views.</p></div></div><div className="equipment-grid">{project.components.filter(c=>c.kind!=='battery').map(c=><article className="equipment-card" key={c.id}><div className="equipment-icon"><Cpu size={20}/></div><div><div className="equipment-heading"><strong>{c.name}</strong><Tag tone={c.evidence==='manual'?'good':c.evidence==='unknown'?'warn':'neutral'}>{c.evidence??'unknown'}</Tag></div><div className="equipment-sub">{c.model?`${c.model} · `:''}{c.kind.replace('-',' ')} {c.voltage?`· ${c.voltage}V`:''}</div><p>{c.notes??'Specification recorded; physical wiring to be captured later.'}</p>{c.outputs && <span className="equipment-foot">{c.outputs.length} individually identifiable outputs</span>}{c.hazards?.length? <div className="hazards"><ShieldAlert size={13}/>{c.hazards.join(' · ').replaceAll('-',' ')}</div>:null}</div></article>)}</div></>}
        {page==='settings' && <><div className="section-heading heading-top"><div><div className="eyebrow">YOUR PROJECT</div><h1>Settings & data</h1><p>Configure the battery model and manage your local project file.</p></div></div><div className="settings-grid"><section className="panel"><div className="panel-head"><div><div className="overline">PROJECT IDENTITY</div><h2>System configuration</h2></div></div><Field label="Project name"><input value={project.name} onChange={e=>patchProject(p=>({...p,name:e.target.value}))}/></Field><div className="form-grid"><Field label="Battery voltage"><select value={project.nominalBatteryVoltage} onChange={e=>patchProject(p=>({...p,nominalBatteryVoltage:Number(e.target.value) as 12|24}))}><option value={12}>12V</option><option value={24}>24V</option></select></Field><Field label="Battery bank rated capacity (Ah)" hint="Derived from the selected battery bank, not editable here. Edit individual battery Ah and bank membership in Batteries & BMS."><input value={batteryCapacityForPlanning(project)??'Unknown (incomplete bank)'} readOnly aria-readonly="true" title="Derived from Batteries & BMS; edit there."/>{activeBankSummary(project)&&<button className="button small" onClick={()=>navigate('batteries')}>Edit battery bank</button>}</Field><Field label="Inverter efficiency (%)" hint="Used only when the MultiPlus is inverting battery power, not during shore pass-through."><input type="number" min="1" max="100" step="1" value={Math.round(project.inverterEfficiency*100)} onChange={e=>patchProject(p=>({...p,inverterEfficiency:Math.min(1,Math.max(0.01,Number(e.target.value)/100))}))}/></Field><Field label="AC operating scenario"><select value={project.acOperatingMode??'inverter'} onChange={e=>patchProject(p=>({...p,acOperatingMode:e.target.value as 'inverter'|'shore'}))}><option value="inverter">Off-grid — inverter producing AC</option><option value="shore">Shore connected — AC pass-through</option></select></Field></div><div className="subtle-hint"><AlertTriangle size={16}/> Changing the battery voltage does not automatically convert circuits or make 12V equipment compatible. Mismatches are flagged in the calculator.</div></section><section className="panel"><div className="panel-head"><div><div className="overline">LOCAL FIRST</div><h2>Import & export</h2></div></div><p>Your project is stored only in this browser. Export JSON backups before clearing your browser data or switching devices.</p><div className="settings-actions"><button className="button primary" onClick={exportProject}><Download size={17}/> Export project JSON</button><button className="button" onClick={()=>fileRef.current?.click()}><Upload size={17}/> Import project JSON</button><input className="visually-hidden" ref={fileRef} type="file" accept="application/json,.json" onChange={e=>void importProject(e.target.files?.[0])}/></div><div className="separator"/><button className="button destructive" onClick={()=>{if(confirm('Reset all locally stored project changes to the original Vandy demo?')) {setProject(structuredClone(seedProject));setProfileId('normal');setSelectedCircuit('toilet');setSelectedLoad('toilet-light');setMessage('Demo data staged. Press Update to save, or Reset to discard.');}}}><RotateCcw size={17}/> Reset demo inventory</button></section></div><div className="notice critical"><ShieldAlert size={21}/><div><strong>Safety is a requirement, not a certification claim.</strong><p>Combustion equipment needs proper ventilation, exhaust routing and appropriate carbon monoxide detection. Electrical and LPG work must follow applicable manufacturer guidance and safety regulations. This application currently checks energy arithmetic only; it does not approve an installation.</p></div></div></>}
        {page!=='overview'&&<div className="project-edit-bar" role="region" aria-label="Review changes and update">
          <div><strong>{dirty?'Changes not yet saved':'Section is up to date'}</strong>
            <small>{(saveErrors.length||editBlockers.length)?`${editBlockers.length} save-blocking ${editBlockers.length===1?'issue':'issues'} — see explanations below`:
              dirty?'Incomplete fields may be saved. Update applies this section’s current changes.':'Edit any available field, then Update to save.'}</small>
            {editBlockers.length>0&&<ul className="project-edit-errors">{editBlockers.map((problem,i)=><li key={i}>{problem}</li>)}</ul>}
          </div>
          <div className="project-edit-actions">
            <button className="button" disabled={!dirty} onClick={resetPageEdits}><RotateCcw size={16}/> Reset</button>
            <button className="button primary" disabled={!dirty||editBlockers.length>0} onClick={updatePage}><Save size={16}/> Update</button>
          </div>
        </div>}
        {message&&<div className="toast" role="status"><Check size={16}/>{message}<button aria-label="Dismiss" onClick={()=>setMessage('')}>×</button></div>}
        <footer className="app-footer"><span>VANDY POWER STUDIO / ITR-03</span><span>ENGINEERING FIRST · ASSUMPTIONS VISIBLE</span></footer>
      </div>
    </main>
  </div>;
}
