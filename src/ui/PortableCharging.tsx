import { Plus, Smartphone, Tablet, Trash2, AlertTriangle, BatteryCharging, Info } from 'lucide-react';
import type { PortableCharge, Project, Evidence } from '../domain/model.ts';
import { portableChargeEnergy } from '../domain/portableCharging.ts';

type Props={project:Project;profileId:string;change:(fn:(p:Project)=>Project)=>void};
const fmt=(n:number)=>Number(n.toFixed(1)).toLocaleString('en-GB');
const numeric=(x:number|null)=>x===null?'':String(x);
const optional=(s:string)=>s.trim()===''?null:Number(s);
function newCharge(project:Project,kind:'iphone'|'ipad'|'other'):PortableCharge{
  const device=kind==='iphone'?{name:'iPhone',wh:15.5}:kind==='ipad'?{name:'iPad',wh:28.93}:{name:'USB-C device',wh:null};
  return {id:crypto.randomUUID(),name:device.name,category:kind,batteryWh:device.wh,
    batteryEvidence:'estimated',specificationUrl:'',rechargeFraction:.8,chargingEfficiency:.85,
    chargesPerDay:Object.fromEntries(project.profiles.map(p=>[p.id,1])),
    circuitId:project.circuits.find(c=>c.id==='usb-charging')?.id??project.circuits.find(c=>c.supply==='dc')?.id??project.circuits[0]?.id??'',
    notes:'Battery Wh and 85% charge efficiency are estimates until confirmed for this specific device and USB-C converter.'};
}
export function PortableChargingPage({project,profileId,change}:Props){
 const devices=project.portableCharges??[];
 const selected=project.profiles.find(p=>p.id===profileId);
 const update=(id:string,patch:Partial<PortableCharge>)=>change(p=>({...p,
   portableCharges:(p.portableCharges??[]).map(d=>d.id===id?{...d,...patch}:d)}));
 const add=(category:'iphone'|'ipad'|'other')=>change(p=>({...p,
   portableCharges:[...(p.portableCharges??[]),newCharge(p,category)]}));
 const remove=(id:string)=>change(p=>({...p,portableCharges:(p.portableCharges??[]).filter(d=>d.id!==id)}));
 const results=devices.map(d=>portableChargeEnergy(d,project,profileId));
 const total=results.reduce((a,b)=>a+b.batteryWh,0);
 const invalid=results.filter(r=>r.incomplete);
 const usbGeneric=project.loads.filter(l=>['usb-1','usb-2'].includes(l.id)&&l.modes.some(m=>Object.values(m.usage).some(x=>x.minutesPerDay>0)));
 return <div className="portable-charging-page">
   <div className="section-heading heading-top"><div><div className="eyebrow">ENERGY / PORTABLE ELECTRONICS</div>
     <h1>Phones & tablets</h1><p>Count USB-C charge events instead of guessing charging wattage × plugged-in hours. Values feed the same circuit and off-grid calculations as other loads.</p></div></div>
   <div className="notice"><Info size={20}/><div><strong>What an 80% charge means</strong>
     <p>By default, one charge means replenishing <strong>80% of the device's rated battery energy</strong>, such as 0% → 80%, not simply charging a device that happens to be at 80%. We then account for conversion and battery charging losses using an editable efficiency assumption. The current iPhone type is illustrative, not identified from your actual phones.</p>
   </div></div>
   <div className="portable-summary">
     <div><span>CHARGING DEMAND / {selected?.name??profileId}</span><strong>{fmt(total)} <small>Wh/day from habitation battery</small></strong></div>
     <div><span>CONNECTED DEVICES</span><strong>{devices.length}</strong></div>
     <div><span>INCOMPLETE</span><strong>{invalid.length}</strong></div>
   </div>
   <div className="portable-add"><span>Add a device</span>
     <button className="button small" onClick={()=>add('iphone')}><Plus size={15}/> iPhone</button>
     <button className="button small" onClick={()=>add('ipad')}><Plus size={15}/> iPad</button>
     <button className="button small" onClick={()=>add('other')}><Plus size={15}/> Other USB-C</button>
   </div>
   {devices.map((d,i)=>{
     const result=results[i];
     const on=(p:Partial<PortableCharge>)=>update(d.id,p);
     const loss=result.supplyWh-result.deviceWh;
     return <section className="panel" key={d.id}>
       <div className="panel-head"><h2>{d.category==='ipad'?<Tablet size={19}/>:<Smartphone size={19}/>} {d.name}</h2>
         <button className="button small destructive" onClick={()=>remove(d.id)} aria-label={`Remove ${d.name}`}><Trash2 size={14}/> Remove</button>
       </div>
       <div className="form-grid three">
         <label className="field"><span>Device name</span><input value={d.name} onChange={e=>on({name:e.target.value})}/></label>
         <label className="field"><span>Device type</span><select value={d.category} onChange={e=>on({category:e.target.value as PortableCharge['category']})}>
           <option value="iphone">iPhone</option><option value="ipad">iPad</option><option value="other">Other USB-C</option></select></label>
         <label className="field"><span>Device battery capacity (Wh)</span><input type="number" step=".01" min=".01" placeholder="Unknown is allowed"
           value={numeric(d.batteryWh)} onChange={e=>on({batteryWh:optional(e.target.value)})}/></label>
         <label className="field"><span>Charges per day ({selected?.name??'profile'})</span><input type="number" min="0" max="24" step=".25"
           value={d.chargesPerDay[profileId]??0} onChange={e=>on({chargesPerDay:{...d.chargesPerDay,[profileId]:Number(e.target.value)}})}/></label>
         <label className="field"><span>Battery replenished per charge (%)</span><input type="number" min="1" max="100" step="5"
           value={Math.round(d.rechargeFraction*100)} onChange={e=>on({rechargeFraction:Number(e.target.value)/100})}/></label>
         <label className="field"><span>USB-C / device charging efficiency (%)</span><input type="number" min="1" max="100" step="1"
           value={Math.round(d.chargingEfficiency*100)} onChange={e=>on({chargingEfficiency:Number(e.target.value)/100})}/></label>
         <label className="field"><span>Power source / circuit</span><select value={d.circuitId} onChange={e=>on({circuitId:e.target.value})}>
           {project.circuits.map(c=><option key={c.id} value={c.id}>{c.name} · {c.supply}</option>)}
         </select><small>The selected circuit supplies the USB-C charger. Choose 230V if using a mains USB-C adapter.</small></label>
         <label className="field"><span>Battery capacity evidence</span><select value={d.batteryEvidence} onChange={e=>on({batteryEvidence:e.target.value as Evidence})}>
           {(['estimated','manual','measured','reported','listing','unknown'] as Evidence[]).map(v=><option key={v} value={v}>{v}</option>)}
         </select></label>
         <label className="field"><span>Manufacturer specification URL</span><input type="url" value={d.specificationUrl}
           onChange={e=>on({specificationUrl:e.target.value})} placeholder="Optional"/></label>
       </div>
       <label className="field"><span>Model / assumptions / notes</span><textarea rows={2} value={d.notes} onChange={e=>on({notes:e.target.value})}/></label>
       <div className="portable-breakdown">
         <div><small>Energy stored in device</small><strong>{fmt(result.deviceWh)} Wh</strong></div>
         <div><small>Charge-conversion losses</small><strong>{fmt(loss)} Wh</strong></div>
         <div><small>Draw from supply circuit</small><strong>{fmt(result.supplyWh)} Wh</strong></div>
         <div><small>Habitation battery demand</small><strong>{fmt(result.batteryWh)} Wh</strong></div>
       </div>
       {d.batteryEvidence==='estimated'&&<p className="field-warning"><Info size={14}/> Device battery capacity is an illustrative estimate. Change it when you know the exact iPhone/iPad model.</p>}
       {result.issues.map((issue,index)=><p className="field-warning" key={index}><AlertTriangle size={14}/>{issue}</p>)}
       <p className="autonomy-note"><BatteryCharging size={14}/> USB-C port power ratings determine charging speed and peak circuit load; this estimate models daily energy only and does not establish the required fuse or peak charging amperage.</p>
     </section>;
   })}
   {usbGeneric.length>0&&<div className="notice critical"><AlertTriangle size={19}/><div><strong>Possible double counting</strong>
     <p>USB charging panel placeholders still have active run times: {usbGeneric.map(l=>l.name).join(', ')}. If those represent the same phones/tablet, set their usage to zero in Circuits & loads; keep them only for separate loads not included here.</p></div></div>}
   <div className="notice"><Info size={19}/><div><strong>Energy is accounted for once</strong><p>These device charging events are attributed to the selected circuit and automatically included in daily battery usage and off-grid autonomy. We don't add an extra generic USB charger load for the same electricity. Press Update to save your changes or Reset to discard them.</p></div></div>
 </div>;
}
