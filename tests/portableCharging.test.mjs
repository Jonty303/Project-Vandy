import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProject } from '../src/data/vandy.ts';
import { calculateProject } from '../src/domain/calculations.ts';
import { portableChargeEnergy, portableChargingIssues, vandyPortableCharging } from '../src/domain/portableCharging.ts';
import { migrateProject, validateProject } from '../src/domain/storage.ts';

const demo=()=>structuredClone(seedProject);
test('Vandy has two iPhones and one iPad with transparent model capacity assumptions',()=>{
 const p=demo();assert.equal(p.portableCharges.length,3);
 assert.deepEqual(p.portableCharges.map(x=>x.category),['iphone','iphone','ipad']);
 assert.ok(p.portableCharges.every(x=>x.rechargeFraction===.8&&x.chargingEfficiency===.85));
 assert.equal(p.portableCharges[2].batteryWh,28.93);
 assert.ok(p.portableCharges.every(x=>x.circuitId==='usb-charging'));
 assert.ok(p.loads.filter(x=>['usb-1','usb-2'].includes(x.id)).every(x=>Object.values(x.modes[0].usage).every(u=>u.minutesPerDay===0)));
 assert.equal(validateProject(p),true);
});
test('0 to 80% charge counts battery Wh replenishment and charger losses, not rated charger W',()=>{
 const p=demo(), d=p.portableCharges[0];
 const result=portableChargeEnergy(d,p,'normal');
 assert.equal(result.deviceWh,15.5*.8);
 assert.ok(Math.abs(result.supplyWh-15.5*.8/.85)<1e-10);
 assert.equal(result.peakWatts,null);
 assert.ok(Math.abs(result.batteryWh-result.supplyWh)<1e-10);
});
test('2 phones and 1 tablet each charged 80% once/day cost about 56Wh total',()=>{
 const p=demo();
 const sum=p.portableCharges.reduce((n,d)=>n+portableChargeEnergy(d,p,'normal').batteryWh,0);
 assert.ok(Math.abs(sum-(2*15.5+28.93)*.8/.85)<1e-8);
 assert.ok(sum>55&&sum<60);
});
test('Per-device charge events vary by usage profile, including fractional and zero charges',()=>{
 const p=demo(),d=p.portableCharges[0];
 d.chargesPerDay={normal:0,working:1.5,winter:.25};
 assert.equal(portableChargeEnergy(d,p,'normal').batteryWh,0);
 assert.ok(Math.abs(portableChargeEnergy(d,p,'working').batteryWh-(15.5*.8*1.5/.85))<1e-8);
 assert.ok(Math.abs(portableChargeEnergy(d,p,'winter').batteryWh-(15.5*.8*.25/.85))<1e-8);
});
test('Generic circuit totals, dashboard and off-grid share device charging, without inventing peak watts',()=>{
 const p=demo();const before=calculateProject({...p,portableCharges:[]},'normal'),withPhones=calculateProject(p,'normal');
 const want=(2*15.5+28.93)*.8/.85;
 assert.ok(Math.abs((withPhones.batteryWh-before.batteryWh)-want)<1e-8);
 assert.equal(withPhones.worstCaseConnectedWatts,before.worstCaseConnectedWatts);
 const usb=withPhones.circuitResults.find(x=>x.circuitId==='usb-charging');
 assert.ok(Math.abs(usb.batteryWh-want)<1e-8);
 assert.equal(usb.loads.filter(x=>x.loadId.startsWith('portable:')).length,3);
});
test('Using 230V inverter backed USB chargers applies inverter conversion only once',()=>{
 const p=demo(),d=p.portableCharges[0];
 d.circuitId='ac-sockets';p.acOperatingMode='inverter';p.inverterEfficiency=.9;
 const on=portableChargeEnergy(d,p,'normal');
 assert.ok(Math.abs(on.batteryWh-on.supplyWh/.9)<1e-10);
 p.acOperatingMode='shore';
 assert.equal(portableChargeEnergy(d,p,'normal').batteryWh,0);
 assert.ok(portableChargeEnergy(d,p,'normal').supplyWh>0);
});
test('Unknown positive device battery capacity with active charging flags partial instead of zero-energy claim',()=>{
 const p=demo(),d=p.portableCharges[0];d.batteryWh=null;
 const result=portableChargeEnergy(d,p,'normal');
 assert.equal(result.incomplete,true);
 assert.ok(result.issues.some(x=>x.includes('unknown')));
 assert.ok(calculateProject(p,'normal').incompleteLoads.includes(d.name));
 assert.equal(portableChargingIssues(p).length,0);
 assert.equal(validateProject(p),true);
});
test('Missing device battery capacity is not a blocker if no charging event is planned',()=>{
 const p=demo(),d=p.portableCharges[0];d.batteryWh=null;d.chargesPerDay.normal=0;
 const result=portableChargeEnergy(d,p,'normal');
 assert.equal(result.incomplete,false);assert.equal(result.batteryWh,0);
});
test('Invalid charging fractions, events, source circuits are clear actionable errors',()=>{
 const p=demo(),d=p.portableCharges[0];d.chargingEfficiency=0;d.chargesPerDay.normal=-1;
 assert.ok(portableChargingIssues(p).some(x=>x.includes('efficiency')));
 assert.ok(portableChargingIssues(p).some(x=>x.includes('daily charge')));
 d.circuitId='missing';
 assert.ok(portableChargingIssues(p).some(x=>x.includes('source circuit')));
});
test('Existing v3 projects get charge records only if factory USB usage can be retired, and no custom settings are overwritten',()=>{
 const legacy=demo();delete legacy.portableCharges;
 const migrated=migrateProject(legacy);
 assert.equal(migrated.portableCharges.length,3);
 assert.equal(migrated.loads.find(l=>l.id==='usb-1').modes[0].usage.working.minutesPerDay,0);
 const custom=demo();delete custom.portableCharges;
 custom.loads.find(l=>l.id==='usb-1').modes[0].usage.working.minutesPerDay=213;
 const migratedCustom=migrateProject(custom);
 assert.equal(migratedCustom.portableCharges.length,0);
 assert.equal(migratedCustom.loads.find(l=>l.id==='usb-1').modes[0].usage.working.minutesPerDay,213);
});
test('Edited charges survive JSON serialization and reimport without being re-seeded',()=>{
 const p=demo();p.portableCharges[0].chargesPerDay.normal=2.5;
 p.portableCharges[1].batteryWh=18.7;
 const imported=migrateProject(JSON.parse(JSON.stringify(p)));
 assert.equal(imported.portableCharges.length,3);
 assert.equal(imported.portableCharges[0].chargesPerDay.normal,2.5);
 assert.equal(imported.portableCharges[1].batteryWh,18.7);
});
