import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProject } from '../src/data/vandy.ts';
import { dcDcEstimate, autonomySettings, estimateSolarWh, projectAutonomy, solarFingerprint } from '../src/domain/autonomy.ts';
import { resolveLogicalSupply } from '../src/domain/supply.ts';

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
