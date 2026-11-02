import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Home,Calculator,Zap,Plus,Trash2,Download,Upload,Save,RotateCcw} from 'lucide-react';
import {
  blankPlanner,catalogue,importPlanner,isPlanner,loadEnergy,newCircuit,newLoad,plannerTotal,
  effectivePhysicalSwitch,type Planner,type PlannerLoad,type PlannerCircuit,type Voltage,
} from '../domain/loadPlanner.ts';
import './loadPlanner.css';

const KEY='vandy-load-planner-v2';
const OLD_KEY='vandy-load-planner-v1';
const fmt=(n:number|null):string=>n===null?'Unknown':n.toLocaleString('en-GB',{maximumFractionDigits:2});
function Field({label,children}:{label:string;children:ReactNode}){
  return <label className="field"><span>{label}</span>{children}</label>;
}
function NumberField({label,value,onChange,max}:{label:string;value:number|null;onChange:(v:number|null)=>void;max?:number}){
  return <Field label={label}><input type="number" min="0" max={max} step="any" value={value??''}
    placeholder="Unknown" onChange={e=>onChange(e.target.value===''?null:Number(e.target.value))}/></Field>;
}
function initial(){
  try {
    const raw=localStorage.getItem(KEY);
    if(raw){
      const p=importPlanner(JSON.parse(raw) as unknown);
      if(!p)return {saved:blankPlanner(),p:blankPlanner(),message:'Saved data was invalid. Export any backup before replacing it.'};
      return {saved:p,p,message:''};
    }
    const legacy=localStorage.getItem(OLD_KEY);
    if(legacy){
      const p=importPlanner(JSON.parse(legacy) as unknown);
      if(p)return {saved:blankPlanner(),p,message:'Previous seasonal project migrated from the Summer profile into a typical day. Review and press Update to save this version; the original remains untouched.'};
      return {saved:blankPlanner(),p:blankPlanner(),message:'Older saved data could not be converted. Your original local storage is untouched.'};
    }
  }catch {return {saved:blankPlanner(),p:blankPlanner(),message:'Browser storage could not be read. Use JSON export as a backup.'};}
  return {saved:blankPlanner(),p:blankPlanner(),message:''};
}
export function App(){
  const [start]=useState(initial);
  const [saved,setSaved]=useState<Planner>(start.saved);
  const [p,setP]=useState<Planner>(start.p);
  const [page,setPage]=useState<'home'|'loads'>('home');
  const [selected,setSelected]=useState('');
  const [picker,setPicker]=useState(false);
  const [message,setMessage]=useState(start.message);
  const file=useRef<HTMLInputElement>(null);
  const dirty=JSON.stringify(p)!==JSON.stringify(saved);
  const structural=isPlanner(p);
  const total=plannerTotal(p);
  const load=p.loads.find(l=>l.id===selected);
  useEffect(()=>{
    const handler=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',handler);
    return ()=>window.removeEventListener('beforeunload',handler);
  },[dirty]);
  const patch=(change:Partial<PlannerLoad>)=>
    setP(old=>({...old,loads:old.loads.map(l=>l.id===selected?{...l,...change}:l)}));
  const patchCircuit=(id:string,change:Partial<PlannerCircuit>)=>
    setP(old=>({...old,circuits:old.circuits.map(c=>c.id===id?{...c,...change}:c)}));
  const changeCircuitVoltage=(id:string,voltage:Voltage)=>
    setP(old=>({...old,circuits:old.circuits.map(c=>c.id===id?{...c,voltage}:c),
      loads:old.loads.map(l=>l.circuitId===id?{...l,voltage}:l)}));
  const save=()=>{
    if(!structural){setMessage('Correct invalid values or mismatched circuit voltages before updating.');return;}
    try {localStorage.setItem(KEY,JSON.stringify(p));setSaved(structuredClone(p));setMessage('Daily load planner saved.');}
    catch{setMessage('Could not save in this browser. Export JSON to keep your work.');}
  };
  const exportData=()=>{
    if(!structural){setMessage('Correct invalid values before exporting.');return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='vandy-daily-load-planner.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const addLoad=(t:typeof catalogue[number])=>{
    const l=newLoad(t);
    setP(old=>({...old,loads:[...old.loads,l]}));setSelected(l.id);setPicker(false);
  };
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Zap/></div><div><strong>VANDY</strong><small>POWER STUDIO</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <button className={'nav-item '+(page==='home'?'active':'')} onClick={()=>setPage('home')}><Home size={19}/>Home</button>
        <button className={'nav-item '+(page==='loads'?'active':'')} onClick={()=>setPage('loads')}><Calculator size={19}/>Load Calculator</button>
      </nav>
      <div className="sidebar-bottom">Start with a typical day.<p>Load calculation · focused edition</p></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="breadcrumb">VANDY / <b>{page==='home'?'HOME':'LOAD CALCULATOR'}</b></div>
        <span className="tag">{dirty?'Unsaved changes':'Local project'}</span>
      </header>
      <div className="content">
        {page==='home'?<>
          <section className="hero">
            <div className="eyebrow">BUILD YOUR ENERGY PICTURE</div>
            <h1>Every journey starts<br/>with <em>what you use.</em></h1>
            <p>Add appliances, group them into circuits and calculate your typical daily electricity use.</p>
            <button className="button primary" onClick={()=>setPage('loads')}>Open Load Calculator →</button>
          </section>
          <section className="panel planner-intro">
            <h2>A clean starting point</h2>
            <p>Your project list begins empty. Add reference appliances with editable starting values or create a custom load.</p>
            <p>Simple averages first. Battery sizing and seasonal usage can follow later.</p>
          </section>
          <section className="panel planner-intro">
            <div className="overline">TYPICAL DAILY LOAD-SIDE ENERGY</div>
            <strong className="planner-home-total">{fmt(total.wh)} Wh/day</strong>
            <p>{total.missing?total.missing+' load(s) need figures':p.loads.length?p.loads.length+' appliance(s) added':'No appliances added yet'}</p>
          </section>
        </>:<>
          <div className="section-heading heading-top">
            <div><div className="eyebrow">YOUR DAILY ENERGY DEMAND</div><h1>Load Calculator</h1>
              <p>Typical power and hours used per day.</p></div>
          </div>
          <section className="panel planner-summary">
            <div><div className="overline">LOAD-SIDE DAILY ENERGY</div>
              <strong>{fmt(total.wh)} <small>Wh/day</small></strong>
              <p>{total.missing?'Partial total · '+total.missing+' load(s) incomplete':'Estimated typical-day appliance energy'}</p>
            </div>
            <div>{total.byVoltage.filter(v=>p.loads.some(l=>l.voltage===v.voltage)).map(v=>
              <p key={v.voltage}><b>{v.voltage} V:</b> {fmt(v.ah)} Ah/day</p>)}
              <small>Ah values are per voltage, not combined.</small>
            </div>
          </section>
          <p className="planner-note">These are appliance-side estimates, not battery consumption. Inverter losses and electrical protection are not modelled yet.</p>
          <div className="planner-toolbar">
            <button className="button primary" onClick={()=>setPicker(!picker)}><Plus size={16}/>Add load</button>
            <button className="button" onClick={()=>setP(old=>({...old,circuits:[...old.circuits,newCircuit()]}))}><Plus size={16}/>Add circuit</button>
            <span/>
            <button className="button" onClick={exportData}><Download size={16}/>Export JSON</button>
            <button className="button" onClick={()=>file.current?.click()}><Upload size={16}/>Import JSON</button>
          </div>
          {picker&&<section className="panel device-picker">
            <div className="panel-head"><h2>Add an appliance</h2><button className="button" onClick={()=>setPicker(false)}>Close</button></div>
            <p>Devices start with editable usage and power estimates. Manufacturer figures are identified in the details.</p>
            <div className="device-grid">{catalogue.map(t=>
              <button className="button" key={t.name} onClick={()=>addLoad(t)}>
                {t.name}<small>{t.voltage} V · {t.watts} {t.category==='led'?'W/m':'W'} · {t.hours} h/day</small>
              </button>)}
            </div>
          </section>}
          <div className="planner-layout">
            <section className="panel">
              <div className="panel-head"><h2>Circuits & loads</h2><span>{p.loads.length} loads</span></div>
              {!p.loads.length&&!p.circuits.length&&<div className="planner-empty"><Calculator size={32}/>
                <h3>What do you use?</h3><p>Add an appliance or create a circuit to begin.</p></div>}
              {p.circuits.map(c=><div key={c.id} className="planner-circuit">
                <div className="circuit-controls">
                  <Field label="Circuit name"><input placeholder="Name this circuit" value={c.name}
                    onChange={e=>patchCircuit(c.id,{name:e.target.value})}/></Field>
                  <Field label="Voltage"><select value={c.voltage} onChange={e=>changeCircuitVoltage(c.id,Number(e.target.value) as Voltage)}>
                    {[12,24,230].map(v=><option key={v} value={v}>{v} V</option>)}
                  </select></Field>
                  <button className="icon-button danger" aria-label={'Delete circuit '+(c.name||'unnamed')}
                    onClick={()=>setP(old=>({...old,circuits:old.circuits.filter(x=>x.id!==c.id),
                      loads:old.loads.map(l=>l.circuitId===c.id?{...l,circuitId:''}:l)}))}><Trash2 size={16}/></button>
                </div>
                <div className="circuit-switch-settings">
                  <label className="circuit-check"><input type="checkbox" checked={c.physicalSwitch}
                    disabled={c.control==='remote6'}
                    onChange={e=>patchCircuit(c.id,{physicalSwitch:e.target.checked})}/>
                    Physical on/off switch</label>
                  <Field label="Controlled by"><select value={c.control} onChange={e=>patchCircuit(c.id,{control:e.target.value as PlannerCircuit['control']})}>
                    <option value="direct">Direct circuit</option><option value="remote6">6-gang remote</option>
                  </select></Field>
                </div>
                {c.control==='remote6'&&<p className="planner-note">Physical switch ignored while controlled by the 6-gang remote.</p>}
                {effectivePhysicalSwitch(c)&&<p className="planner-note">Physical switch included in future circuit output (not an electrical load).</p>}
                <p className="planner-note">{fmt(plannerTotal({...p,loads:p.loads.filter(l=>l.circuitId===c.id)}).wh)} Wh/day</p>
                {p.loads.filter(l=>l.circuitId===c.id).map(l=>{
                  const r=loadEnergy(l);
                  return <button key={l.id} className={'planner-load '+(selected===l.id?'selected':'')}
                    onClick={()=>setSelected(l.id)}><span><b>{l.name||'Unnamed load'}</b>
                      <small>{l.voltage} V · {fmt(r.watts)} W · {fmt(r.amps)} A</small></span>
                      <span>{fmt(r.wh)}<small>Wh/day</small></span></button>;
                })}
                {!p.loads.some(l=>l.circuitId===c.id)&&<p className="planner-note">Empty circuit. Choose it in a load's details to assign that appliance.</p>}
              </div>)}
              {p.loads.some(l=>!l.circuitId)&&<div className="planner-circuit"><h3>Ungrouped loads</h3>
                {p.loads.filter(l=>!l.circuitId).map(l=>{
                  const r=loadEnergy(l);
                  return <button key={l.id} className={'planner-load '+(selected===l.id?'selected':'')}
                    onClick={()=>setSelected(l.id)}><span><b>{l.name||'Unnamed load'}</b>
                      <small>{l.voltage} V · {fmt(r.watts)} W · {fmt(r.amps)} A</small></span>
                      <span>{fmt(r.wh)}<small>Wh/day</small></span></button>;
                })}</div>}
            </section>
            {load?<section className="panel planner-editor" key={load.id}>
              <div className="panel-head"><h2>{load.name||'Custom load'}</h2>
                <button className="icon-button danger" aria-label="Delete load"
                  onClick={()=>{setP(old=>({...old,loads:old.loads.filter(l=>l.id!==load.id)}));setSelected('');}}>
                  <Trash2 size={18}/></button>
              </div>
              <div className="form-grid">
                <Field label="Load name"><input value={load.name} placeholder="Name this load" onChange={e=>patch({name:e.target.value})}/></Field>
                <Field label="Category"><select value={load.category} onChange={e=>patch({category:e.target.value as PlannerLoad['category']})}>
                  <option value="standard">Standard appliance</option><option value="led">LED strip</option>
                  <option value="fridge">Fridge (average input)</option><option value="diesel">Diesel heater (average input)</option>
                </select></Field>
                <Field label="Circuit"><select value={load.circuitId} onChange={e=>{
                  const c=p.circuits.find(c=>c.id===e.target.value);
                  patch({circuitId:e.target.value,...(c?{voltage:c.voltage}:{})});
                }}>
                  <option value="">Ungrouped</option>
                  {p.circuits.map(c=><option key={c.id} value={c.id}>{c.name||'Unnamed circuit'} · {c.voltage} V</option>)}
                </select></Field>
                <Field label="Voltage"><select value={load.voltage} disabled={!!load.circuitId}
                  onChange={e=>patch({voltage:Number(e.target.value) as Voltage})}>
                  {[12,24,230].map(v=><option key={v} value={v}>{v} V</option>)}
                </select></Field>
                <NumberField label="Quantity" value={load.quantity} max={10000}
                  onChange={v=>patch({quantity:v??0})}/>
                <Field label="Rating unit"><select value={load.ratingUnit}
                  onChange={e=>{const unit=e.target.value as 'W'|'A';
                    if(unit!==load.ratingUnit)patch({ratingUnit:unit,
                      rating:load.rating===null?null:unit==='A'?load.rating/load.voltage:load.rating*load.voltage});
                  }}>
                  <option value="W">Watts (W)</option><option value="A">Amps (A)</option>
                </select></Field>
              </div>
              <div className="form-grid">
                <NumberField label={'Average input ('+load.ratingUnit+(load.category==='led'?'/m':'')+')'}
                  value={load.rating} onChange={v=>patch({rating:v})}/>
                <NumberField label="Typical hours / day" value={load.hours} max={24} onChange={v=>patch({hours:v})}/>
                {load.category==='led'&&<NumberField label="Strip length (metres)" value={load.length}
                  onChange={v=>patch({length:v})}/>}
              </div>
              <div className="planner-result">
                {(()=>{const r=loadEnergy(load);return <>
                  <strong>{fmt(r.wh)} Wh/day · {fmt(r.ah)} Ah/day at {load.voltage} V</strong>
                  {r.issues.map(i=><p key={i}>{i}</p>)}
                </>;})()}
              </div>
              <details className="planner-spec-details"><summary>Technical basis & notes</summary>
                <p>{load.basis||'Enter or verify your own average electrical figures.'}</p>
                {load.sourceUrl&&<p><a href={load.sourceUrl} target="_blank" rel="noreferrer">Reference specification</a></p>}
                <Field label="Your notes"><textarea rows={3} value={load.notes}
                  onChange={e=>patch({notes:e.target.value})} placeholder="Measured value, label or estimate..."/></Field>
              </details>
              <p className="planner-note">W and A represent average electrical draw at the load voltage. For 230 V, amps are nominal W/230 equivalents (power factor not modelled). Peak startup currents will be handled in the future design stage.</p>
            </section>:<section className="panel planner-empty"><h2>Select an appliance</h2>
              <p>Choose a load to edit its average power and daily usage.</p></section>}
          </div>
        </>}
        <input ref={file} type="file" className="visually-hidden" accept=".json,application/json"
          onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;
            try{
              const data:unknown=JSON.parse(await f.text());
              const imported=importPlanner(data);
              if(!imported)throw Error('Invalid load-planner JSON. Full-system project exports use a different format.');
              if(dirty&&!confirm('Replace unsaved edits with the imported planner?'))return;
              setP(imported);setSelected('');
              setMessage('Imported for review. If converting legacy seasonal data, the Summer usage becomes the typical day. Press Update to save.');
            }catch(error){setMessage(error instanceof Error?error.message:'Import failed.');}
          }}/>
        <div className="project-edit-bar">
          <div><strong>{dirty?'Changes not saved':'Load planner up to date'}</strong>
            <small>{structural?'All defaults are editable; check estimates against your equipment.':'Correct invalid figures or mismatched circuit voltages.'}</small>
          </div>
          <div className="project-edit-actions">
            <button className="button" disabled={!dirty} onClick={()=>{setP(structuredClone(saved));setSelected('');setMessage('Unsaved changes reset.');}}>
              <RotateCcw size={16}/>Reset</button>
            <button className="button primary" disabled={!dirty||!structural} onClick={save}><Save size={16}/>Update</button>
          </div>
        </div>
        {message&&<div role="status" className="planner-message">{message}
          <button className="button small" onClick={()=>setMessage('')}>Dismiss</button></div>}
        <footer className="app-footer">VANDY · DAILY LOAD PLANNING · ESTIMATES FOR YOUR ENTERED USAGE</footer>
      </div>
    </main>
  </div>;
}
