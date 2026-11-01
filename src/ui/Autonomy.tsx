import { useMemo, useState } from 'react';
import { AlertTriangle, BatteryCharging, CloudSun, MapPin, RefreshCw, Route } from 'lucide-react';
import type { AutonomySettings, Project } from '../domain/model.ts';
import { autonomySettings, dcDcEstimate, estimateSolarWh, LOCATION_PRESETS, projectAutonomy, solarFingerprint } from '../domain/autonomy.ts';

interface Props {project: Project; profileId:string; change:(fn:(p:Project)=>Project)=>void}
const wh=(x:number|null,digits=0)=>x===null?'Unknown':x.toLocaleString('en-GB',{maximumFractionDigits:digits})+' Wh';
const num=(n:number|null)=>n===null?'':String(n);
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function reportDays(days:number|null,status:'unknown'|'depleting'|'no-average-depletion'){
  if(status==='no-average-depletion')return 'No net depletion under average conditions';
  if(status==='unknown')return 'Insufficient input data';
  return days===null?'Unknown':days<1?Math.round(days*24)+' hours':days.toFixed(1)+' days';
}
export function AutonomyPage({project,profileId,change}:Props){
  const settings=autonomySettings(project);
  const projection=useMemo(()=>projectAutonomy(project,profileId),[project,profileId]);
  const dc=dcDcEstimate(settings,project.nominalBatteryVoltage);
  const solar=estimateSolarWh(settings);
  const [fetching,setFetching]=useState(false);
  const [apiMessage,setApiMessage]=useState('');
  const patch=<K extends keyof AutonomySettings>(key:K,value:AutonomySettings[K])=>change(p=>({...p,autonomy:{...autonomySettings(p),[key]:value}}));
  const numeric=(key:keyof AutonomySettings,value:string)=>{const n=Number(value);if(value.trim()!==''&&Number.isFinite(n))change(p=>({...p,autonomy:{...autonomySettings(p),[key]:n}}));};
  async function refreshSolar(){
    if(fetching)return;
    setFetching(true);setApiMessage('');
    try{
      const s=settings;
      const query=new URLSearchParams({
        mode:s.solarMode,lat:String(s.solarLatitude),lon:String(s.solarLongitude),
        watts:String(s.solarPanelWatts),limit:String(s.mpptNominalPvLimitWatts),
        loss:String(s.solarLossPct),angle:String(s.solarInclinationDeg),aspect:String(s.solarAspectDeg)
      });
      const response=await fetch('/api/solar-monthly?'+query.toString());
      const body=await response.json() as {monthlyDailyWh?:unknown;description?:string;requestedAt?:string;error?:string};
      if(!response.ok)throw new Error(body.error??'PVGIS service not available');
      if(!Array.isArray(body.monthlyDailyWh)||body.monthlyDailyWh.length!==12||body.monthlyDailyWh.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))
        throw new Error('PVGIS returned invalid monthly data');
      const values=body.monthlyDailyWh as number[];
      const fingerprint=solarFingerprint(s);
      change(p=>({...p,autonomy:{...autonomySettings(p),solarClimatology:{
        source:'PVGIS-v5_3',requestedAt:body.requestedAt??new Date().toISOString(),
        description:body.description??'European Commission PVGIS monthly estimate',queryFingerprint:fingerprint,monthlyDailyWh:values
      }}}));
      setApiMessage('PVGIS monthly data loaded and saved in this browser.');
    }catch(e){setApiMessage((e instanceof Error?e.message:'PVGIS request failed')+'. In a static production deployment a separate backend is required; use a manual daily estimate meanwhile.');}
    finally{setFetching(false);}
  }
  const data=settings.solarClimatology;
  const validSeries=data?.queryFingerprint===solarFingerprint(settings)?data.monthlyDailyWh:null;
  const values=validSeries?.map(v=>v*settings.solarShadingFraction)??[];
  const peak=Math.max(1,...values);
  return <div className="autonomy-page">
    <div className="section-heading heading-top"><div><div className="eyebrow">CHARGING & AUTONOMY / PLANNING</div><h1>Off-grid endurance</h1><p>Combine your normal electricity use with driving and historical solar generation.</p></div></div>
    <div className="notice"><AlertTriangle size={20}/><div><strong>Scenario projection, not a guaranteed runtime.</strong><p>Appliance ratings, actual SOC, battery acceptance, alternator behaviour, clouds, shading and charge-stage taper can materially change the result. Stationary and daily-driving results always model inverter operation, not shore power.</p></div></div>
    <div className="autonomy-grid">
      <section className="panel"><div className="panel-head"><h2><BatteryCharging size={18}/> Battery reserve</h2></div>
        <div className="form-grid">
          <label className="field"><span>Starting battery SOC (%)</span><input type="number" min="0" max="100" value={settings.startingSocPct} onChange={e=>numeric('startingSocPct',e.target.value)}/></label>
          <label className="field"><span>Minimum reserve SOC (%)</span><input type="number" min="0" max="100" value={settings.reserveSocPct} onChange={e=>numeric('reserveSocPct',e.target.value)}/></label>
        </div><p className="autonomy-note">Uses {project.batteryCapacityAh??'unknown'}Ah at {project.nominalBatteryVoltage}V nominal, with no assumption about battery health or temperature. Configured usable range: {wh(projection.batteryUsableWh)}.</p>
      </section>
      <section className="panel"><div className="panel-head"><h2><Route size={18}/> DC-DC charging while driving</h2></div>
        <div className="form-grid">
          <label className="field"><span>Average driving hours/day</span><input type="number" min="0" max="24" step="0.25" value={settings.hoursDrivingPerDay} onChange={e=>numeric('hoursDrivingPerDay',e.target.value)}/></label>
          <label className="field"><span>Spare alternator current (A)</span><input type="number" min="0" placeholder="Unknown" value={num(settings.availableAlternatorA)} onChange={e=>patch('availableAlternatorA',e.target.value.trim()===''?null:Math.max(0,Number(e.target.value)))}/></label>
          <label className="field"><span>Orion input limit (A)</span><input type="number" min="0" max="50" value={settings.dcDcInputCurrentLimitA} onChange={e=>numeric('dcDcInputCurrentLimitA',e.target.value)}/></label>
          <label className="field"><span>Orion output limit (A)</span><input type="number" min="0" max="50" value={settings.dcDcOutputCurrentLimitA} onChange={e=>numeric('dcDcOutputCurrentLimitA',e.target.value)}/></label>
          <label className="field"><span>Alternator-side voltage (V)</span><input type="number" min="9" max="17" step="0.1" value={settings.alternatorVoltageV} onChange={e=>numeric('alternatorVoltageV',e.target.value)}/></label>
          <label className="field"><span>Charging voltage (V)</span><input type="number" min="10" max="17" step="0.1" value={settings.dcDcOutputVoltageV} onChange={e=>numeric('dcDcOutputVoltageV',e.target.value)}/></label>
          <label className="field"><span>Assumed efficiency (%)</span><input type="number" min="1" max="100" value={Math.round(settings.dcDcEfficiency*100)} onChange={e=>patch('dcDcEfficiency',Math.min(1,Math.max(0,Number(e.target.value)/100)))}/></label>
          <label className="field"><span>Charging active while driving (%)</span><input type="number" min="0" max="100" value={Math.round(settings.dcDcActiveFraction*100)} onChange={e=>patch('dcDcActiveFraction',Math.min(1,Math.max(0,Number(e.target.value)/100)))}/></label>
        </div>
        <p className="autonomy-note">Modelled battery-side DC-DC charging: <strong>{wh(dc.wh)}</strong> per day. Input and output currents are separately constrained; charger maximum is 700W under nominal conditions.</p>
        <p className="autonomy-note">A smart alternator may suspend charging while driving. The active fraction is an assumption; verify your Orion configuration and actual current.</p>
      </section>
    </div>
    <section className="panel autonomy-solar"><div className="panel-head"><h2><CloudSun size={19}/> Solar & MPPT recharge</h2></div>
      <p className="autonomy-note">The PVGIS service supplies historical monthly PV estimates. The UK reference uses five sample cities averaged equally; it is <strong>not</strong> an official area-weighted UK average. Location estimates use the same climatological model, not a live forecast.</p>
      <div className="form-grid">
        <label className="field"><span>Solar reference</span><select value={settings.solarMode} onChange={e=>patch('solarMode',e.target.value as 'uk-reference'|'selected-location')}><option value="uk-reference">UK indicative five-region reference</option><option value="selected-location">Selected location</option></select></label>
        <label className="field"><span>Month</span><select value={settings.solarMonth} onChange={e=>patch('solarMonth',Number(e.target.value))}>{months.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select></label>
        {settings.solarMode==='selected-location'&&<>
          <label className="field"><span><MapPin size={13}/> Location preset</span><select value="" onChange={e=>{const preset=LOCATION_PRESETS.find(x=>x.name===e.target.value);if(preset)change(p=>({...p,autonomy:{...autonomySettings(p),solarLatitude:preset.lat,solarLongitude:preset.lon,solarLocationName:preset.name}}));}}>
              <option value="">Choose a reference location…</option>{LOCATION_PRESETS.map(loc=><option key={loc.name} value={loc.name}>{loc.name}</option>)}</select></label>
          <label className="field"><span>Location label</span><input value={settings.solarLocationName} onChange={e=>patch('solarLocationName',e.target.value)}/></label>
          <label className="field"><span>Latitude</span><input type="number" step="0.001" min="-60" max="72" value={settings.solarLatitude} onChange={e=>numeric('solarLatitude',e.target.value)}/></label>
          <label className="field"><span>Longitude</span><input type="number" step="0.001" min="-180" max="180" value={settings.solarLongitude} onChange={e=>numeric('solarLongitude',e.target.value)}/></label>
        </>}
        <label className="field"><span>Panel rated watts (Wp)</span><input type="number" min="1" value={settings.solarPanelWatts} onChange={e=>numeric('solarPanelWatts',e.target.value)}/></label>
        <label className="field"><span>MPPT nominal PV cap (W)</span><input type="number" min="1" value={settings.mpptNominalPvLimitWatts} onChange={e=>numeric('mpptNominalPvLimitWatts',e.target.value)}/></label>
        <label className="field"><span>PVGIS system loss (%)</span><input type="number" min="0" max="70" value={settings.solarLossPct} onChange={e=>numeric('solarLossPct',e.target.value)}/></label>
        <label className="field"><span>Orientation / aspect (°)</span><input type="number" min="-180" max="180" value={settings.solarAspectDeg} onChange={e=>numeric('solarAspectDeg',e.target.value)}/></label>
        <label className="field"><span>Roof panel tilt from horizontal (°)</span><input type="number" min="0" max="90" value={settings.solarInclinationDeg} onChange={e=>numeric('solarInclinationDeg',e.target.value)}/></label>
        <label className="field"><span>Additional shade/derate factor (%)</span><input type="number" min="0" max="100" value={Math.round(settings.solarShadingFraction*100)} onChange={e=>patch('solarShadingFraction',Math.min(1,Math.max(0,Number(e.target.value)/100)))}/></label>
        <label className="field"><span>Manual daily solar (Wh, overrides PVGIS)</span><input type="number" min="0" placeholder="Use PVGIS by leaving blank" value={num(settings.solarManualWhPerDay)} onChange={e=>patch('solarManualWhPerDay',e.target.value.trim()===''?null:Math.max(0,Number(e.target.value)))}/></label>
      </div>
      <div className="autonomy-actions"><button className="button primary" disabled={fetching} onClick={()=>void refreshSolar()}><RefreshCw size={15}/>{fetching?'Fetching PVGIS data…':'Fetch solar estimates'}</button>
        <span>{solar.wh===null?'Solar contribution: unknown':`Selected month: ${wh(solar.wh)} per day`}</span></div>
      {apiMessage&&<p className="autonomy-note">{apiMessage}</p>}
      {settings.solarPanelWatts>settings.mpptNominalPvLimitWatts&&<p className="supply-issue"><AlertTriangle size={15}/> Panel power exceeds configured MPPT nominal PV rating. PVGIS power is capped conservatively; actual time-series clipping is not calculated.</p>}
      {values.length===12&&<div className="autonomy-monthly"><p>Typical daily PV yield by calendar month — {data?.description}, after user shade factor</p>
        <div className="autonomy-bars">{values.map((v,i)=><div key={i} className={i+1===settings.solarMonth?'current':''}><span title={`${months[i]}: ${Math.round(v)} Wh/day`} style={{height:`${Math.max(3,90*v/peak)}px`}}/><small>{months[i]}</small></div>)}</div></div>}
      <p className="autonomy-note">{solar.source}. Panel Wp and MPPT limits are not a precise hourly clipping model. Generation that cannot be accepted by a full battery is not banked for later days.</p>
    </section>
    <section className="panel autonomy-results"><div className="panel-head"><h2>Off-grid rating & daily energy balance</h2></div>
      <div className="autonomy-rating"><small>PRELIMINARY OFF-GRID ASSESSMENT</small><strong>{
        projection.ratingBlockers.length>0
          ? `Not yet rated — ${projection.ratingBlockers.length} required ${projection.ratingBlockers.length===1?'input needs':'inputs need'} attention`
          : projection.stationaryStatus==='no-average-depletion'
            ? 'Indicative stationary energy surplus'
            : projection.stationaryDays!==null
              ? `Indicative ${projection.stationaryDays.toFixed(1)} stationary days to reserve`
              : 'Stationary endurance cannot be calculated'
      }</strong><p>Using the <strong>{projection.profileName}</strong> consumption profile and <strong>{projection.solarMonthName}</strong> solar assumptions. Figures remain planning estimates, not certified or guaranteed endurance.</p></div>
      {projection.ratingBlockers.length>0&&<div className="autonomy-diagnostic-panel" role="status">
        <h3><AlertTriangle size={17}/> Exactly what is preventing a rating</h3>
        <p>These values are needed for a reliable stationary and driving estimate. Until entered, consumption and the energy balance below are <strong>partial</strong>, and may overstate endurance.</p>
        <ul>{projection.ratingBlockers.map(reason=><li key={reason.id}><strong>{reason.title}</strong><span>{reason.detail}</span><small>{reason.action}</small></li>)}</ul>
      </div>}
      {projection.drivingBlockers.length>0&&<div className="autonomy-diagnostic-panel" role="status">
        <h3><Route size={17}/> Additional information needed for driving endurance</h3>
        <p>These inputs affect <strong>driving only</strong>; they do not prevent the stationary projection.</p>
        <ul>{projection.drivingBlockers.map(reason=><li key={reason.id}><strong>{reason.title}</strong><span>{reason.detail}</span><small>{reason.action}</small></li>)}</ul>
      </div>}
      <div className="autonomy-provisional"><h3>Why the remaining figures are still estimates</h3>
        <p>Even after required inputs are entered, these assumptions limit confidence. They are not proof of actual charging or battery autonomy.</p>
        <ul>{projection.provisionalReasons.map(reason=><li key={reason.id}><strong>{reason.title}</strong><span>{reason.detail}</span><small>{reason.action}</small></li>)}</ul>
      </div>
      <div className="autonomy-numbers"><div><small>{projection.ratingBlockers.some(r=>r.category==='consumer')?'Known loads only — incomplete':'Daily load demand'}</small><strong>{wh(projection.dailyDemandWh)}</strong></div><div><small>Solar recharge · {projection.solarMonthName}</small><strong>{wh(projection.solarWh)}</strong></div><div><small>Driving recharge</small><strong>{wh(projection.drivingWh)}</strong></div></div>
      <div className="autonomy-grid">
        <article><h3>Stationary, no driving</h3><strong>{projection.ratingBlockers.length?'Not reliably calculable':reportDays(projection.stationaryDays,projection.stationaryStatus)}</strong><p>{projection.ratingBlockers.length?'Partial net demand':'Net battery demand'}: {wh(projection.stationaryNetWh)}</p></article>
        <article><h3>With daily driving</h3><strong>{projection.ratingBlockers.length||projection.drivingBlockers.length?'Not reliably calculable':reportDays(projection.drivingDays,projection.drivingStatus)}</strong><p>{projection.ratingBlockers.length||projection.drivingBlockers.length?'Partial net demand':'Net battery demand'}: {wh(projection.drivingNetWh)}</p></article>
      </div>
      <p className="autonomy-note">A non-depleting average-day result is <strong>not unlimited off-grid endurance</strong>; several poor solar days or higher actual load may still exhaust the battery.</p>
      {projection.ratingBlockers.length>0&&<p className="supply-issue"><AlertTriangle size={15}/> The displayed Wh totals exclude unknown or incompatible consumption. See the specific missing inputs above before relying on an off-grid estimate.</p>}
      {projection.warnings.map((w,i)=><p className="autonomy-note" key={i}>• {w}</p>)}
    </section>
  </div>;
}
