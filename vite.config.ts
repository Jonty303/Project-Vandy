import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Development-only PVGIS proxy: the European Commission explicitly disallows browser AJAX
 * to PVGIS. A production deployment requires a real backend endpoint with caching/rate limits.
 * This server-side Vite middleware is for Codespaces and localhost previews only.
 */
function pvgisDevProxy(): Plugin {
  const cache=new Map<string,{savedAt:number;body:unknown}>();
  const uk=[
    {name:'Glasgow',lat:55.864,lon:-4.252},
    {name:'Leeds',lat:53.8,lon:-1.549},
    {name:'Birmingham',lat:52.486,lon:-1.89},
    {name:'Bristol',lat:51.455,lon:-2.588},
    {name:'London',lat:51.507,lon:-0.128},
  ];
  async function monthly(lat:number,lon:number,watts:number,loss:number,angle:number,aspect:number):Promise<number[]> {
    const params=new URLSearchParams({
      lat:String(lat),lon:String(lon),peakpower:String(watts/1000),
      loss:String(loss),angle:String(angle),aspect:String(aspect),outputformat:'json'
    });
    const api='https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?'+params;
    const response=await fetch(api,{signal:AbortSignal.timeout(25000),headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`PVGIS returned HTTP ${response.status}`);
    const data=await response.json() as {outputs?:{monthly?:{fixed?:{month:number;E_m:number}[]}}};
    const rows=data.outputs?.monthly?.fixed;
    if(!Array.isArray(rows)||rows.length!==12)throw new Error('Unexpected PVGIS monthly response');
    const ordered=Array.from({length:12},()=>Number.NaN);
    for(const r of rows){
      const index=Number(r.month)-1;
      if(index>=0&&index<12&&Number.isFinite(r.E_m) &&r.E_m>=0){
        const days=new Date(2025,index+1,0).getDate();
        ordered[index]=r.E_m*1000/days; // PVGIS E_m is kWh per average historical month.
      }
    }
    if(ordered.some(v=>!Number.isFinite(v)))throw new Error('Incomplete PVGIS monthly values');
    return ordered;
  }
  return {name:'vandy-pvgis-development-proxy',configureServer(server){
    server.middlewares.use('/api/solar-monthly',async(req,res)=>{
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      if(req.method!=='GET'){res.statusCode=405;res.end(JSON.stringify({error:'GET only'}));return;}
      try{
        const url=new URL(req.url??'','http://localhost');
        const num=(name:string,min:number,max:number)=>{
          const raw=url.searchParams.get(name),v=raw===null?Number.NaN:Number(raw);
          if(!Number.isFinite(v)||v<min||v>max)throw new Error(`Invalid ${name}`);
          return v;
        };
        const mode=url.searchParams.get('mode');
        if(mode!=='uk-reference'&&mode!=='selected-location')throw new Error('Invalid solar mode');
        const watts=num('watts',1,3000),limit=num('limit',1,3000),
          loss=num('loss',0,70),angle=num('angle',0,90),aspect=num('aspect',-180,180);
        const effectiveWatts=Math.min(watts,limit);
        const lat=mode==='selected-location'?num('lat',-60,72):53.8;
        const lon=mode==='selected-location'?num('lon',-180,180):-1.549;
        const key=JSON.stringify({mode,lat,lon,effectiveWatts,loss,angle,aspect});
        const cached=cache.get(key);
        if(cached&&Date.now()-cached.savedAt<86_400_000){res.end(JSON.stringify(cached.body));return;}
        const places=mode==='uk-reference'?uk:[{name:'Selected location',lat,lon}];
        // Sequential requests avoid hammering the public PVGIS service.
        const all:number[][]=[];
        for(const p of places)all.push(await monthly(p.lat,p.lon,effectiveWatts,loss,angle,aspect));
        const monthlyDailyWh=Array.from({length:12},(_,i)=>all.reduce((sum,series)=>sum+series[i],0)/all.length);
        const description=mode==='uk-reference'?'Equal-weight average of five illustrative UK locations (Glasgow, Leeds, Birmingham, Bristol and London)':'Historical monthly PV yield for selected coordinates';
        const body={monthlyDailyWh,description,provider:'PVGIS-v5_3',requestedAt:new Date().toISOString(),effectiveWatts};
        cache.set(key,{savedAt:Date.now(),body});
        res.end(JSON.stringify(body));
      }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e instanceof Error?e.message:'PVGIS lookup failed'}));}
    });
  }};
}
export default defineConfig({
  plugins:[react(),pvgisDevProxy()],
  base:'./',
});
