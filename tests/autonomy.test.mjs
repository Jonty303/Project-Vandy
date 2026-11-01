import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProject } from '../src/data/vandy.ts';
import { dcDcEstimate, autonomySettings, estimateSolarWh, projectAutonomy, solarFingerprint } from '../src/domain/autonomy.ts';
import { resolveLogicalSupply } from '../src/domain/supply.ts';
import { validateProject } from '../src/domain/storage.ts';

const make=()=>structuredClone(seedProject);
test('Vandy sample AC load derives MultiPlus as source via socket consumer unit',()=>{
 const p=make(),starlink=p.loads.find(l=>l.id==='starlink');
 const source=resolveLogicalSupply(p,starlink);
 assert.equal(source.origin,'inverter');
 assert.deepEqual(source.path.slice(0,2),['multiplus','cu-sockets']);
 assert.equal(source.confidence,'proposed');
});
test('removing CU to inverter link leaves AC supply unresolved rather than inventing source',()=>{
 const p=make();p.topologyLinks=p.topologyLinks.filter(l=>l.id!=='multiplus-to-cu');
 const source=resolveLogicalSupply(p,p.loads.find(l=>l.id==='starlink'));
 assert.equal(source.origin,'unresolved');
 assert.ok(source.issues.some(i=>i.includes('No valid logical path')));
});
test('DC-DC estimate constrains alternator spare amps and configured Orion input and output',()=>{
 const p=make(),settings=autonomySettings(p);
 settings.hoursDrivingPerDay=2;settings.availableAlternatorA=30;
 settings.dcDcInputCurrentLimitA=40;settings.dcDcOutputCurrentLimitA=50;
 settings.dcDcEfficiency=0.95;settings.dcDcActiveFraction=1;
 const result=dcDcEstimate(settings,12);
 assert.ok(Math.abs(result.outputW-(30*13.8*.95))<.00001);
 assert.ok(Math.abs(result.wh-result.outputW*2)<.00001);
 settings.availableAlternatorA=100;settings.dcDcInputCurrentLimitA=50;settings.dcDcOutputCurrentLimitA=15;
 const output=dcDcEstimate(settings,12);
 assert.equal(output.outputW,15*settings.dcDcOutputVoltageV);
});
test('Unknown spare alternator amps yields unknown recharge when driving',()=>{
 const settings=autonomySettings(make());settings.hoursDrivingPerDay=3;settings.availableAlternatorA=null;
 assert.equal(dcDcEstimate(settings,12).wh,null);
 settings.hoursDrivingPerDay=0;
 assert.equal(dcDcEstimate(settings,12).wh,0);
});
test('The installed 12/12 Orion is not treated as a 24V charger',()=>{
 const settings=autonomySettings(make());settings.hoursDrivingPerDay=1;settings.availableAlternatorA=35;
 assert.equal(dcDcEstimate(settings,24).wh,null);
});
test('Solar forecast requires matching PVGIS input fingerprint or user-entered estimate',()=>{
 const p=make(),s=autonomySettings(p);
 assert.equal(estimateSolarWh(s).wh,null);
 s.solarClimatology={source:'PVGIS-v5_3',requestedAt:'2026-11-01T00:00:00Z',description:'test',
   monthlyDailyWh:Array.from({length:12},()=>500),queryFingerprint:solarFingerprint(s)};
 s.solarMonth=11;
 assert.equal(estimateSolarWh(s).wh,500);
 s.solarPanelWatts=600;
 assert.equal(estimateSolarWh(s).wh,null);
 s.solarManualWhPerDay=350;
 assert.equal(estimateSolarWh(s).wh,350);
});
test('Battery autonomy shows stationary vs daily driving without shore contribution',()=>{
 const p=make();p.batteryCapacityAh=280;p.acOperatingMode='shore';
 p.autonomy={...autonomySettings(p),solarManualWhPerDay:150,hoursDrivingPerDay:2,availableAlternatorA:30,dcDcActiveFraction:1};
 const projected=projectAutonomy(p,'working');
 const offgrid=projectAutonomy({...p,acOperatingMode:'inverter'},'working');
 assert.equal(projected.dailyDemandWh,offgrid.dailyDemandWh);
 assert.ok(projected.drivingWh>0);
 assert.ok(projected.drivingNetWh<projected.stationaryNetWh);
 assert.ok(projected.incomplete); // Unspecified Starlink etc must remain flagged.
});
test('A positive average daily surplus never receives a fabricated finite days value',()=>{
 const p=make();p.autonomy={...autonomySettings(p),solarManualWhPerDay:100000,hoursDrivingPerDay:0};
 const projection=projectAutonomy(p,'normal');
 assert.equal(projection.stationaryStatus,'no-average-depletion');
 assert.equal(projection.stationaryDays,null);
 assert.ok(projection.incomplete);
});

test('A shore-only consumer must not inherit a path via MultiPlus inverter output',()=>{
 const p=make();
 const circuit=p.circuits.find(c=>c.id==='ac-sockets');
 circuit.supply='ac-shore';
 const source=resolveLogicalSupply(p,p.loads.find(l=>l.id==='laptop-shared'));
 assert.equal(source.origin,'unresolved');
 assert.ok(source.issues.some(x=>x.includes('shore-only')));
});
test('v2 JSON validation accepts good autonomy and rejects malformed PVGIS cache',()=>{
 const p=make();
 p.autonomy={...autonomySettings(p),solarManualWhPerDay:350};
 assert.equal(validateProject(p),true);
 p.autonomy.solarClimatology={source:'PVGIS-v5_3',requestedAt:'2026-11-01',description:'Test',queryFingerprint:'x',monthlyDailyWh:[100,200]};
 assert.equal(validateProject(p),false);
 p.autonomy.solarClimatology=undefined;
 p.autonomy.dcDcEfficiency=1.3;
 assert.equal(validateProject(p),false);
});

test('Rating explicitly identifies every active unknown consumer rating and where to fix it',()=>{
 const p=make();
 const a=projectAutonomy(p,'working');
 assert.ok(a.ratingBlockers.some(r=>r.title.includes('Starlink') && r.action.includes('Circuits & loads')));
 assert.ok(a.ratingBlockers.some(r=>r.title.includes('Toilet flush')));
 assert.ok(a.ratingBlockers.some(r=>r.title.includes('Floor LED strips')));
 assert.ok(a.ratingBlockers.some(r=>r.id==='solar-missing'));
 assert.equal(a.ratingBlockers.some(r=>r.id==='battery-capacity'),false);
 assert.equal(a.solarMonthName,'June');
 assert.ok(a.provisionalReasons.some(r=>r.id==='fridge-duty'));
});
test('Solar PVGIS or manual estimate removes only solar blocker; still lists incomplete consumers',()=>{
 const p=make();p.autonomy={...autonomySettings(p),solarManualWhPerDay:250};
 const a=projectAutonomy(p,'normal');
 assert.equal(a.ratingBlockers.some(r=>r.id==='solar-missing'),false);
 assert.ok(a.ratingBlockers.some(r=>r.category==='consumer'));
 assert.ok(a.provisionalReasons.some(r=>r.id==='solar-method'&&r.title.includes('user-entered')));
});
test('Missing DC-DC spare amps only blocks driving scenario, never stationary',()=>{
 const p=make();
 p.autonomy={...autonomySettings(p),solarManualWhPerDay:300,hoursDrivingPerDay:3,availableAlternatorA:null};
 const a=projectAutonomy(p,'normal');
 assert.equal(a.drivingWh,null);
 assert.ok(a.drivingBlockers.some(r=>r.title.includes('Spare alternator current')));
 assert.equal(a.ratingBlockers.some(r=>r.category==='driving'),false);
});
test('Autonomy rating allows a complete set of active power inputs but retains explicit assumptions',()=>{
 const p=make();
 for(const load of p.loads) {
   if(load.kind==='led-strip'){
     load.led.lengthMetres=2;
     load.led.wattsPerMetre=9.6;
   }
   for(const mode of load.modes){
     if(mode.watts===null){mode.watts=8;mode.evidence='measured';}
   }
 }
 p.autonomy={...autonomySettings(p),solarManualWhPerDay:500};
 const a=projectAutonomy(p,'normal');
 assert.deepEqual(a.ratingBlockers,[]);
 assert.ok(a.provisionalReasons.some(r=>r.id==='nominal-battery'));
 assert.ok(a.provisionalReasons.some(r=>r.id==='fridge-duty'));
});
test('Zero-duty unknown consumer is not considered an active missing wattage',()=>{
 const p=make();
 const load=p.loads.find(l=>l.id==='starlink');
 load.modes[0].watts=null;
 load.modes[0].usage.normal.dutyFraction=0;
 const a=projectAutonomy(p,'normal');
 assert.equal(a.ratingBlockers.some(r=>r.title.includes('Starlink')),false);
});
test('Unknown or zero capacity of the ACTIVE BATTERY BANK creates a specific rating blocker',()=>{
 const p=make();p.batteryCapacityAh=999; // legacy scalar must not override the active battery bank
 p.batteries[0].capacityAh=null;
 let a=projectAutonomy(p,'working');
 assert.ok(a.ratingBlockers.some(r=>r.id==='battery-capacity'));
 p.batteries[0].capacityAh=0;
 a=projectAutonomy(p,'working');
 assert.ok(a.ratingBlockers.some(r=>r.id==='battery-capacity'));
});
