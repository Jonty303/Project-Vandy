import {plannerTotal,loadEnergy,selectedBattery,type Planner} from './loadPlanner.ts';
import {findModel,panelArray,plannedInverter} from './charging.ts';

export const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'] as const;
export const REGIONS=[
 {id:'leeds',name:'Leeds / West Yorkshire',lat:53.8008,lon:-1.5491},
 {id:'manchester',name:'Manchester / North West',lat:53.4808,lon:-2.2426},
 {id:'york',name:'York / North Yorkshire',lat:53.959,lon:-1.082},
 {id:'newcastle',name:'Newcastle / North East',lat:54.978,lon:-1.618},
 {id:'sheffield',name:'Sheffield / South Yorkshire',lat:53.381,lon:-1.47},
 {id:'nottingham',name:'Nottingham / East Midlands',lat:52.954,lon:-1.158},
 {id:'birmingham',name:'Birmingham / West Midlands',lat:52.486,lon:-1.89},
 {id:'norwich',name:'Norwich / East Anglia',lat:52.63,lon:1.298},
 {id:'bristol',name:'Bristol / South West',lat:51.454,lon:-2.588},
 {id:'exeter',name:'Exeter / Devon',lat:50.726,lon:-3.527},
 {id:'london',name:'London / South East',lat:51.507,lon:-0.128},
 {id:'brighton',name:'Brighton / Sussex',lat:50.822,lon:-0.138},
 {id:'cardiff',name:'Cardiff / South Wales',lat:51.481,lon:-3.179},
 {id:'aberystwyth',name:'Aberystwyth / Mid Wales',lat:52.414,lon:-4.082},
 {id:'bangor',name:'Bangor / North Wales',lat:53.228,lon:-4.128},
 {id:'edinburgh',name:'Edinburgh / Lothian',lat:55.953,lon:-3.189},
 {id:'glasgow',name:'Glasgow / West Scotland',lat:55.864,lon:-4.252},
 {id:'inverness',name:'Inverness / Highlands',lat:57.478,lon:-4.224},
 {id:'aberdeen',name:'Aberdeen / North East Scotland',lat:57.149,lon:-2.095},
 {id:'belfast',name:'Belfast / Northern Ireland',lat:54.598,lon:-5.93},
 {id:'derry',name:'Derry / Northern Ireland',lat:54.997,lon:-7.31},
] as const;
export type SolarDataset={key:string;monthlyKWhPerKwDay:number[];fetchedAt:string;source:string;locationName:string};
export type OffGridPlan={
 driveHours:number;month:number;locationMode:'uk'|'region'|'gps';regionId:string;
 gpsLat:number|null;gpsLon:number|null;tiltDeg:number;solarLossPct:number;
 genericInverterEfficiency:number;dcConverterEfficiency:number;dataset:SolarDataset|null;
};
export const emptyOffGrid=():OffGridPlan=>({
 driveHours:1,month:new Date().getUTCMonth(),locationMode:'uk',regionId:'leeds',
 gpsLat:null,gpsLon:null,tiltDeg:0,solarLossPct:14,
 genericInverterEfficiency:0.88,dcConverterEfficiency:0.92,dataset:null,
});
const valid=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export function validOffGrid(o:unknown):o is OffGridPlan{
 if(!o||typeof o!=='object')return false;
 const p=o as OffGridPlan;
 if(!valid(p.driveHours)||p.driveHours<0||p.driveHours>24||
   !Number.isInteger(p.month)||p.month<0||p.month>11||
   !['uk','region','gps'].includes(p.locationMode)||!REGIONS.some(r=>r.id===p.regionId)||
   !(p.gpsLat===null||(valid(p.gpsLat)&&p.gpsLat>=-90&&p.gpsLat<=90))||
   !(p.gpsLon===null||(valid(p.gpsLon)&&p.gpsLon>=-180&&p.gpsLon<=180))||
   !valid(p.tiltDeg)||p.tiltDeg<0||p.tiltDeg>90||
   !valid(p.solarLossPct)||p.solarLossPct<0||p.solarLossPct>=100||
   !valid(p.genericInverterEfficiency)||p.genericInverterEfficiency<=0||p.genericInverterEfficiency>1||
   !valid(p.dcConverterEfficiency)||p.dcConverterEfficiency<=0||p.dcConverterEfficiency>1)return false;
 if(p.dataset!==null){
   const d=p.dataset;
   if(typeof d.key!=='string'||typeof d.fetchedAt!=='string'||typeof d.source!=='string'||
     typeof d.locationName!=='string'||!Array.isArray(d.monthlyKWhPerKwDay)||
     d.monthlyKWhPerKwDay.length!==12||!d.monthlyKWhPerKwDay.every(v=>valid(v)&&v>=0))return false;
 }
 return true;
}
export const solarKey=(p:OffGridPlan)=>{
 const loc=p.locationMode==='gps'?String(p.gpsLat)+','+String(p.gpsLon):
   p.locationMode==='region'?p.regionId:'five-uk-reference-sites';
 return p.locationMode+':'+loc+':'+p.tiltDeg+':'+p.solarLossPct;
};
export const matchingSolar=(p:OffGridPlan)=>p.dataset?.key===solarKey(p)?p.dataset:null;
export type MonthlyRating={
 month:number;demandWh:number;solarWh:number|null;drivingWh:number;
 netStationaryWh:number|null;netDrivingWh:number|null;
 stationaryDays:number|null;drivingDays:number|null;
 stationaryBalanced:boolean;drivingBalanced:boolean;
};
export function dcChargePower(p:Planner){
 const c=p.charging,b=selectedBattery(p);
 if(!b||c.spareAlternatorAmps===null||!c.dc2dc.length)return 0;
 const alternatorV=c.alternatorVoltage===12?13.8:27.6;
 const bankV=b.systemVoltage===12?14.4:28.8;
 const limitW=c.spareAlternatorAmps*alternatorV*.94;
 const individualW=c.dc2dc.reduce((sum,u)=>{
   const m=findModel(u.modelId);
   if(!m||m.inputVoltage!==c.alternatorVoltage||!m.outputVoltages.includes(b.systemVoltage))return sum;
   const outputW=(m.outputLimitAdjustable?(u.outputLimitA??m.chargeAmps):m.chargeAmps)*bankV;
   const inputW=m.inputLimitAdjustable?(u.inputLimitA??m.chargeAmps)*alternatorV*.94:outputW;
   return sum+Math.min(outputW,inputW);
 },0);
 return Math.min(limitW,individualW);
}
export function dcDemandWh(p:Planner){
 const b=selectedBattery(p);
 if(!b)return null;
 const inv=plannedInverter(p.charging);
 const efficiency=inv?.inverterEfficiency??p.offGrid.genericInverterEfficiency;
 return p.loads.reduce((total,l)=>{
   const wh=loadEnergy(l).wh;
   if(wh===null)return total;
   if(l.voltage===230)return total+wh/efficiency;
   if(l.voltage!==b.systemVoltage)return total+wh/p.offGrid.dcConverterEfficiency;
   return total+wh;
 },0);
}
export const solarArrayWh=(p:Planner,month:number):number|null=>{
 const watts=panelArray(p.charging.panel).watts;
 if(watts===null||watts<=0)return 0;
 if(!p.charging.mppt.length)return 0;
 const data=matchingSolar(p.offGrid);
 if(!data)return null;
 const b=selectedBattery(p);
 if(!b)return null;
 const nominalCap=p.charging.mppt.reduce((sum,u)=>{
   const m=findModel(u.modelId);if(!m||!m.outputVoltages.includes(b.systemVoltage))return sum;
   return sum+(b.systemVoltage===24?m.pvPower24??0:m.pvPower12??0);
 },0);
 const factor=nominalCap>0?Math.min(1,nominalCap/watts):0;
 return data.monthlyKWhPerKwDay[month]*watts*factor;
};
export function monthRating(p:Planner,month:number):MonthlyRating|null{
 const b=selectedBattery(p);
 if(!b||month<0||month>11||!Number.isInteger(month)||plannerTotal(p).missing>0)return null;
 const demand=dcDemandWh(p);
 if(demand===null||demand<=0)return null;
 const solar=solarArrayWh(p,month);
 const driving=dcChargePower(p)*p.offGrid.driveHours;
 const usable=b.energyWh*.9;
 const netStationary=solar===null?null:demand-solar;
 const netDriving=netStationary===null?null:netStationary-driving;
 const days=(net:number|null)=>net===null||net<=0?null:usable/net;
 return {month,demandWh:demand,solarWh:solar,drivingWh:driving,
   netStationaryWh:netStationary,netDrivingWh:netDriving,
   stationaryDays:days(netStationary),drivingDays:days(netDriving),
   stationaryBalanced:netStationary!==null&&netStationary<=0,
   drivingBalanced:netDriving!==null&&netDriving<=0};
}
export const allMonthRatings=(p:Planner)=>MONTHS.map((_,i)=>monthRating(p,i));
export const projectedBattery=(p:Planner,month:number,days=14,withDriving=true)=>{
 const rating=monthRating(p,month);const b=selectedBattery(p);
 if(!rating||!b)return [];
 const usable=b.energyWh*.9;
 const net=withDriving?rating.netDrivingWh:rating.netStationaryWh;
 if(net===null)return [];
 return Array.from({length:days+1},(_,day)=>({
   day,wh:Math.max(0,Math.min(usable,usable-net*day)),
   percentage:100*Math.max(0,Math.min(usable,usable-net*day))/b.energyWh,
 }));
};
