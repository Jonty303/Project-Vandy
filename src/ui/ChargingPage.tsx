import {useState} from 'react';
import {Plus,Trash2,AlertTriangle,ExternalLink} from 'lucide-react';
import {
  deviceCatalogue,findModel,chargingWarnings,panelArray,plannedInverter,
  type ChargingPlan,type PlannedUnit,type SystemVoltage,type DeviceKind,
} from '../domain/charging.ts';

type Props={
  plan:ChargingPlan;
  batteryVoltage:SystemVoltage|null;
  onChange:(next:ChargingPlan)=>void;
};
type Tab='dc2dc'|'solar'|'shore';
const fmt=(n:number|null)=>n===null?'Not entered':n.toLocaleString('en-GB',{maximumFractionDigits:2});
const numberValue=(v:string)=>v.trim()===''?null:Number(v);
const source=(url:string)=><a href={url} rel="noreferrer" target="_blank">Manufacturer specification <ExternalLink size={12}/></a>;

export function ChargingPage({plan,batteryVoltage,onChange}:Props){
  const [tab,setTab]=useState<Tab>('dc2dc');
  const [dcChoice,setDcChoice]=useState('');
  const [mpptChoice,setMpptChoice]=useState('');
  const warnings=chargingWarnings(plan,batteryVoltage);
  const array=panelArray(plan.panel);
  const models=(kind:DeviceKind)=>deviceCatalogue.filter(m=>m.kind===kind);
  const dc=plan.dc2dc.map(u=>({unit:u,model:findModel(u.modelId)}));
  const mppt=plan.mppt.map(u=>({unit:u,model:findModel(u.modelId)}));
  const shore=plan.shoreModelId?findModel(plan.shoreModelId):null;
  const inverter=plannedInverter(plan);
  const assign=(change:Partial<ChargingPlan>)=>onChange({...plan,...change});
  const setPanel=(change:Partial<ChargingPlan['panel']>)=>assign({panel:{...plan.panel,...change}});
  const add=(kind:'dc2dc'|'mppt',modelId:string)=>{
    if(findModel(modelId)?.kind!==kind)return;
    const unit:PlannedUnit={id:crypto.randomUUID(),modelId};
    assign({[kind]:[...plan[kind],unit]});
    if(kind==='dc2dc')setDcChoice('');else setMpptChoice('');
  };
  const remove=(kind:'dc2dc'|'mppt',id:string)=>
    assign({[kind]:plan[kind].filter(u=>u.id!==id)});
  const warnTab=(area:Tab)=>{
    const list=warnings.filter(w=>w.area===area);
    return list.length>0?<div className="charging-issue-list">
      {list.map((w,i)=><div className="validation-warning" key={i}>
        <AlertTriangle size={16}/><span>{w.message}</span>
      </div>)}
    </div>:null;
  };
  return <div className="charging-page">
    <div className="section-heading heading-top">
      <div><div className="eyebrow">PLANNED RECHARGE SOURCES</div>
        <h1>Charging</h1>
        <p>Choose charging equipment and document assumptions. Wiring, recharge yield and controller settings follow later.</p>
      </div>
    </div>
    <div className="planner-tabs" role="tablist" aria-label="Charging sources">
      <button type="button" role="tab" aria-selected={tab==='dc2dc'} className={tab==='dc2dc'?'active':''} onClick={()=>setTab('dc2dc')}>DC–DC <span>{plan.dc2dc.length}</span></button>
      <button type="button" role="tab" aria-selected={tab==='solar'} className={tab==='solar'?'active':''} onClick={()=>setTab('solar')}>Solar <span>{plan.mppt.length}</span></button>
      <button type="button" role="tab" aria-selected={tab==='shore'} className={tab==='shore'?'active':''} onClick={()=>setTab('shore')}>Shore power</button>
    </div>
    {tab==='dc2dc'&&<section className="panel planner-detail-panel">
      <h2>DC–DC charging</h2>
      <p className="planner-note">The spare alternator capacity is an estimate of what can be allocated to charging, not the alternator nameplate rating. Multiple chargers share the same source.</p>
      <div className="charging-form-grid">
        <label className="field"><span>Estimated spare alternator current (A)</span>
          <input type="number" min="0" step="any" placeholder="Unknown" value={plan.spareAlternatorAmps??''}
            onChange={e=>assign({spareAlternatorAmps:numberValue(e.target.value)})}/>
        </label>
        <label className="field"><span>Alternator voltage</span>
          <select value={plan.alternatorVoltage} onChange={e=>assign({alternatorVoltage:Number(e.target.value) as SystemVoltage})}>
            <option value={12}>12 V</option><option value={24}>24 V</option>
          </select>
        </label>
      </div>
      <div className="charging-add">
        <label className="field"><span>Add DC–DC charger model</span>
          <select value={dcChoice} onChange={e=>setDcChoice(e.target.value)}>
            <option value="">Select a charger…</option>
            {models('dc2dc').map(m=><option key={m.id} value={m.id}>{m.manufacturer} · {m.name}</option>)}
          </select>
        </label>
        <button className="button primary" disabled={!dcChoice} onClick={()=>add('dc2dc',dcChoice)}><Plus size={15}/>Add charger</button>
      </div>
      {dc.length===0?<p className="charging-empty">No DC–DC chargers added.</p>:
        <div className="charging-device-list">{dc.map(({unit,model})=>model&&<div key={unit.id} className="charging-device-row">
          <div><strong>{model.manufacturer} · {model.name}</strong>
            <small>{model.inputVoltage} V in · {model.outputVoltages[0]} V out · {model.chargeAmps} A rated output</small>
            <p>{model.details}</p>{source(model.sourceUrl)}
          </div>
          <button className="icon-button danger" aria-label={'Remove '+model.name} onClick={()=>remove('dc2dc',unit.id)}><Trash2 size={18}/></button>
        </div>)}</div>}
      {warnTab('dc2dc')}
      <p className="planner-note">The catalogue allows repeated units. Total rated outputs are not guaranteed charging current; input power, efficiencies, derating and battery acceptance require later checks.</p>
    </section>}
    {tab==='solar'&&<section className="panel planner-detail-panel">
      <h2>Generic solar panel</h2>
      <p className="planner-note">Enter specifications for identical panels. Wattage is used for nominal array size; PV voltage and current limits require Voc and Isc from the actual panel datasheet.</p>
      <div className="charging-form-grid">
        <label className="field"><span>Panel rated power (W each)</span>
          <input type="number" min="0" step="any" placeholder="e.g. 400" value={plan.panel.watts??''}
            onChange={e=>setPanel({watts:numberValue(e.target.value)})}/>
        </label>
        <label className="field"><span>Quantity</span>
          <input type="number" min="1" max="1000" step="1" value={plan.panel.quantity}
            onChange={e=>setPanel({quantity:Number(e.target.value)})}/>
        </label>
        <label className="field"><span>Panel arrangement</span>
          <select value={plan.panel.connection} onChange={e=>setPanel({connection:e.target.value as ChargingPlan['panel']['connection']})}>
            <option value="series">Series</option><option value="parallel">Parallel</option>
          </select>
        </label>
        <label className="field"><span>Panel open-circuit voltage Voc (V each)</span>
          <input type="number" min="0" step="any" placeholder="From panel datasheet" value={plan.panel.voc??''}
            onChange={e=>setPanel({voc:numberValue(e.target.value)})}/>
        </label>
        <label className="field"><span>Panel short-circuit current Isc (A each)</span>
          <input type="number" min="0" step="any" placeholder="From panel datasheet" value={plan.panel.isc??''}
            onChange={e=>setPanel({isc:numberValue(e.target.value)})}/>
        </label>
      </div>
      <div className="charging-array-summary">
        <div><span>Nominal panel array</span><strong>{fmt(array.watts)} {array.watts===null?'':'W'}</strong></div>
        <div><span>Array Voc before cold correction</span><strong>{fmt(array.voc)} {array.voc===null?'':'V'}</strong></div>
        <div><span>Array Isc</span><strong>{fmt(array.isc)} {array.isc===null?'':'A'}</strong></div>
      </div>
      <h3>MPPT controllers</h3>
      <div className="charging-add">
        <label className="field"><span>Add an MPPT model</span>
          <select value={mpptChoice} onChange={e=>setMpptChoice(e.target.value)}>
            <option value="">Select a controller…</option>
            {models('mppt').map(m=><option key={m.id} value={m.id}>{m.manufacturer} · {m.name}</option>)}
          </select>
        </label>
        <button className="button primary" disabled={!mpptChoice} onClick={()=>add('mppt',mpptChoice)}><Plus size={15}/>Add MPPT</button>
      </div>
      {mppt.length===0?<p className="charging-empty">No MPPT controllers added.</p>:
        <div className="charging-device-list">{mppt.map(({unit,model})=>model&&<div key={unit.id} className="charging-device-row">
          <div><strong>{model.manufacturer} · {model.name}</strong>
            <small>{model.outputVoltages.join('/')} V battery · {model.chargeAmps} A output · PV Voc limit {model.pvMaxVoc} V</small>
            <p>{model.details}</p>{source(model.sourceUrl)}
          </div>
          <button className="icon-button danger" aria-label={'Remove '+model.name} onClick={()=>remove('mppt',unit.id)}><Trash2 size={18}/></button>
        </div>)}</div>}
      {warnTab('solar')}
      <p className="planner-note">One panel model is supported for now. Multiple MPPTs are selectable, but individual PV strings cannot be assigned until the wiring workflow. Cold-weather Voc rise must be checked before installation.</p>
    </section>}
    {tab==='shore'&&<section className="panel planner-detail-panel">
      <h2>Shore power</h2>
      <p className="planner-note">Select a 230 V AC battery charger or a combined inverter/charger. One shore charging unit is modelled in this planning pass.</p>
      <div className="charging-form-grid">
        <label className="field"><span>Planned shore charging equipment</span>
          <select value={plan.shoreModelId??''} onChange={e=>assign({shoreModelId:e.target.value||null})}>
            <option value="">No shore charger selected</option>
            <optgroup label="Battery chargers">
              {models('shoreCharger').map(m=><option key={m.id} value={m.id}>{m.manufacturer} · {m.name}</option>)}
            </optgroup>
            <optgroup label="Combined inverter / chargers">
              {models('inverterCharger').map(m=><option key={m.id} value={m.id}>{m.manufacturer} · {m.name}</option>)}
            </optgroup>
          </select>
        </label>
      </div>
      {shore?<div className="charging-device-row">
        <div><strong>{shore.manufacturer} · {shore.name}</strong>
          <small>{shore.outputVoltages[0]} V charging · {shore.chargeAmps} A rated charger output
            {shore.inverterVA?' · '+shore.inverterVA+' VA inverter':''}</small>
          <p>{shore.details}</p>{source(shore.sourceUrl)}
        </div>
        <button className="icon-button danger" aria-label="Remove shore charger" onClick={()=>assign({shoreModelId:null})}><Trash2 size={18}/></button>
      </div>:<p className="charging-empty">No shore charger selected.</p>}
      {inverter&&<div className="charging-future-inverter">
        <strong>Inverter step pre-filled</strong>
        <p>{inverter.name} will be suggested automatically when the future 230 V inverter selection screen is added. This does not assign loads or create electrical connections now.</p>
      </div>}
      {warnTab('shore')}
    </section>}
    <p className="planner-note">Planning only: selecting a charger does not model shore availability, vehicle alternator operation, solar yield, fuses, cables, protection, or charging hours. Changes are saved using Update.</p>
  </div>;
}
