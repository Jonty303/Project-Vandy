import { useState } from 'react';
import { BatteryCharging, Plus, Trash2, ShieldAlert, Thermometer, Network, Info, AlertTriangle } from 'lucide-react';
import type { BatteryRecord, BatteryBank, Project, ThermalFeature, CapabilityEvidence, Evidence } from '../domain/model.ts';
import { activeBankSummary, newBattery, summarizeBank, validateBattery } from '../domain/batteries.ts';

type Props={project:Project;change:(fn:(p:Project)=>Project)=>void};
const choice:ThermalFeature[]=['unknown','yes','no'];
const nullable=(text:string)=>text.trim()===''?null:Number(text);
const n=(x:number|null)=>x===null?'':String(x);
const makeId=()=>crypto.randomUUID();
function NumberField({label,value,onChange,info}:{label:string;value:number|null;onChange:(n:number|null)=>void;info?:string}){
  return <label className="field"><span>{label}</span><input type="number" step="any" value={n(value)} placeholder="Unknown — save allowed"
    onChange={e=>onChange(nullable(e.target.value))}/>{info&&<small>{info}</small>}</label>;
}
function TextField({label,value,onChange,placeholder}:{label:string;value:string;onChange:(s:string)=>void;placeholder?:string}){
  return <label className="field"><span>{label}</span><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>;
}
function SelectField<T extends string>({label,value,values,onChange,info}:{label:string;value:T;values:readonly T[];onChange:(x:T)=>void;info?:string}){
  return <label className="field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value as T)}>{values.map(x=><option key={x} value={x}>{x.replaceAll('-',' ')}</option>)}</select>{info&&<small>{info}</small>}</label>;
}
export function BatteriesPage({project,change}:Props){
  const [selectedId,setSelectedId]=useState(project.batteries[0]?.id??'');
  const battery=project.batteries.find(b=>b.id===selectedId)??project.batteries[0];
  const bank=project.batteryBanks.find(b=>b.id===project.activeBatteryBankId)??project.batteryBanks[0];
  const summary=bank?summarizeBank(project,bank):null;
  const updateBattery=(fn:(b:BatteryRecord)=>BatteryRecord)=>change(p=>({...p,batteries:p.batteries.map(b=>b.id===battery.id?fn(b):b)}));
  const patch=<K extends keyof BatteryRecord>(key:K,value:BatteryRecord[K])=>updateBattery(b=>({...b,[key]:value}));
  const bms=<K extends keyof BatteryRecord['bms']>(key:K,value:BatteryRecord['bms'][K])=>updateBattery(b=>({...b,bms:{...b.bms,[key]:value}}));
  const thermal=<K extends keyof BatteryRecord['thermal']>(key:K,value:BatteryRecord['thermal'][K])=>updateBattery(b=>({...b,thermal:{...b.thermal,[key]:value}}));
  const dimension=(key:'length'|'width'|'height',value:number|null)=>updateBattery(b=>({...b,dimensionsMm:{...b.dimensionsMm,[key]:value}}));
  const bankEdit=(fn:(b:BatteryBank)=>BatteryBank)=>bank&&change(p=>({...p,batteryBanks:p.batteryBanks.map(b=>b.id===bank.id?fn(b):b)}));
  function addBattery(){
    const id=makeId();change(p=>({...p,batteries:[...p.batteries,newBattery(id)]}));setSelectedId(id);
  }
  function removeBattery(){
    if(!battery)return;
    const used=project.batteryBanks.some(b=>b.strings.flat().includes(battery.id));
    if(used)return;
    if(!confirm(`Remove ${battery.name}? This affects only a battery not used in any bank.`))return;
    change(p=>({...p,batteries:p.batteries.filter(b=>b.id!==battery.id)}));
    setSelectedId(project.batteries.find(b=>b.id!==battery.id)?.id??'');
  }
  function addBank(){
    const id=makeId();change(p=>({...p,batteryBanks:[...p.batteryBanks,{id,name:'New battery bank',strings:[],notes:''}],
      activeBatteryBankId:id}));
  }
  const issues=battery?validateBattery(battery):[];
  return <div className="batteries-page">
    <div className="section-heading heading-top"><div><div className="eyebrow">ITERATION 03 / BATTERY SYSTEMS</div><h1>Batteries & BMS</h1><p>Individual batteries, bank topology, manufacturer limits, thermal management and vendor-app BMS access.</p></div>
      <span className="topo-status">{project.batteries.length} batteries</span></div>
    <div className="notice"><Info size={19}/><div><strong>Unknown is valid information</strong><p>You can save an incomplete battery record. Missing voltage, capacity, temperatures or documentation remain highlighted; no specs or supported integration are invented. Press Update in the page action bar to save changes, or Reset to discard them.</p></div></div>
    <section className="panel"><div className="panel-head"><h2><BatteryCharging size={19}/> Battery inventory</h2><button className="button small" onClick={addBattery}><Plus size={15}/> Add battery</button></div>
      <div className="battery-list">{project.batteries.map(b=><button key={b.id} className={b.id===battery?.id?'selected':''} onClick={()=>setSelectedId(b.id)}><strong>{b.name}</strong><small>{b.nominalVoltageV??'?'}V · {b.capacityAh??'?'}Ah · {b.evidence}</small></button>)}</div>
    </section>
    {battery&&<section className="panel"><div className="panel-head"><h2>Battery specification</h2><button className="button small destructive" disabled={project.batteryBanks.some(b=>b.strings.flat().includes(battery.id))} title={project.batteryBanks.some(b=>b.strings.flat().includes(battery.id))?'This battery belongs to a bank. Remove its bank assignment first.':'Remove this unassigned battery'} onClick={removeBattery}><Trash2 size={14}/> Remove</button></div>
      {project.batteryBanks.some(b=>b.strings.flat().includes(battery.id))&&<p className="locked-reason"><Info size={14}/> Remove is unavailable because this battery belongs to a bank. Edit the bank strings below to release it.</p>}
      <div className="form-grid three">
        <TextField label="Battery name (required)" value={battery.name} onChange={v=>patch('name',v)}/>
        <TextField label="Manufacturer" value={battery.manufacturer} onChange={v=>patch('manufacturer',v)}/>
        <TextField label="Exact model / variant" value={battery.model} onChange={v=>patch('model',v)} placeholder="Unknown model allowed"/>
        <SelectField label="Chemistry" value={battery.chemistry} values={['unknown','lifepo4','agm','gel','lead-acid','other'] as const} onChange={v=>patch('chemistry',v)}/>
        <NumberField label="Nominal voltage (V)" value={battery.nominalVoltageV} onChange={v=>patch('nominalVoltageV',v)}/>
        <NumberField label="Rated capacity (Ah)" value={battery.capacityAh} onChange={v=>patch('capacityAh',v)}/>
        <NumberField label="Weight (kg)" value={battery.weightKg} onChange={v=>patch('weightKg',v)}/>
        {(['length','width','height'] as const).map(key=><NumberField key={key} label={`${key} (mm)`} value={battery.dimensionsMm[key]} onChange={v=>dimension(key,v)}/>)}
        <NumberField label="Maximum continuous charge (A)" value={battery.maxChargeA} onChange={v=>patch('maxChargeA',v)}/>
        <NumberField label="Maximum continuous discharge (A)" value={battery.maxDischargeA} onChange={v=>patch('maxDischargeA',v)}/>
        <NumberField label="Minimum charging temperature (°C)" value={battery.chargeMinC} onChange={v=>patch('chargeMinC',v)}/>
        <NumberField label="Maximum charging temperature (°C)" value={battery.chargeMaxC} onChange={v=>patch('chargeMaxC',v)}/>
        <NumberField label="Minimum discharge temperature (°C)" value={battery.dischargeMinC} onChange={v=>patch('dischargeMinC',v)}/>
        <NumberField label="Maximum discharge temperature (°C)" value={battery.dischargeMaxC} onChange={v=>patch('dischargeMaxC',v)}/>
        <SelectField label="Specification evidence" value={battery.evidence} values={['unknown','reported','manual','measured','estimated','listing'] as Evidence[]} onChange={v=>patch('evidence',v)}/>
        <TextField label="Manufacturer specification URL" value={battery.documentationUrl} onChange={v=>patch('documentationUrl',v)}/>
      </div><label className="field"><span>Notes</span><textarea rows={2} value={battery.notes} onChange={e=>patch('notes',e.target.value)}/></label>
      <div className="battery-field-alerts">{issues.map(d=><p key={d.field+d.message} className={d.level}><AlertTriangle size={14}/><strong>{d.field}:</strong> {d.message}</p>)}</div>
    </section>}
    {battery&&<section className="panel"><div className="panel-head"><h2><ShieldAlert size={18}/> Internal BMS & connectivity</h2></div>
      <div className="form-grid three">
        <SelectField label="Integrated BMS" value={battery.bms.integrated} values={choice} onChange={v=>bms('integrated',v)}/>
        <TextField label="BMS manufacturer" value={battery.bms.manufacturer} onChange={v=>bms('manufacturer',v)}/>
        <TextField label="BMS model" value={battery.bms.model} onChange={v=>bms('model',v)}/>
        <SelectField label="Bluetooth" value={battery.bms.bluetooth} values={choice} onChange={v=>bms('bluetooth',v)}/>
        <TextField label="Vendor management app" value={battery.bms.vendorApp} onChange={v=>bms('vendorApp',v)}/>
        <SelectField label="External management capability" value={battery.bms.externalManagement} values={['unverified','documented','verified','not-supported'] as CapabilityEvidence[]} onChange={v=>bms('externalManagement',v)}/>
        <TextField label="Documented external protocol" value={battery.bms.protocol} onChange={v=>bms('protocol',v)}/>
        <TextField label="BMS protocol documentation URL" value={battery.bms.documentationUrl} onChange={v=>bms('documentationUrl',v)}/>
        <SelectField label="Cell voltage reporting" value={battery.bms.cellVoltageMonitoring} values={choice} onChange={v=>bms('cellVoltageMonitoring',v)}/>
        <SelectField label="Cell balancing" value={battery.bms.balancing} values={choice} onChange={v=>bms('balancing',v)}/>
        <SelectField label="Faults / alarms" value={battery.bms.alarms} values={choice} onChange={v=>bms('alarms',v)}/>
      </div>
      <label className="field"><span>BMS protections / thresholds / notes</span><textarea rows={2} value={battery.bms.protectionNotes} onChange={e=>bms('protectionNotes',e.target.value)}/></label>
      <p className="locked-reason"><Network size={14}/> Bluetooth alone means vendor-app-only. Cerbo management recommendations require explicit protocol documentation and compatibility verification; a CAN connector by itself is insufficient.</p>
    </section>}
    {battery&&<section className="panel"><div className="panel-head"><h2><Thermometer size={18}/> Thermal management & self-heating</h2></div>
      <div className="form-grid three">
        <SelectField label="Self-heating" value={battery.thermal.selfHeating} values={choice} onChange={v=>thermal('selfHeating',v)}/>
        <SelectField label="Heater control" value={battery.thermal.control} values={['unknown','automatic','manual','bms'] as const} onChange={v=>thermal('control',v)}/>
        <NumberField label="Heater on (°C)" value={battery.thermal.onC} onChange={v=>thermal('onC',v)}/>
        <NumberField label="Heater off (°C)" value={battery.thermal.offC} onChange={v=>thermal('offC',v)}/>
        <NumberField label="Heater consumption (W)" value={battery.thermal.heaterWatts} onChange={v=>thermal('heaterWatts',v)}/>
        <SelectField label="Heat power source" value={battery.thermal.source} values={['unknown','battery','external-charger','both'] as const} onChange={v=>thermal('source',v)}/>
        <SelectField label="Low-temperature charging cut-off" value={battery.thermal.lowTemperatureChargeCutoff} values={choice} onChange={v=>thermal('lowTemperatureChargeCutoff',v)}/>
        <SelectField label="Heating status externally reported" value={battery.thermal.heatingStatusReported} values={choice} onChange={v=>thermal('heatingStatusReported',v)}/>
      </div>
      <p className="autonomy-note">Low-temperature charging protection is not the same as self-heating. Heating consumption is informational here, not automatically added to daily load estimates.</p>
    </section>}
    <section className="panel"><div className="panel-head"><h2>Battery bank configuration</h2><button className="button small" onClick={addBank}><Plus size={14}/> New bank</button></div>
      <label className="field"><span>Active bank (used for autonomy)</span><select value={project.activeBatteryBankId??''} onChange={e=>change(p=>({...p,activeBatteryBankId:e.target.value||null}))}><option value="">No active bank (legacy capacity)</option>{project.batteryBanks.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      {bank&&<><TextField label="Bank name" value={bank.name} onChange={v=>bankEdit(b=>({...b,name:v}))}/>
      <p className="autonomy-note">Batteries in each row are in <strong>series</strong>; separate rows are in <strong>parallel</strong>. This models nominal energy only, not safe mixing or fuse/cable arrangements.</p>
      <div className="bank-strings">{bank.strings.map((string,index)=><div className="bank-string" key={index}>
        <div><strong>Parallel string {index+1}</strong><button className="icon-button" aria-label="Remove series string" onClick={()=>bankEdit(b=>({...b,strings:b.strings.filter((_,i)=>i!==index)}))}><Trash2 size={15}/></button></div>
        <div className="bank-series">{string.map((id,position)=><label key={position}>Series {position+1}<select value={id} onChange={e=>bankEdit(b=>({...b,strings:b.strings.map((row,i)=>i===index?row.map((x,j)=>j===position?e.target.value:x):row)}))}>
          <option value="">Unassigned (blocks bank validation)</option>{project.batteries.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label>)}
          <button className="button small" onClick={()=>bankEdit(b=>({...b,strings:b.strings.map((row,i)=>i===index?[...row,'']:row)}))}><Plus size={13}/> Series battery</button></div>
      </div>)}
      <button className="button small" onClick={()=>bankEdit(b=>({...b,strings:[...b.strings,['']]}))}><Plus size={14}/> Parallel string</button></div>
      {summary&&<><div className="bank-totals"><div><small>Nominal voltage</small><strong>{summary.nominalVoltageV??'Unknown'} V</strong></div><div><small>Capacity</small><strong>{summary.capacityAh??'Unknown'} Ah</strong></div><div><small>Stored nominal energy</small><strong>{summary.nominalWh??'Unknown'} Wh</strong></div></div>
        {summary.nominalVoltageV!==null&&summary.nominalVoltageV!==project.nominalBatteryVoltage&&<p className="field-warning"><AlertTriangle size={15}/> This bank voltage differs from the configured {project.nominalBatteryVoltage}V system. Autonomy calculations will require correction before rating.</p>}
        {summary.diagnostics.map((d,i)=><p key={i} className={`field-${d.level}`}><AlertTriangle size={14}/>{d.message}</p>)}</>}
      <label className="field"><span>Bank assembly notes</span><textarea rows={2} value={bank.notes} onChange={e=>bankEdit(b=>({...b,notes:e.target.value}))}/></label>
      </>}
    </section>
  </div>;
}
