import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankPlanner,newLoad,importPlanner,isPlanner} from '../src/domain/loadPlanner.ts';
import {newPlannedUnit,chooseSolarPanel,validCharging} from '../src/domain/charging.ts';
import {solarPanels} from '../src/domain/solarPanels.ts';
import {emptyOffGrid,solarKey,matchingSolar,monthRating,projectedBattery,
  validOffGrid,REGIONS,MONTHS} from '../src/domain/offGrid.ts';
const load=(name,voltage,watts,hours)=>newLoad({
 name,voltage,watts,hours,category:'standard',basis:'Test',
});
const base=()=>{
 const p=blankPlanner();p.batteryId='mini-280';p.loads.push(load('Fridge',12,50,20));
 return p;
};
test('new off-grid plan defaults to 1h/day driving and honest PVGIS data',()=>{
 const p=blankPlanner();
 assert.equal(p.version,8);
 assert.ok(isPlanner(p));
 assert.equal(p.offGrid.driveHours,1);
 assert.equal(p.offGrid.dataset,null);
 assert.equal(p.offGrid.locationMode,'uk');
 assert.equal(MONTHS.length,12);
 assert.ok(REGIONS.length>=15);
 assert.ok(validOffGrid(p.offGrid));
});
test('panel catalogue only contains sourced ratings and the custom option is prefilled',()=>{
 assert.ok(solarPanels.some(p=>p.watts===400&&p.voc===39.42&&p.isc===13.06));
 const c=blankPlanner().charging;
 assert.equal(c.panel.modelId,'');
 assert.equal(c.panel.watts,null);
 c.panel=chooseSolarPanel(c.panel,'custom');
 assert.equal(c.panel.watts,400);
 assert.equal(c.panel.voc,40);
 assert.equal(c.panel.isc,13);
 assert.equal(c.panel.quantity,1);
 assert.ok(validCharging(c));
 c.panel=chooseSolarPanel(c.panel,'renogy-100-bifacial');
 assert.equal(c.panel.watts,100);
 assert.equal(c.panel.vmp,23.6);
});
test('PVGIS monthly source keys invalidate when location or tilt changes',()=>{
 const o=emptyOffGrid();
 const key=solarKey(o);
 o.dataset={key,monthlyKWhPerKwDay:Array(12).fill(2),fetchedAt:'2026-11-02T00:00:00Z',
   source:'PVGIS 5.3',locationName:'five-site UK'};
 assert.ok(matchingSolar(o));
 o.tiltDeg=15;
 assert.equal(matchingSolar(o),null);
 o.tiltDeg=0;
 o.regionId='london';
 assert.ok(matchingSolar(o),'UK average does not depend on region choice');
 o.locationMode='region';
 assert.equal(matchingSolar(o),null);
});
test('inverter and step-down efficiencies increase battery-side load in a 24 V plan',()=>{
 const p=base();p.batteryId='ultra-314-24';
 p.loads.push(load('Laptop',230,100,2));
 p.offGrid.genericInverterEfficiency=.8;
 p.offGrid.dcConverterEfficiency=.9;
 assert.equal(monthRating(p,0)?.demandWh,1000/.9+200/.8);
});
test('stationary battery depletion vs energy-balanced days with solar',()=>{
 const p=base();
 let r=monthRating(p,0);
 assert.ok(r);
 assert.equal(r.demandWh,1000);
 assert.equal(r.solarWh,0);
 assert.equal(r.stationaryDays,3584*.9/1000);
 p.charging.panel=chooseSolarPanel(p.charging.panel,'custom');
 p.charging.mppt=[newPlannedUnit('smartsolar-100-50','solar1')];
 const key=solarKey(p.offGrid);
 p.offGrid.dataset={key,monthlyKWhPerKwDay:Array(12).fill(2),
  fetchedAt:'2026-11-02T00:00:00Z',source:'PVGIS',locationName:'test'};
 r=monthRating(p,0);
 assert.equal(r.solarWh,800);
 assert.equal(r.stationaryDays,3584*.9/200);
 p.offGrid.dataset.monthlyKWhPerKwDay[1]=3;
 assert.equal(monthRating(p,1).stationaryBalanced,true);
 assert.equal(monthRating(p,1).stationaryDays,null,'balanced is not infinite autonomy');
});
test('drive energy depends on configured Orion input and shared alternator allowance',()=>{
 const p=base();
 p.charging.dc2dc=[newPlannedUnit('orion-xs-12-12-50','a')];
 let r=monthRating(p,0);
 assert.ok(r.drivingWh>0);
 assert.ok(r.drivingWh<30*13.8,'efficiency reduces input power');
 p.offGrid.driveHours=0;assert.equal(monthRating(p,0).drivingWh,0);
 p.offGrid.driveHours=2;assert.ok(monthRating(p,0).drivingWh>r.drivingWh);
 p.charging.dc2dc.push(newPlannedUnit('orion-xs-12-12-50','b'));
 assert.ok(monthRating(p,0).drivingWh<=30*13.8*.94*2,'shared input cap');
});
test('no battery or incomplete loads return no off-grid rating',()=>{
 const p=blankPlanner();
 assert.equal(monthRating(p,1),null);
 p.batteryId='mini-280';
 assert.equal(monthRating(p,1),null,'zero demand is not an infinite rating');
 const l=load('Missing',12,10,1);l.rating=null;p.loads.push(l);
 assert.equal(monthRating(p,1),null);
});
test('projected battery trajectory is bounded by available battery capacity',()=>{
 const p=base();
 const t=projectedBattery(p,0,14);
 assert.equal(t.length,15);
 assert.ok(t[14].wh>=0);
 assert.ok(t[14].percentage<=100);
 assert.ok(t[0].percentage<=90.00000001);
});
test('v5 migration retains existing selected equipment and settings',()=>{
 const p=base();
 p.charging.dc2dc=[{id:'a',modelId:'orion-xs-12-12-50'}];
 p.charging.panel=chooseSolarPanel(p.charging.panel,'custom');
 const v5={version:5,batteryId:p.batteryId,circuits:p.circuits,loads:p.loads,
 charging:{spareAlternatorAmps:30,alternatorVoltage:12,dc2dc:p.charging.dc2dc,
 mppt:[],panel:{watts:400,quantity:1,connection:'series',voc:40,isc:13},shoreModelId:null}};
 const upgraded=importPlanner(v5);
 assert.ok(upgraded&&isPlanner(upgraded));
 assert.equal(upgraded.version,8);
 assert.equal(upgraded.charging.panel.watts,400);
 assert.deepEqual(upgraded.distribution.nodes,[]);
 assert.equal(upgraded.charging.panel.connection,'series');
 assert.equal(upgraded.charging.dc2dc[0].modelId,'orion-xs-12-12-50');
 assert.ok(validOffGrid(upgraded.offGrid));
});
