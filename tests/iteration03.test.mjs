import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProject } from '../src/data/vandy.ts';
import { newBattery, validateBattery, summarizeBank, activeBankSummary, batteryCapacityForPlanning } from '../src/domain/batteries.ts';
import { vandyCommunicationPorts, recommendConnections, connectionDiagnostics } from '../src/domain/connectivity.ts';
import { validateProject, migrateProject } from '../src/domain/storage.ts';
import { projectAutonomy, autonomySettings } from '../src/domain/autonomy.ts';

const seed=()=>structuredClone(seedProject);
test('Iteration 03 seed retains existing electrical design and gains a single real-world battery-bank placeholder',()=>{
 const p=seed();
 assert.equal(p.schemaVersion,3);
 assert.equal(p.batteries.length,1);
 assert.equal(p.batteries[0].capacityAh,280);
 assert.equal(p.batteries[0].bms.bluetooth,'yes');
 assert.equal(p.batteries[0].bms.externalManagement,'unverified');
 assert.equal(p.batteries[0].thermal.selfHeating,'unknown');
 assert.equal(p.batteryBanks[0].strings[0][0],p.batteries[0].id);
 assert.equal(activeBankSummary(p).nominalWh,12*280);
 assert.ok(validateProject(p));
 assert.ok(p.topologyLinks.length>=6);
});
test('v2 migration preserves custom project edits while seeding separate battery and communications data',()=>{
 const old=seed();old.schemaVersion=2;
 delete old.batteries;delete old.batteryBanks;delete old.activeBatteryBankId;
 delete old.communicationPorts;delete old.communicationConnections;delete old.monitoringAuthorities;
 delete old.auxiliaryAssignments;delete old.diagramPositions;
 old.batteryCapacityAh=245;old.loads.find(l=>l.id==='fridge').name='My own fridge';
 old.profiles[0].name='Custom use profile';
 const upgraded=migrateProject(old);
 assert.ok(upgraded);
 assert.equal(upgraded.schemaVersion,3);
 assert.ok(validateProject(upgraded));
 assert.equal(upgraded.batteries[0].capacityAh,245);
 assert.equal(upgraded.loads.find(l=>l.id==='fridge').name,'My own fridge');
 assert.equal(upgraded.profiles[0].name,'Custom use profile');
 assert.equal(upgraded.communicationConnections.length,0);
});
test('Series and parallel banks derive nominal volts and Ah separately',()=>{
 const p=seed();
 p.batteries=[];
 for(let i=0;i<4;i++){
  const b=newBattery('b'+i);b.name='Battery '+i;b.capacityAh=100;b.nominalVoltageV=12;
  p.batteries.push(b);
 }
 p.batteryBanks=[{id:'bank',name:'2S2P',strings:[['b0','b1'],['b2','b3']],notes:''}];p.activeBatteryBankId='bank';
 const r=activeBankSummary(p);
 assert.equal(r.nominalVoltageV,24);
 assert.equal(r.capacityAh,200);
 assert.equal(r.nominalWh,4800);
 assert.equal(r.diagnostics.filter(x=>x.level==='blocker').length,0);
});
test('Unknown battery capacity is incomplete, not invalid; bank total remains unknown',()=>{
 const p=seed();
 p.batteries[0].capacityAh=null;
 assert.equal(validateBattery(p.batteries[0]).some(d=>d.level==='blocker'),false);
 assert.ok(validateBattery(p.batteries[0]).some(d=>d.field==='capacityAh'&&d.level==='incomplete'));
 assert.ok(validateProject(p));
 assert.equal(batteryCapacityForPlanning(p),null);
});
test('Duplicate bank membership blocks save, while different string voltages are explicitly diagnosed',()=>{
 const p=seed();p.batteryBanks[0].strings=[['battery-wattcycle'],['battery-wattcycle']];
 assert.ok(summarizeBank(p,p.batteryBanks[0]).diagnostics.some(d=>d.level==='blocker'&&d.message.includes('more than once')));
 const another=newBattery('b2');another.nominalVoltageV=24;another.capacityAh=100;
 p.batteries.push(another);
 p.batteryBanks[0].strings=[['battery-wattcycle'],['b2']];
 assert.ok(summarizeBank(p,p.batteryBanks[0]).diagnostics.some(d=>d.message.includes('matching nominal voltages')));
});
test('Self-heating input requires consistent temperature settings but unknown remains allowable',()=>{
 const b=newBattery('b');
 b.thermal.selfHeating='yes';b.thermal.onC=8;b.thermal.offC=3;
 assert.ok(validateBattery(b).some(x=>x.level==='blocker'&&x.field==='thermal.offC'));
 b.thermal.offC=12;
 assert.equal(validateBattery(b).some(x=>x.level==='blocker'),false);
 assert.ok(validateBattery(b).some(x=>x.field==='thermal.heaterWatts'));
});
test('Victron port recommendations do not invent Bluetooth BMS-to-Cerbo integration',()=>{
 const p=seed(),recommendations=recommendConnections(p);
 assert.ok(vandyCommunicationPorts.filter(x=>x.componentId==='cerbo'&&x.protocol==='ve-direct').length===3);
 assert.equal(recommendations.filter(r=>r.verdict==='recommended').length,4);
 assert.equal(recommendations.some(r=>r.id==='battery-bms'),false);
 assert.ok(recommendations.find(r=>r.id==='smartshunt-aux-choice').benefits.includes('NOT both'));
});
test('Multiple connections cannot silently occupy the same Cerbo port',()=>{
 const p=seed();p.communicationConnections=[
  {id:'c1',fromPortId:'smartshunt-ved',toPortId:'cerbo-ved-1',status:'proposed',cable:'VE.Direct',functions:[],evidence:'documented',notes:''},
  {id:'c2',fromPortId:'mppt-ved',toPortId:'cerbo-ved-1',status:'proposed',cable:'VE.Direct',functions:[],evidence:'documented',notes:''}
 ];
 assert.ok(connectionDiagnostics(p).some(x=>x.level==='blocker'&&x.message.includes('already occupied')));
});
test('Recorded GX monitoring authorities without a data link remain incomplete, not an invalid project',()=>{
 const p=seed();p.monitoringAuthorities=[{metric:'habitation-soc',componentId:'smartshunt',method:'gx',evidence:'unverified',notes:''}];
 assert.ok(connectionDiagnostics(p).some(x=>x.level==='incomplete'&&x.message.includes('data path')));
 assert.equal(validateProject(p),true);
});
test('Autonomy uses active bank capacity instead of legacy scalar',()=>{
 const p=seed();p.batteryCapacityAh=999;
 p.batteries[0].capacityAh=200;
 p.autonomy={...autonomySettings(p),solarManualWhPerDay:150};
 const projection=projectAutonomy(p,'normal');
 assert.equal(projection.batteryUsableWh,200*12*.7);
 assert.ok(projection.provisionalReasons.some(r=>r.id==='bank-source'));
});
test('An incompatible bank voltage yields an explicit autonomy blocker',()=>{
 const p=seed();p.batteries[0].nominalVoltageV=24;
 p.autonomy={...autonomySettings(p),solarManualWhPerDay:150};
 const projection=projectAutonomy(p,'normal');
 assert.ok(projection.ratingBlockers.some(b=>b.id==='bank-voltage'));
});
