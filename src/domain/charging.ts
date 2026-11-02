/** Planned charging equipment only. No electrical connections or recharge yield inferred. */
export type SystemVoltage=12|24;
export type DeviceKind='dc2dc'|'mppt'|'shoreCharger'|'inverterCharger';
export type DeviceModel={
  id:string;name:string;manufacturer:'Victron'|'Renogy';kind:DeviceKind;
  outputVoltages:readonly SystemVoltage[];
  chargeAmps:number;sourceUrl:string;details:string;
  inputVoltage?:SystemVoltage;pvMaxVoc?:number;pvMaxIsc?:number;
  pvPower12?:number;pvPower24?:number;inverterVA?:number;
};
const orion='https://www.victronenergy.com/media/pg/Orion-Tr_Smart_DC-DC_Charger_-_Non-Isolated/en/specifications--non-isolated-.html';
const solar100='https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/technical-specifications.html';
const solar150='https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-35__150-45/en/technical-specifications.html';
const ip22='https://www.victronenergy.com/media/pg/Blue_Smart_IP22_Charger_230V_manual/en/technical-specifications---bsc---psc.html';
const multiplus='https://www.victronenergy.com/upload/documents/Manual-MultiPlus-500VA-1200VA-EN-NL-FR-DE-ES-IT.pdf';
export const deviceCatalogue:readonly DeviceModel[]=[
 {id:'orion-xs-12-12-50',name:'Orion XS 12/12-50',manufacturer:'Victron',kind:'dc2dc',
  inputVoltage:12,outputVoltages:[12],chargeAmps:50,sourceUrl:'https://www.victronenergy.com/media/pg/Orion_XS_12-12-50A_DC-DC_battery_charger/en/technical-data.html',
  details:'Input and output adjustable 1–50 A; 700 W continuous output at up to 40 °C. Source alternator capacity must be assessed separately.'},
 {id:'orion-tr-12-12-30',name:'Orion-Tr Smart 12/12-30',manufacturer:'Victron',kind:'dc2dc',
  inputVoltage:12,outputVoltages:[12],chargeAmps:30,sourceUrl:orion,details:'Non-isolated 12 V to 12 V, nominal 30 A.'},
 {id:'orion-tr-12-24-15',name:'Orion-Tr Smart 12/24-15',manufacturer:'Victron',kind:'dc2dc',
  inputVoltage:12,outputVoltages:[24],chargeAmps:15,sourceUrl:orion,details:'Non-isolated 12 V input, 24 V output, 15 A.'},
 {id:'orion-tr-24-24-17',name:'Orion-Tr Smart 24/24-17',manufacturer:'Victron',kind:'dc2dc',
  inputVoltage:24,outputVoltages:[24],chargeAmps:17,sourceUrl:orion,details:'Non-isolated 24 V to 24 V, 17 A.'},
 {id:'renogy-dc-12-12-40',name:'12V 40A DC–DC Charger',manufacturer:'Renogy',kind:'dc2dc',
  inputVoltage:12,outputVoltages:[12],chargeAmps:40,
  sourceUrl:'https://eu.renogy.com/products/12v-40a-dc-to-dc-battery-charger',
  details:'12 V alternator input, 12 V lithium output; 40 A max rated output.'},
 {id:'smartsolar-100-30',name:'SmartSolar MPPT 100/30',manufacturer:'Victron',kind:'mppt',
  outputVoltages:[12,24],chargeAmps:30,pvMaxVoc:100,pvMaxIsc:35,pvPower12:440,pvPower24:880,
  sourceUrl:solar100,details:'100 V PV open-circuit limit; 30 A max battery output. Nominal PV input 440 W at 12 V, 880 W at 24 V.'},
 {id:'smartsolar-100-50',name:'SmartSolar MPPT 100/50',manufacturer:'Victron',kind:'mppt',
  outputVoltages:[12,24],chargeAmps:50,pvMaxVoc:100,pvMaxIsc:60,pvPower12:700,pvPower24:1400,
  sourceUrl:solar100,details:'100 V PV open-circuit limit; 50 A max battery output. Nominal PV input 700 W at 12 V, 1400 W at 24 V.'},
 {id:'smartsolar-150-35',name:'SmartSolar MPPT 150/35',manufacturer:'Victron',kind:'mppt',
  outputVoltages:[12,24],chargeAmps:35,pvMaxVoc:150,pvMaxIsc:35,pvPower12:500,pvPower24:1000,
  sourceUrl:solar150,details:'150 V PV open-circuit limit; 35 A max battery output.'},
 {id:'smartsolar-150-45',name:'SmartSolar MPPT 150/45',manufacturer:'Victron',kind:'mppt',
  outputVoltages:[12,24],chargeAmps:45,pvMaxVoc:150,pvMaxIsc:45,pvPower12:650,pvPower24:1300,
  sourceUrl:solar150,details:'150 V PV open-circuit limit; 45 A max battery output.'},
 {id:'renogy-rover-40',name:'Rover Li 40A MPPT',manufacturer:'Renogy',kind:'mppt',
  outputVoltages:[12,24],chargeAmps:40,pvMaxVoc:100,pvPower12:520,pvPower24:1040,
  sourceUrl:'https://eu.renogy.com/products/rover-li-40-amp-mppt-solar-charge-controller',
  details:'100 V PV input limit, 40 A battery output. Check array short-circuit-current limit in its manual before wiring.'},
 {id:'ip22-12-30',name:'Blue Smart IP22 12/30 (230 V)',manufacturer:'Victron',kind:'shoreCharger',
  outputVoltages:[12],chargeAmps:30,sourceUrl:ip22,details:'230 V mains charger, nominal 12 V output at up to 30 A; no inverter.'},
 {id:'ip22-24-16',name:'Blue Smart IP22 24/16 (230 V)',manufacturer:'Victron',kind:'shoreCharger',
  outputVoltages:[24],chargeAmps:16,sourceUrl:ip22,details:'230 V mains charger, nominal 24 V output at up to 16 A; no inverter.'},
 {id:'multiplus-12-500-20',name:'MultiPlus 12/500/20 (230 V)',manufacturer:'Victron',kind:'inverterCharger',
  outputVoltages:[12],chargeAmps:20,inverterVA:500,sourceUrl:multiplus,details:'230 V AC inverter/charger, 500 VA inverter, 20 A battery charger.'},
 {id:'multiplus-12-800-35',name:'MultiPlus 12/800/35 (230 V)',manufacturer:'Victron',kind:'inverterCharger',
  outputVoltages:[12],chargeAmps:35,inverterVA:800,sourceUrl:multiplus,details:'230 V AC inverter/charger, 800 VA inverter, 35 A battery charger.'},
 {id:'multiplus-24-800-16',name:'MultiPlus 24/800/16 (230 V)',manufacturer:'Victron',kind:'inverterCharger',
  outputVoltages:[24],chargeAmps:16,inverterVA:800,sourceUrl:multiplus,details:'230 V AC inverter/charger, 800 VA inverter, 16 A battery charger.'},
 {id:'multiplus-24-1200-25',name:'MultiPlus 24/1200/25 (230 V)',manufacturer:'Victron',kind:'inverterCharger',
  outputVoltages:[24],chargeAmps:25,inverterVA:1200,sourceUrl:multiplus,details:'230 V AC inverter/charger, 1200 VA inverter, 25 A battery charger.'},
];
export const findModel=(id:string)=>deviceCatalogue.find(m=>m.id===id);
export type PlannedUnit={id:string;modelId:string};
export type SolarPanelPlan={
  watts:number|null;quantity:number;connection:'series'|'parallel';
  voc:number|null;isc:number|null;
};
export type ChargingPlan={
  spareAlternatorAmps:number|null;alternatorVoltage:SystemVoltage;
  dc2dc:PlannedUnit[];mppt:PlannedUnit[];
  panel:SolarPanelPlan;shoreModelId:string|null;
};
export const emptyCharging=():ChargingPlan=>({
  spareAlternatorAmps:30,alternatorVoltage:12,dc2dc:[],mppt:[],
  panel:{watts:null,quantity:1,connection:'parallel',voc:null,isc:null},
  shoreModelId:null,
});
export const plannedInverter=(c:ChargingPlan):DeviceModel|null=>{
  const m=c.shoreModelId?findModel(c.shoreModelId):null;
  return m?.kind==='inverterCharger'?m:null;
};
const safeNumber=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export function validCharging(c:unknown):c is ChargingPlan{
  if(!c||typeof c!=='object')return false;
  const q=c as ChargingPlan;
  if(!(q.alternatorVoltage===12||q.alternatorVoltage===24)||
    !(q.spareAlternatorAmps===null||safeNumber(q.spareAlternatorAmps))||
    !Array.isArray(q.dc2dc)||!Array.isArray(q.mppt))return false;
  const ids=new Set<string>();
  for(const [kind,arr] of [['dc2dc',q.dc2dc],['mppt',q.mppt]] as const){
    for(const u of arr){
      if(!u||typeof u.id!=='string'||!u.id||ids.has(u.id)||
         typeof u.modelId!=='string'||findModel(u.modelId)?.kind!==kind)return false;
      ids.add(u.id);
    }
  }
  const p=q.panel;
  if(!p||!(p.watts===null||safeNumber(p.watts))||
    !Number.isInteger(p.quantity)||p.quantity<1||p.quantity>1000||
    !['series','parallel'].includes(p.connection)||
    !(p.voc===null||safeNumber(p.voc))||
    !(p.isc===null||safeNumber(p.isc)))return false;
  return q.shoreModelId===null||
    (typeof q.shoreModelId==='string'&&['shoreCharger','inverterCharger'].includes(findModel(q.shoreModelId)?.kind??''));
}
export type ChargingWarning={area:'dc2dc'|'solar'|'shore';message:string};
export const panelArray=(p:SolarPanelPlan)=>({
  watts:p.watts===null?null:p.watts*p.quantity,
  voc:p.voc===null?null:p.voc*(p.connection==='series'?p.quantity:1),
  isc:p.isc===null?null:p.isc*(p.connection==='parallel'?p.quantity:1),
});
export function chargingWarnings(c:ChargingPlan,batteryVoltage:SystemVoltage|null):ChargingWarning[]{
  const out:ChargingWarning[]=[];
  const warn=(area:ChargingWarning['area'],message:string)=>out.push({area,message});
  if(c.dc2dc.length&&c.spareAlternatorAmps===null)
    warn('dc2dc','Enter estimated spare alternator amps before assessing DC–DC capacity.');
  const outputWatts=c.dc2dc.reduce((sum,u)=>{
    const m=findModel(u.modelId);
    return sum+(m?m.chargeAmps*m.outputVoltages[0]:0);
  },0);
  const inputBudget=c.spareAlternatorAmps===null?null:c.spareAlternatorAmps*c.alternatorVoltage;
  if(c.dc2dc.length&&inputBudget!==null&&outputWatts>inputBudget)
    warn('dc2dc','Combined DC–DC rated output exceeds your estimated spare alternator power, even before conversion losses. Charger input limiting and distribution must be designed later.');
  for(const u of c.dc2dc){
    const m=findModel(u.modelId);if(!m)continue;
    if(m.inputVoltage!==c.alternatorVoltage)
      warn('dc2dc',m.name+' expects '+m.inputVoltage+' V alternator input, not the planned '+c.alternatorVoltage+' V.');
    if(batteryVoltage!==null&&!m.outputVoltages.includes(batteryVoltage))
      warn('dc2dc',m.name+' outputs '+m.outputVoltages.join('/')+' V; the planned battery is '+batteryVoltage+' V.');
  }
  const array=panelArray(c.panel);
  if(c.mppt.length===0&&array.watts!==null&&array.watts>0)
    warn('solar','Solar panels are planned but no MPPT is selected.');
  if(c.mppt.length>1)
    warn('solar','Multiple MPPT controllers are planned. Panel/string allocation to individual controllers must be defined in the wiring stage; the total array is not assumed to feed each controller.');
  for(const u of c.mppt){
    const m=findModel(u.modelId);if(!m)continue;
    if(batteryVoltage!==null&&!m.outputVoltages.includes(batteryVoltage))
      warn('solar',m.name+' does not support the selected '+batteryVoltage+' V battery.');
    if(c.mppt.length===1){
      if(array.voc!==null&&m.pvMaxVoc!==undefined&&array.voc>=m.pvMaxVoc)
        warn('solar',m.name+' PV Voc limit is '+m.pvMaxVoc+' V; the entered array Voc is '+array.voc+' V before cold-weather adjustment.');
      if(array.isc!==null&&m.pvMaxIsc!==undefined&&array.isc>m.pvMaxIsc)
        warn('solar',m.name+' PV short-circuit-current limit is '+m.pvMaxIsc+' A; the entered array Isc is '+array.isc+' A.');
      const rating=batteryVoltage===24?m.pvPower24:m.pvPower12;
      if(batteryVoltage!==null&&rating!==undefined&&array.watts!==null&&array.watts>rating)
        warn('solar',m.name+' nominal PV power is '+rating+' W at '+batteryVoltage+' V; planned '+array.watts+' W may be clipped and requires review.');
    }
  }
  if(c.mppt.length>0&&(c.panel.voc===null||c.panel.isc===null))
    warn('solar','Enter panel Voc and Isc from its datasheet before validating MPPT PV limits. Cold-weather Voc is not calculated yet.');
  const shore=c.shoreModelId?findModel(c.shoreModelId):null;
  if(shore&&batteryVoltage!==null&&!shore.outputVoltages.includes(batteryVoltage))
    warn('shore',shore.name+' charges '+shore.outputVoltages.join('/')+' V batteries; the selected battery is '+batteryVoltage+' V.');
  return out;
}
