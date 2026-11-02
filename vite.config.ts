import {defineConfig,type Plugin} from 'vite';
import react from '@vitejs/plugin-react';

/** PVGIS v5.3 historical long-term averages. Development middleware only:
 * a deployed static app needs a separate same-origin API backend.
 * No mock yield values are substituted if the official source is unavailable.
 */
function pvgisMonthly():Plugin{
 const cache=new Map<string,{expiry:number,values:number[]}>();
 const points=[
  [55.953,-3.189],[53.481,-2.243],[51.481,-3.179],
  [51.507,-0.128],[52.630,1.298],
 ];
 async function one(lat:number,lon:number,tilt:number,loss:number){
  const key=[lat,lon,tilt,loss].join(':');
  const hit=cache.get(key);
  if(hit&&hit.expiry>Date.now())return hit.values;
  const u=new URL('https://re.jrc.ec.europa.eu/api/v5_3/PVcalc');
  for(const [k,v] of Object.entries({lat,lon,peakpower:1,loss,angle:tilt,aspect:0,
      pvtechchoice:'crystSi',mountingplace:'free',outputformat:'json'}))
    u.searchParams.set(k,String(v));
  const signal=AbortSignal.timeout(25000);
  const response=await fetch(u,{signal,headers:{'Accept':'application/json'}});
  if(!response.ok)throw new Error('PVGIS response '+response.status);
  const body:unknown=await response.json();
  const fixed=(body as {outputs?:{monthly?:{fixed?:{month:number;E_d:number}[]}}})
    ?.outputs?.monthly?.fixed;
  if(!Array.isArray(fixed)||fixed.length!==12)throw new Error('PVGIS monthly results missing');
  const ordered=[...fixed].sort((a,b)=>a.month-b.month);
  if(!ordered.every((m,i)=>m.month===i+1&&Number.isFinite(m.E_d)&&m.E_d>=0))
    throw new Error('PVGIS monthly results invalid');
  const values=ordered.map(m=>m.E_d);
  cache.set(key,{expiry:Date.now()+12*3600*1000,values});
  return values;
 }
 return {name:'vandy-pvgis-monthly-development-api',configureServer(server){
  server.middlewares.use('/api/pvgis/monthly',async(req,res)=>{
   const request=new URL(req.url??'/', 'http://localhost');
   const mode=request.searchParams.get('mode')??'uk';
   const lat=Number(request.searchParams.get('lat'));
   const lon=Number(request.searchParams.get('lon'));
   const tilt=Number(request.searchParams.get('tilt')??'0');
   const loss=Number(request.searchParams.get('loss')??'14');
   const send=(status:number,obj:unknown)=>{
    res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(obj));
   };
   if(req.method!=='GET'||!['uk','point'].includes(mode)||!Number.isFinite(tilt)||tilt<0||tilt>90||
     !Number.isFinite(loss)||loss<0||loss>=100||
     (mode==='point'&&(!Number.isFinite(lat)||lat<40||lat>71||!Number.isFinite(lon)||lon< -12||lon>4)))
    return send(400,{error:'Invalid solar location or array assumptions'});
   try{
    const values=mode==='uk'
      ?(await Promise.all(points.map(([x,y])=>one(x,y,tilt,loss))))
      :[await one(lat,lon,tilt,loss)];
    const average=Array.from({length:12},(_,i)=>
       values.reduce((sum,m)=>sum+m[i],0)/values.length);
    send(200,{monthlyKWhPerKwDay:average,
      source:'European Commission JRC PVGIS 5.3 PVcalc, long-term monthly averages',
      locationName:mode==='uk'?'UK indicative mean (five unweighted regional reference points)':'Chosen GPS or UK region',
      sampleCount:values.length});
   }catch(e){
    send(502,{error:'PVGIS monthly solar data unavailable: '+(e instanceof Error?e.message:String(e))});
   }
  });
 }};
}
export default defineConfig({plugins:[react(),pvgisMonthly()],base:'./'});
