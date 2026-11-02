import {useEffect,useRef,useState,type ReactNode,type DragEvent as ReactDragEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {Home,Calculator,Zap,Plus,Trash2,Download,Upload,Save,RotateCcw} from 'lucide-react';
import {
  blankPlanner,catalogue,importPlanner,isPlanner,loadEnergy,newCircuit,newLoad,plannerTotal,moveLoadToCircuit,
  type Planner,type PlannerLoad,type PlannerCircuit,type Voltage,
} from '../domain/loadPlanner.ts';
import './loadPlanner.css';

const KEY='vandy-load-planner-v3';
const PRIOR_KEYS=['vandy-load-planner-v2','vandy-load-planner-v1'] as const;
const UNGROUPED='ungrouped';
type CalculatorTab='loads'|'circuits';
const fmt=(n:number|null):string=>n===null?'Unknown':n.toLocaleString('en-GB',{maximumFractionDigits:2});

function Field({label,children}:{label:string;children:ReactNode}){
  return <label className="field"><span>{label}</span>{children}</label>;
}
function NumberField({label,value,onChange,max}:{label:string;value:number|null;onChange:(v:number|null)=>void;max?:number}){
  return <Field label={label}><input type="number" min="0" max={max} step="any"
    value={value??''} placeholder="Unknown"
    onChange={e=>onChange(e.target.value===''?null:Number(e.target.value))}/></Field>;
}
function initial(){
  try {
    const raw=localStorage.getItem(KEY);
    if(raw){
      const p=importPlanner(JSON.parse(raw) as unknown);
      if(p)return {saved:p,p,message:''};
      return {saved:blankPlanner(),p:blankPlanner(),message:'Saved planner data is invalid. Export your older backup before replacing it.'};
    }
    for(const oldKey of PRIOR_KEYS){
      const old=localStorage.getItem(oldKey);
      if(!old)continue;
      const p=importPlanner(JSON.parse(old) as unknown);
      if(p)return {saved:blankPlanner(),p,message:
        'Earlier planner data was migrated for review. Please check the circuit switches and daily load estimates, then press Update. Your previous saved version remains untouched.'};
      return {saved:blankPlanner(),p:blankPlanner(),message:'An older planner could not be converted. Your original saved data is untouched.'};
    }
  }catch{
    return {saved:blankPlanner(),p:blankPlanner(),message:'Browser storage could not be read. Use Export JSON for backups.'};
  }
  return {saved:blankPlanner(),p:blankPlanner(),message:''};
}

export function App(){
  const [start]=useState(initial);
  const [saved,setSaved]=useState<Planner>(start.saved);
  const [p,setP]=useState<Planner>(start.p);
  const [page,setPage]=useState<'home'|'calculator'>('home');
  const [tab,setTab]=useState<CalculatorTab>('loads');
  const [selectedLoad,setSelectedLoad]=useState('');
  const [selectedCircuit,setSelectedCircuit]=useState(UNGROUPED);
  const [picker,setPicker]=useState(false);
  const [draggedLoadId,setDraggedLoadId]=useState<string|null>(null);
  const [dropTarget,setDropTarget]=useState('');
  const [message,setMessage]=useState(start.message);
  const file=useRef<HTMLInputElement>(null);
  const dirty=JSON.stringify(p)!==JSON.stringify(saved);
  const structural=isPlanner(p);
  const total=plannerTotal(p);
  const load=p.loads.find(l=>l.id===selectedLoad);
  const circuit=p.circuits.find(c=>c.id===selectedCircuit);
  const ungrouped=p.loads.filter(l=>!l.circuitId);
  const activeCircuitLoads=selectedCircuit===UNGROUPED
    ?ungrouped:p.loads.filter(l=>l.circuitId===selectedCircuit);
  const activeCircuitTotal=plannerTotal({...p,loads:activeCircuitLoads});
  const groups=[{id:UNGROUPED,name:'Ungrouped loads',loads:ungrouped},
    ...p.circuits.map(c=>({id:c.id,name:c.name||'Unnamed circuit',loads:p.loads.filter(l=>l.circuitId===c.id)}))];

  useEffect(()=>{
    const handler=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',handler);
    return ()=>window.removeEventListener('beforeunload',handler);
  },[dirty]);

  const patchLoad=(change:Partial<PlannerLoad>)=>
    setP(old=>({...old,loads:old.loads.map(l=>l.id===selectedLoad?{...l,...change}:l)}));
  const patchCircuit=(id:string,change:Partial<PlannerCircuit>)=>
    setP(old=>({...old,circuits:old.circuits.map(c=>c.id===id?{...c,...change}:c)}));
  const changeCircuitVoltage=(id:string,voltage:Voltage)=>
    setP(old=>({...old,circuits:old.circuits.map(c=>c.id===id?{...c,voltage}:c),
      loads:old.loads.map(l=>l.circuitId===id?{...l,voltage}:l)}));

  const save=()=>{
    if(!structural){setMessage('Correct invalid values or mismatched circuit voltages before updating.');return;}
    try{localStorage.setItem(KEY,JSON.stringify(p));setSaved(structuredClone(p));setMessage('Daily load planner saved.');}
    catch{setMessage('Could not save in this browser. Export JSON to keep your work.');}
  };
  const exportData=()=>{
    if(!structural){setMessage('Correct invalid values before exporting.');return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='vandy-daily-load-planner.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const addLoad=(t:typeof catalogue[number])=>{
    const l=newLoad(t); // New loads always start in the built-in Ungrouped container.
    setP(old=>({...old,loads:[...old.loads,l]}));
    setSelectedLoad(l.id);setTab('loads');setPicker(false);
  };
  const addCircuit=()=>{
    const c=newCircuit();
    setP(old=>({...old,circuits:[...old.circuits,c]}));
    setSelectedCircuit(c.id);setTab('circuits');
  };
  const deleteCircuit=(id:string)=>{
    setP(old=>({...old,circuits:old.circuits.filter(c=>c.id!==id),
      loads:old.loads.map(l=>l.circuitId===id?{...l,circuitId:''}:l)}));
    setSelectedCircuit(UNGROUPED);
  };
  const editLoad=(id:string)=>{setSelectedLoad(id);setTab('loads');};
  const editCircuit=(id:string)=>{setSelectedCircuit(id);setTab('circuits');};
  const selectOnKey=(e:ReactKeyboardEvent<HTMLTableRowElement>,select:()=>void)=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}
  };
  const startLoadDrag=(e:ReactDragEvent<HTMLTableRowElement>,id:string)=>{
    setDraggedLoadId(id);setDropTarget('');
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain',id);
  };
  const overCircuitGroup=(e:ReactDragEvent<HTMLTableSectionElement>,groupId:string)=>{
    if(!draggedLoadId)return;
    e.preventDefault();
    e.dataTransfer.dropEffect='move';
    setDropTarget(current=>current===groupId?current:groupId);
  };
  const dropLoadInGroup=(e:ReactDragEvent<HTMLTableSectionElement>,groupId:string)=>{
    e.preventDefault();
    if(draggedLoadId){
      setP(old=>moveLoadToCircuit(old,draggedLoadId,groupId===UNGROUPED?'':groupId));
      setSelectedLoad(draggedLoadId);
    }
    setDraggedLoadId(null);setDropTarget('');
  };
  const endLoadDrag=()=>{setDraggedLoadId(null);setDropTarget('');};

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Zap/></div>
        <div><strong>VANDY</strong><small>POWER STUDIO</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <button className={'nav-item '+(page==='home'?'active':'')} onClick={()=>setPage('home')}><Home size={19}/>Home</button>
        <button className={'nav-item '+(page==='calculator'?'active':'')} onClick={()=>setPage('calculator')}><Calculator size={19}/>Load Calculator</button>
      </nav>
      <div className="sidebar-bottom">Start with a typical day.<p>Load calculation · focused edition</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">VANDY / <b>{page==='home'?'HOME':'LOAD CALCULATOR'}</b></div>
        <span className="tag">{dirty?'Unsaved changes':'Local project'}</span></header>
      <div className="content">
        {page==='home'?<>
          <section className="hero">
            <div className="eyebrow">BUILD YOUR ENERGY PICTURE</div>
            <h1>Every journey starts<br/>with <em>what you use.</em></h1>
            <p>Add appliances, group them into circuits and calculate your typical daily electricity use.</p>
            <button className="button primary" onClick={()=>setPage('calculator')}>Open Load Calculator →</button>
          </section>
          <section className="panel planner-intro"><h2>A clean starting point</h2>
            <p>Your project begins with an empty Ungrouped loads container. Add appliances with editable starting values, then create circuits when you need them.</p>
            <p>Just a typical-day estimate for now. Control assignments, battery sizing and seasonal usage can follow later.</p>
          </section>
          <section className="panel planner-intro"><div className="overline">TYPICAL DAILY LOAD-SIDE ENERGY</div>
            <strong className="planner-home-total">{fmt(total.wh)} Wh/day</strong>
            <p>{total.missing?total.missing+' load(s) need figures':p.loads.length?p.loads.length+' appliance(s) added':'No appliances added yet'}</p>
          </section>
        </>:<>
          <div className="section-heading heading-top"><div>
            <div className="eyebrow">YOUR DAILY ENERGY DEMAND</div>
            <h1>Load Calculator</h1><p>Typical power and hours used per day.</p>
          </div></div>
          <section className="panel planner-summary"><div>
            <div className="overline">LOAD-SIDE DAILY ENERGY</div>
            <strong>{fmt(total.wh)} <small>Wh/day</small></strong>
            <p>{total.missing?'Partial total · '+total.missing+' load(s) incomplete':'Estimated typical-day appliance energy'}</p>
          </div><div>{total.byVoltage.filter(v=>p.loads.some(l=>l.voltage===v.voltage)).map(v=>
            <p key={v.voltage}><b>{v.voltage} V:</b> {fmt(v.ah)} Ah/day</p>)}
            <small>Ah values are per voltage, not combined.</small>
          </div></section>
          <p className="planner-note">Appliance-side estimates only; inverter losses and battery consumption are not included.</p>

          <div className="planner-tabs" role="tablist" aria-label="Load calculator views">
            <button role="tab" aria-selected={tab==='loads'} className={tab==='loads'?'active':''}
              onClick={()=>{setTab('loads');setPicker(false);}}>Loads <span>{p.loads.length}</span></button>
            <button role="tab" aria-selected={tab==='circuits'} className={tab==='circuits'?'active':''}
              onClick={()=>{setTab('circuits');setPicker(false);}}>Circuits <span>{p.circuits.length+1}</span></button>
          </div>
          <div className="planner-toolbar">
            {tab==='loads'
              ?<button className="button primary" onClick={()=>setPicker(!picker)}><Plus size={16}/>Add load</button>
              :<button className="button primary" onClick={addCircuit}><Plus size={16}/>Add circuit</button>}
            <span/>
            <button className="button" onClick={exportData}><Download size={16}/>Export JSON</button>
            <button className="button" onClick={()=>file.current?.click()}><Upload size={16}/>Import JSON</button>
          </div>
          {tab==='loads'&&picker&&<section className="panel device-picker">
            <div className="panel-head"><h2>Add an appliance</h2><button className="button" onClick={()=>setPicker(false)}>Close</button></div>
            <p>Loads start ungrouped, with editable average power and daily usage.</p>
            <div className="device-grid">{catalogue.map(t=>
              <button className="button" key={t.name} onClick={()=>addLoad(t)}>
                {t.name}<small>{t.voltage} V · {t.watts} {t.category==='led'?'W/m':'W'} · {t.hours} h/day</small>
              </button>)}</div>
          </section>}

          <section className="panel planner-list-panel" role="tabpanel" aria-label={tab==='loads'?'Loads':'Circuits'}>
            <div className="panel-head"><h2>{tab==='loads'?'Loads':'Circuits'}</h2>
              <span>{tab==='loads'?p.loads.length+' loads':p.circuits.length+' named circuits + Ungrouped loads'}</span>
            </div>
            <div className="planner-list-scroll">
              {tab==='loads'?<table className="planner-table">
                <thead><tr><th>Load</th><th>Voltage</th><th>Avg. W</th><th>Hours/day</th><th>Wh/day</th></tr></thead>
                {groups.map(group=><tbody key={group.id}
                  onDragOver={e=>overCircuitGroup(e,group.id)}
                  onDragLeave={e=>{
                    if(!e.currentTarget.contains(e.relatedTarget as Node))setDropTarget('');
                  }}
                  onDrop={e=>dropLoadInGroup(e,group.id)}>
                  <tr className={'planner-group-row '+(dropTarget===group.id?'drop-target':'')}
                    tabIndex={0} title={'Select '+group.name+' or drop a load here'}
                    onClick={()=>editCircuit(group.id)}
                    onKeyDown={e=>selectOnKey(e,()=>editCircuit(group.id))}>
                    <th colSpan={5}>{group.name} <span>({group.loads.length})</span>
                      {draggedLoadId&&<span className="planner-drop-hint">Drop here to assign</span>}
                    </th>
                  </tr>
                  {group.loads.length?group.loads.map(l=>{
                    const r=loadEnergy(l);
                    return <tr key={l.id} draggable
                      tabIndex={0} aria-selected={selectedLoad===l.id}
                      title="Click to edit; drag this row to another circuit heading to move it"
                      className={'planner-select-row planner-draggable-row '+
                        (selectedLoad===l.id?'selected ':'')+
                        (draggedLoadId===l.id?'dragging ':'')}
                      onClick={()=>setSelectedLoad(l.id)}
                      onKeyDown={e=>selectOnKey(e,()=>setSelectedLoad(l.id))}
                      onDragStart={e=>startLoadDrag(e,l.id)}
                      onDragEnd={endLoadDrag}>
                      <td><span className="planner-row-label"><span className="load-drag-handle" aria-hidden="true">⋮⋮</span>{l.name||'Unnamed load'}</span></td>
                      <td>{l.voltage} V</td><td>{fmt(r.watts)}</td><td>{fmt(l.hours)}</td><td>{fmt(r.wh)}</td>
                    </tr>;
                  }):<tr className="planner-empty-row"><td colSpan={5}>Empty — drop loads here</td></tr>}
                </tbody>)}
              </table>:<table className="planner-table">
                <thead><tr><th>Circuit</th><th>Voltage</th><th>Loads</th><th>Switch</th><th>Wh/day</th></tr></thead>
                <tbody>
                  <tr className={'planner-select-row '+(selectedCircuit===UNGROUPED?'selected':'')}
                    tabIndex={0} aria-selected={selectedCircuit===UNGROUPED}
                    onClick={()=>setSelectedCircuit(UNGROUPED)}
                    onKeyDown={e=>selectOnKey(e,()=>setSelectedCircuit(UNGROUPED))}>
                    <td><span className="planner-row-label">Ungrouped loads <small>Default container</small></span></td>
                    <td>Mixed</td><td>{ungrouped.length}</td><td>—</td>
                    <td>{fmt(plannerTotal({...p,loads:ungrouped}).wh)}</td>
                  </tr>
                  {p.circuits.map(c=><tr key={c.id}
                    className={'planner-select-row '+(selectedCircuit===c.id?'selected':'')}
                    tabIndex={0} aria-selected={selectedCircuit===c.id}
                    onClick={()=>setSelectedCircuit(c.id)}
                    onKeyDown={e=>selectOnKey(e,()=>setSelectedCircuit(c.id))}>
                    <td><span className="planner-row-label">{c.name||'Unnamed circuit'}</span></td>
                    <td>{c.voltage} V</td><td>{p.loads.filter(l=>l.circuitId===c.id).length}</td>
                    <td>{c.physicalSwitch?'Yes':'No'}</td>
                    <td>{fmt(plannerTotal({...p,loads:p.loads.filter(l=>l.circuitId===c.id)}).wh)}</td>
                  </tr>)}
                </tbody>
              </table>}
            </div>
          </section>

          {tab==='loads'?(load?<section className="panel planner-detail-panel planner-editor" key={load.id}>
            <div className="panel-head"><h2>{load.name||'Custom load'}</h2>
              <button className="icon-button danger" aria-label="Delete load"
                onClick={()=>{setP(old=>({...old,loads:old.loads.filter(l=>l.id!==load.id)}));setSelectedLoad('');}}>
                <Trash2 size={18}/></button>
            </div>
            <div className="form-grid">
              <Field label="Load name"><input value={load.name} placeholder="Name this load" onChange={e=>patchLoad({name:e.target.value})}/></Field>
              <Field label="Category"><select value={load.category}
                onChange={e=>patchLoad({category:e.target.value as PlannerLoad['category']})}>
                <option value="standard">Standard appliance</option><option value="led">LED strip</option>
                <option value="fridge">Fridge (average input)</option><option value="diesel">Diesel heater (average input)</option>
              </select></Field>
              <Field label="Circuit"><select value={load.circuitId} onChange={e=>{
                const c=p.circuits.find(c=>c.id===e.target.value);
                patchLoad({circuitId:e.target.value,...(c?{voltage:c.voltage}:{})});
              }}>
                <option value="">Ungrouped loads</option>
                {p.circuits.map(c=><option key={c.id} value={c.id}>{c.name||'Unnamed circuit'} · {c.voltage} V</option>)}
              </select></Field>
              <Field label="Voltage"><select value={load.voltage} disabled={!!load.circuitId}
                onChange={e=>patchLoad({voltage:Number(e.target.value) as Voltage})}>
                {[12,24,230].map(v=><option key={v} value={v}>{v} V</option>)}
              </select></Field>
              <NumberField label="Quantity" value={load.quantity} max={10000}
                onChange={v=>patchLoad({quantity:v??0})}/>
              <Field label="Rating unit"><select value={load.ratingUnit}
                onChange={e=>{const unit=e.target.value as 'W'|'A';if(unit!==load.ratingUnit){
                  patchLoad({ratingUnit:unit,rating:load.rating===null?null:
                    unit==='A'?load.rating/load.voltage:load.rating*load.voltage});
                }}}>
                <option value="W">Watts (W)</option><option value="A">Amps (A)</option>
              </select></Field>
            </div>
            <div className="form-grid">
              <NumberField label={'Average input ('+load.ratingUnit+(load.category==='led'?'/m':'')+')'}
                value={load.rating} onChange={v=>patchLoad({rating:v})}/>
              <NumberField label="Typical hours / day" value={load.hours} max={24}
                onChange={v=>patchLoad({hours:v})}/>
              {load.category==='led'&&<NumberField label="Strip length (metres)" value={load.length}
                onChange={v=>patchLoad({length:v})}/>}
            </div>
            <div className="planner-result">{(()=>{const r=loadEnergy(load);return <>
              <strong>{fmt(r.wh)} Wh/day · {fmt(r.ah)} Ah/day at {load.voltage} V</strong>
              {r.issues.map(i=><p key={i}>{i}</p>)}
            </>;})()}</div>
            <details className="planner-spec-details"><summary>Technical basis & notes</summary>
              <p>{load.basis||'Enter or verify your average electrical figures.'}</p>
              {load.sourceUrl&&<p><a href={load.sourceUrl} target="_blank" rel="noreferrer">Reference specification</a></p>}
              <Field label="Your notes"><textarea rows={3} value={load.notes}
                onChange={e=>patchLoad({notes:e.target.value})} placeholder="Measured value, label or estimate..."/></Field>
            </details>
            <p className="planner-note">At 230 V, amperage is only a nominal W/230 equivalent. Power factor, peak current, wiring and battery losses are outside this calculator.</p>
          </section>:<section className="panel planner-detail-panel planner-empty">
            <h2>Select a load</h2><p>Choose a row in the table to edit its average power and daily usage.</p>
          </section>)
          :<section className="panel planner-detail-panel">
            <div className="panel-head"><h2>{selectedCircuit===UNGROUPED?'Ungrouped loads':circuit?.name||'Unnamed circuit'}</h2>
              {circuit&&<button className="icon-button danger" aria-label={'Delete circuit '+(circuit.name||'unnamed')}
                onClick={()=>deleteCircuit(circuit.id)}><Trash2 size={18}/></button>}
            </div>
            {selectedCircuit===UNGROUPED?<p className="planner-note">
              This default container always exists, even when empty. Loads start here until assigned to a named circuit.
              It has no fixed voltage or physical switch.
            </p>:circuit?<div className="form-grid">
              <Field label="Circuit name"><input value={circuit.name} placeholder="Name this circuit"
                onChange={e=>patchCircuit(circuit.id,{name:e.target.value})}/></Field>
              <Field label="Circuit voltage"><select value={circuit.voltage}
                onChange={e=>changeCircuitVoltage(circuit.id,Number(e.target.value) as Voltage)}>
                {[12,24,230].map(v=><option key={v} value={v}>{v} V</option>)}
              </select></Field>
              <label className="circuit-check"><input type="checkbox" checked={circuit.physicalSwitch}
                onChange={e=>patchCircuit(circuit.id,{physicalSwitch:e.target.checked})}/>
                Physical on/off switch</label>
            </div>:<p className="planner-note">Select a circuit to edit.</p>}
            {(selectedCircuit===UNGROUPED||circuit)&&<>
              <div className="planner-circuit-summary">
                <div><span>Loads</span><strong>{activeCircuitLoads.length}</strong></div>
                <div><span>Daily energy</span><strong>{fmt(activeCircuitTotal.wh)} <small>Wh/day</small></strong></div>
              </div>
              {activeCircuitTotal.missing>0&&<p className="planner-note">{activeCircuitTotal.missing} incomplete load(s) — total is partial.</p>}
              <div className="planner-associated-loads">
                <h3>Assigned loads</h3>
                {activeCircuitLoads.length?activeCircuitLoads.map(l=><div className="associated-load-row" key={l.id}>
                  <span>{l.name||'Unnamed load'} <small>{l.voltage} V · {fmt(loadEnergy(l).wh)} Wh/day</small></span>
                  <button className="button small" onClick={()=>editLoad(l.id)}>Edit load</button>
                </div>):<p className="planner-note">Empty — no loads assigned.</p>}
              </div>
              {circuit&&<p className="planner-note">Deleting a circuit moves its loads to Ungrouped loads; the loads are not deleted.</p>}
            </>}
          </section>}
        </>}
        <input ref={file} type="file" className="visually-hidden" accept=".json,application/json"
          onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;
            try{
              const data:unknown=JSON.parse(await f.text());
              const imported=importPlanner(data);
              if(!imported)throw Error('Invalid load-planner JSON. Full-system exports use a different format.');
              if(dirty&&!confirm('Replace unsaved edits with the imported planner?'))return;
              setP(imported);setSelectedLoad('');setSelectedCircuit(UNGROUPED);setPicker(false);
              setMessage('Imported for review. Press Update to save this planner.');
            }catch(error){setMessage(error instanceof Error?error.message:'Import failed.');}
          }}/>
        <div className="project-edit-bar">
          <div><strong>{dirty?'Changes not saved':'Load planner up to date'}</strong>
            <small>{structural?'All defaults are editable; check estimates against your equipment.':
              'Correct invalid figures or mismatched circuit voltages.'}</small></div>
          <div className="project-edit-actions">
            <button className="button" disabled={!dirty} onClick={()=>{
              setP(structuredClone(saved));setSelectedLoad('');setSelectedCircuit(UNGROUPED);setPicker(false);
              setMessage('Unsaved changes reset.');
            }}><RotateCcw size={16}/>Reset</button>
            <button className="button primary" disabled={!dirty||!structural} onClick={save}>
              <Save size={16}/>Update</button>
          </div>
        </div>
        {message&&<div role="status" className="planner-message">{message}
          <button className="button small" onClick={()=>setMessage('')}>Dismiss</button></div>}
        <footer className="app-footer">VANDY · DAILY LOAD PLANNING · ESTIMATES FOR YOUR ENTERED USAGE</footer>
      </div>
    </main>
  </div>;
}
