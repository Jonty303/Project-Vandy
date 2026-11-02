import {useState} from 'react';
import {MapPin,RefreshCw,AlertTriangle} from 'lucide-react';
import {selectedBattery,plannerTotal,type Planner} from '../domain/loadPlanner.ts';
import {panelArray,plannedInverter} from '../domain/charging.ts';
import {
  MONTHS,REGIONS,solarKey,matchingSolar,monthRating,allMonthRatings,projectedBattery,
  type OffGridPlan,type SolarDataset,
} from '../domain/offGrid.ts';
import './offGrid.css';

type Props={planner:Planner;onChange:(next:OffGridPlan)=>void};
const fmt=(n:number|null,precision=0)=>n===null?'Unavailable':n.toLocaleString('en-GB',{maximumFractionDigits:precision});
const displayDays=(n:number|null,balanced:boolean)=>balanced?'Balanced*':n===null?'—':n>365?'365+':fmt(n,1)+' days';
const num=(s:string)=>Number(s);
function BudgetGraph({planner}:{planner:Planner}){
 const results=allMonthRatings(planner);
 const selected=planner.offGrid.month;
 const valid=results.filter((r):r is NonNullable<typeof r>=>r!==null&&r.solarWh!==null);
 const peak=Math.max(1,...valid.flatMap(r=>[r.demandWh,r.solarWh??0,r.solarWh!+r.drivingWh]))*1.15;
 const y=(v:number)=>218-(v/peak)*166;
 const cells=MONTHS.map((name,i)=>({name,i,r:results[i]}));
 return <div className="og-graph-wrap"><svg viewBox="0 0 920 270" role="img"
   aria-label="Monthly daily energy demand and solar plus driving recharge; select month using the buttons below"
   className="og-bar-graph">
   {[0,.25,.5,.75,1].map(v=><g key={v}>
     <line x1="44" x2="910" y1={y(peak*v)} y2={y(peak*v)} stroke="#345363" strokeDasharray="3 5"/>
     <text x="38" y={y(peak*v)+4} textAnchor="end" fill="#9bb8c0" fontSize="10">{fmt(peak*v/1000,1)}k</text>
   </g>)}
   {cells.map(({i,r})=>{
     const cx=67+i*70;
     return <g key={i} onClick={()=>{}} aria-label={MONTHS[i]}>
       {i===selected&&<rect x={cx-10} y="34" width="68" height="220" rx="8" fill="#21454b"/>}
       {r?.solarWh!==null&&r?.solarWh!==undefined&&<>
         <rect x={cx+19} y={y((r.solarWh??0)+r.drivingWh)} width="20" height={218-y((r.solarWh??0)+r.drivingWh)}
           fill="#49cbb0" rx="2"/>
         <rect x={cx+19} y={y((r.solarWh??0)+r.drivingWh)} width="20"
           height={r.drivingWh/peak*166} fill="#6d96f0" rx="2"/>
       </>}
       {r&&<rect x={cx-4} y={y(r.demandWh)} width="19" height={218-y(r.demandWh)} fill="#d4b16e" rx="2"/>}
       <text x={cx+16} y="238" textAnchor="middle" fill={i===selected?'#b2ffeb':'#9bb9c3'} fontSize="11">{MONTHS[i].slice(0,3)}</text>
     </g>;
   })}
   <text x="45" y="19" fill="#a9c5cc" fontSize="12">Wh/day</text>
 </svg>
 <div className="og-legend"><span><i className="demand"/>Battery demand</span><span><i className="solar"/>Solar yield</span><span><i className="driving"/>Driving recharge</span></div>
 </div>;
}
function Trajectory({planner}:{planner:Planner}){
 const month=planner.offGrid.month;
 const driving=projectedBattery(planner,month,14,true);
 const still=projectedBattery(planner,month,14,false);
 if(!driving.length||!still.length)return null;
 const coords=(points:typeof driving)=>points.map(d=>String(42+d.day*58)+','+String(228-d.percentage*1.92)).join(' ');
 return <div className="og-graph-wrap">
   <svg viewBox="0 0 920 255" className="og-bar-graph" role="img"
     aria-label="Fourteen day illustrative battery state of charge projection, stationary compared with daily driving">
     {[0,25,50,75,100].map(v=><g key={v}>
       <line x1="42" y1={228-v*1.92} x2="892" y2={228-v*1.92} stroke="#345363" strokeDasharray="3 5"/>
       <text x="35" y={232-v*1.92} textAnchor="end" fill="#a0b8c3" fontSize="11">{v}%</text>
     </g>)}
     <polyline points={coords(still)} stroke="#d4b16e" strokeWidth="3" fill="none" strokeLinejoin="round"/>
     <polyline points={coords(driving)} stroke="#49cbb0" strokeWidth="3" fill="none" strokeLinejoin="round"/>
     {driving.filter(p=>p.day%2===0).map(p=><text key={p.day} x={42+p.day*58} y="249" textAnchor="middle" fontSize="10" fill="#9ebbc3">{p.day}d</text>)}
   </svg>
   <div className="og-legend"><span><i className="demand"/>Stationary</span><span><i className="solar"/>Driving daily</span></div>
 </div>;
}
export function OffGridPage({planner,onChange}:Props){
 const p=planner.offGrid;
 const battery=selectedBattery(planner);
 const ratings=allMonthRatings(planner);
 const chosen=monthRating(planner,p.month);
 const solarData=matchingSolar(p);
 const [regionsQuery,setRegionsQuery]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const patch=(change:Partial<OffGridPlan>)=>onChange({...p,...change});
 const chooseGps=()=>{
   setError('');setNotice('');
   if(!navigator.geolocation){setError('Browser geolocation is unavailable.');return;}
   navigator.geolocation.getCurrentPosition(({coords})=>{
     patch({locationMode:'gps',gpsLat:Math.round(coords.latitude*10000)/10000,
       gpsLon:Math.round(coords.longitude*10000)/10000,dataset:null});
     setNotice('Location acquired. Refresh historical solar data to use it.');
   },e=>setError('Could not use your location: '+e.message),{enableHighAccuracy:false,timeout:15000});
 };
 const refresh=async()=>{
   const key=solarKey(p);
   if(p.locationMode==='gps'&&(p.gpsLat===null||p.gpsLon===null)){
     setError('Select Use my location first.');return;
   }
   const region=REGIONS.find(r=>r.id===p.regionId)!;
   const lat=p.locationMode==='gps'?p.gpsLat:region.lat;
   const lon=p.locationMode==='gps'?p.gpsLon:region.lon;
   const q=new URLSearchParams({mode:p.locationMode==='uk'?'uk':'point',
     lat:String(lat),lon:String(lon),tilt:String(p.tiltDeg),loss:String(p.solarLossPct)});
   setError('');setNotice('');setLoading(true);
   try{
     const res=await fetch('/api/pvgis/monthly?'+q.toString(),{headers:{Accept:'application/json'}});
     const body:unknown=await res.json();
     if(!res.ok)throw new Error((body as {error?:string}).error||'PVGIS failed: HTTP '+res.status);
     const data=body as {monthlyKWhPerKwDay:number[];source:string;locationName:string};
     if(!Array.isArray(data.monthlyKWhPerKwDay)||data.monthlyKWhPerKwDay.length!==12||
       !data.monthlyKWhPerKwDay.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0))
       throw new Error('Monthly PVGIS data was incomplete');
     const dataset:SolarDataset={key,monthlyKWhPerKwDay:data.monthlyKWhPerKwDay,
       fetchedAt:new Date().toISOString(),source:data.source,
       locationName:p.locationMode==='region'?region.name:
         p.locationMode==='gps'?'Browser GPS position':data.locationName};
     patch({dataset});setNotice('Monthly historical solar data loaded. Press Update to save this source with the plan.');
   }catch(e){setError((e instanceof Error?e.message:String(e))+
     '. The estimates remain unavailable rather than inventing solar yield.');}
   finally{setLoading(false);}
 };
 const allRegions=REGIONS.filter(r=>r.name.toLowerCase().includes(regionsQuery.toLowerCase())).slice(0,25);
 const anySolar=(panelArray(planner.charging.panel).watts??0)>0&&planner.charging.mppt.length>0;
 const ready=battery&&chosen&&(!anySolar||solarData);
 const loadIssues=plannerTotal(planner).missing;
 const inverter=plannedInverter(planner.charging);
 return <div className="og-page">
   <div className="section-heading heading-top"><div>
     <div className="eyebrow">MONTHLY ENERGY BALANCE</div><h1>Off-grid rating</h1>
     <p>Typical battery autonomy with and without daily driving, using monthly historical solar averages.</p>
   </div></div>
   <section className="panel planner-detail-panel">
     <h2>Planning assumptions</h2>
     <div className="og-fields">
       <label className="field"><span>Hours willing to drive each day</span>
         <input type="number" min="0" max="24" step=".25" value={p.driveHours}
           onChange={e=>patch({driveHours:num(e.target.value)})}/>
       </label>
       <label className="field"><span>Location source</span>
         <select value={p.locationMode} onChange={e=>patch({locationMode:e.target.value as OffGridPlan['locationMode']})}>
           <option value="uk">UK average — five-site indicative reference</option>
           <option value="region">Search UK regions</option>
           <option value="gps">Browser GPS position</option>
         </select>
       </label>
       {p.locationMode==='region'&&<div className="og-region-field">
         <label className="field"><span>Search regions</span>
           <input type="search" placeholder="e.g. Yorkshire, Scotland, London" value={regionsQuery}
             onChange={e=>setRegionsQuery(e.target.value)}/>
         </label>
         <label className="field"><span>Location for solar estimates</span>
           <select value={p.regionId} onChange={e=>patch({regionId:e.target.value})}>
             {!allRegions.some(r=>r.id===p.regionId)&&<option value={p.regionId}>{REGIONS.find(r=>r.id===p.regionId)?.name}</option>}
             {allRegions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
           </select>
         </label>
       </div>}
       {p.locationMode==='gps'&&<div className="og-gps">
         <button className="button small" onClick={chooseGps}><MapPin size={16}/>Use my location</button>
         <small>{p.gpsLat===null?'No browser location selected':'Location captured (coordinates held in the project)'}</small>
       </div>}
       <label className="field"><span>Solar panel tilt (° from horizontal)</span>
         <input type="number" min="0" max="90" value={p.tiltDeg}
           onChange={e=>patch({tiltDeg:num(e.target.value)})}/>
       </label>
       <label className="field"><span>PVGIS system losses (%)</span>
         <input type="number" min="0" max="99" step="1" value={p.solarLossPct}
           onChange={e=>patch({solarLossPct:num(e.target.value)})}/>
       </label>
       <label className="field"><span>Generic inverter efficiency (%)</span>
         <input type="number" min="1" max="100" value={Math.round(p.genericInverterEfficiency*100)}
           disabled={!!inverter}
           onChange={e=>patch({genericInverterEfficiency:num(e.target.value)/100})}/>
       </label>
       <label className="field"><span>DC conversion efficiency (%)</span>
         <input type="number" min="1" max="100" value={Math.round(p.dcConverterEfficiency*100)}
           onChange={e=>patch({dcConverterEfficiency:num(e.target.value)/100})}/>
       </label>
     </div>
     {inverter&&<p className="planner-note">230 V loads use {inverter.name} maximum manufacturer inverter efficiency ({fmt((inverter.inverterEfficiency??0)*100)}%). Real part-load efficiency and idle draw may be lower.</p>}
     <div className="og-refresh"><button className="button primary" disabled={loading||!validCoordinates(p)}
       onClick={refresh}><RefreshCw size={16}/>{loading?'Loading PVGIS averages…':'Refresh monthly solar data'}</button>
       <a href="https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en"
          target="_blank" rel="noreferrer">PVGIS source & methodology</a>
     </div>
     {error&&<p className="validation-warning"><AlertTriangle size={17}/>{error}</p>}
     {notice&&<p className="og-success">{notice}</p>}
     {solarData?<p className="planner-note">Data: {solarData.source}. {solarData.locationName};
       fetched {new Date(solarData.fetchedAt).toLocaleDateString('en-GB')}. Not a live weather forecast.</p>:
       anySolar&&<p className="validation-warning"><AlertTriangle size={17}/>
         Solar data not yet loaded for the selected location and assumptions. Results requiring solar are withheld.</p>}
   </section>
   {!battery&&<p className="validation-warning"><AlertTriangle size={17}/>Select a planned battery before calculating off-grid autonomy.</p>}
   {loadIssues>0&&<p className="validation-warning"><AlertTriangle size={17}/>{loadIssues} loads lack complete figures; autonomy is withheld until daily energy demand is known.</p>}
   {ready&&<section className="panel planner-detail-panel">
     <div className="panel-head"><h2>Monthly off-grid comparison</h2>
       <span>{battery?.name} · {p.driveHours} h/day driving</span></div>
     <BudgetGraph planner={planner}/>
     <div className="og-months" role="group" aria-label="Select month">
       {MONTHS.map((m,i)=><button key={m} type="button"
         className={i===p.month?'active':''} aria-pressed={i===p.month}
         onClick={()=>patch({month:i})}>{m.slice(0,3)}</button>)}
     </div>
     <div className="og-selected-heading">{MONTHS[p.month]} — typical daily budget</div>
     <div className="og-metrics">
       <div><span>Battery-side demand</span><strong>{fmt(chosen?.demandWh??null)} Wh</strong></div>
       <div><span>Solar replenishment</span><strong>{fmt(chosen?.solarWh??null)} Wh</strong></div>
       <div><span>DC–DC while driving</span><strong>{fmt(chosen?.drivingWh??null)} Wh</strong></div>
       <div><span>Daily net, with driving</span><strong>{fmt(chosen?.netDrivingWh??null)} Wh</strong></div>
     </div>
     <div className="og-ratings">
       <div><span>Stationary (no driving)</span>
         <strong>{displayDays(chosen?.stationaryDays??null,chosen?.stationaryBalanced??false)}</strong>
       </div>
       <div><span>Driving {p.driveHours} h/day</span>
         <strong>{displayDays(chosen?.drivingDays??null,chosen?.drivingBalanced??false)}</strong>
       </div>
     </div>
     <h3>Illustrative battery trajectory — first 14 days</h3>
     <Trajectory planner={planner}/>
     <p className="planner-note">*Balanced means predicted daily replenishment meets or exceeds average demand, not unlimited autonomy.
       Weather variability, shade, charger curtailment, low temperature, battery ageing, time of day and actual driving profile are not modelled.
       Both ratings start with a full battery, keep a 10% reserve, and never add shore charging.</p>
   </section>}
   <p className="planner-note">These are planning estimates, not guaranteed days off-grid. PVGIS gives long-term monthly average
     fixed-panel production for a 1 kWp reference, scaled to the selected array with an approximate MPPT clipping cap.
     The model does not allocate panel strings across multiple MPPTs or validate cable protection.</p>
 </div>;
}
const validCoordinates=(p:OffGridPlan)=>p.locationMode!=='gps'||p.gpsLat!==null&&p.gpsLon!==null;
