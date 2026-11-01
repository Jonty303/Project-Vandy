import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProject } from '../src/data/vandy.ts';
import { awgForMm2, initialWiringPlan, sizeCable, validateWiring, voltageDropPct } from '../src/domain/dcWiring.ts';
import { migrateProject, validateProject } from '../src/domain/storage.ts';
import { ledRatedWatts } from '../src/domain/calculations.ts';

const demo=()=>structuredClone(seedProject);
test('main 150A fuse occurs on habitation battery positive before isolator',()=>{
  const p=demo(),w=p.dcWiring;
  const f=w.fuses.find(f=>f.id==='battery-main');
  assert.equal(f.ratingA,150);
  assert.equal(f.status,'reported');
  assert.equal(f.confidence,'owner-checked');
  assert.equal(f.placement,'battery-end');
  assert.ok(w.cables.find(c=>c.id==='battery-fuse-isolator').fuseId==='battery-main');
});
test('Orion XS input and output fuse values are owner checked 70A but placement is not claimed checked',()=>{
  const p=demo(),w=p.dcWiring;
  for(const id of ['orion-in','orion-out']){
    const f=w.fuses.find(f=>f.id===id);
    assert.equal(f.ratingA,70);assert.equal(f.confidence,'owner-checked');
    assert.equal(f.placement,'unconfirmed');
  }
  assert.equal(w.cables.find(c=>c.id==='orion-ground').status,'unknown');
  assert.equal(w.cables.find(c=>c.id==='orion-battery').toComponentId,'battery');
  assert.ok(w.cables.some(c=>c.fromComponentId==='starter-battery'&&c.toComponentId==='orion'));
});
test('Lynx has four sequential proposed output fuse locations with remote replacing Orion',()=>{
  const p=demo();
  const f=p.dcWiring.fuses.filter(f=>f.holderComponentId==='lynx');
  assert.deepEqual(f.map(x=>x.slot),[1,2,3,4]);
  assert.equal(p.dcWiring.cables.find(c=>c.id==='lynx-remote').toComponentId,'remote-six');
  assert.ok(!p.dcWiring.cables.some(c=>c.fromComponentId==='lynx'&&c.toComponentId==='orion'));
  assert.ok(f.every(x=>x.status==='proposed'));
  assert.deepEqual(f.map(x=>x.ratingA),[15,60,60,100]);
});
test('Blue Sea 5026 sequential assignment has exactly 12 proposed and editable branch fuses',()=>{
 const p=demo();const f=p.dcWiring.fuses.filter(x=>x.holderComponentId==='blue-sea');
 assert.equal(f.length,12);
 assert.deepEqual(f.map(x=>x.slot),Array.from({length:12},(_,i)=>i+1));
 assert.ok(f.every(x=>x.ratingA>0&&x.ratingA<=30&&x.status==='proposed'));
 const circuits=p.circuits.filter(c=>c.sourceComponentId==='blue-sea');
 assert.equal(circuits.length,12);
 assert.deepEqual(circuits.map(c=>c.sourceOutputId),Array.from({length:12},(_,i)=>'fuse-'+(i+1)));
 assert.ok(validateProject(p));
});
test('default all DC cable runs are 1m assumed, independently editable without touching fuse ratings',()=>{
 const p=demo(),w=p.dcWiring;
 assert.ok(w.cables.every(c=>c.lengthM===1&&c.lengthEvidence==='assumed'));
 const before=sizeCable(w.cables.find(c=>c.id==='lynx-blue-sea'));
 p.dcWiring.cables.find(c=>c.id==='lynx-blue-sea').lengthM=20;
 const after=sizeCable(p.dcWiring.cables.find(c=>c.id==='lynx-blue-sea'));
 assert.ok(after.voltageDropPct<=3.001||after.mm2===null);
 assert.ok(after.mm2>=before.mm2);
 assert.equal(p.dcWiring.fuses.find(f=>f.id==='lynx-2').ratingA,60);
});
test('AWG conversion rounds UP in copper cross-section, does not treat 6AWG as exactly 16mm²',()=>{
 assert.equal(awgForMm2(16).awg,'4');
 assert.equal(awgForMm2(16).actualMm2,21.2);
 assert.equal(awgForMm2(2.5).awg,'12');
 assert.ok(voltageDropPct(1,50,16,12)>0);
});
test('Unknown load current may receive provisional wire sizing from a proposed fuse envelope',()=>{
 const run=initialWiringPlan.cables.find(c=>c.id==='lynx-remote');
 assert.equal(run.designCurrentA,null);
 assert.equal(sizeCable(run).mm2,null);
 assert.ok(sizeCable(run,15).mm2>=4);
});
test('reject fuse >30A per Blue Sea output, retain safe incomplete values',()=>{
 const p=demo(),w=p.dcWiring;
 w.fuses.find(f=>f.id==='blue-sea-1').ratingA=40;
 assert.ok(validateWiring(w).some(x=>x.severity==='blocker'&&x.id==='blue-sea-1'));
 w.fuses.find(f=>f.id==='blue-sea-1').ratingA=null;
 assert.ok(validateWiring(w).some(x=>x.severity==='incomplete'&&x.id==='blue-sea-1'));
 assert.equal(validateProject(p),true);
});
test('known owner lighting strip lengths are populated without inventing rain gutter brand',()=>{
 const p=demo();
 assert.equal(p.loads.find(l=>l.id==='floor-led').led.lengthMetres,2);
 assert.equal(p.loads.find(l=>l.id==='kitchen-light').led.lengthMetres,1.5);
 assert.equal(p.loads.find(l=>l.id==='toilet-light').led.lengthMetres,1);
 assert.equal(ledRatedWatts(p.loads.find(l=>l.id==='floor-led')),19.2);
 assert.equal(ledRatedWatts(p.loads.find(l=>l.id==='kitchen-light')),14.4);
 assert.match(p.loads.find(l=>l.id==='outside-light').name,/rain-gutter/);
 assert.match(p.loads.find(l=>l.id==='outside-light').notes,/Brand and power rating unknown/);
});
test('legacy v3 projects acquire wiring defaults but retain custom load measurements',()=>{
 const p=demo();
 delete p.dcWiring;
 p.loads.find(l=>l.id==='floor-led').led.lengthMetres=7.5;
 p.loads.find(l=>l.id==='kitchen-light').name='Hand-built lighting';
 const next=migrateProject(p);
 assert.ok(next.dcWiring);
 assert.equal(next.dcWiring.cables.length,initialWiringPlan.cables.length);
 assert.equal(next.loads.find(l=>l.id==='floor-led').led.lengthMetres,7.5);
 assert.equal(next.loads.find(l=>l.id==='kitchen-light').name,'Hand-built lighting');
 assert.ok(next.components.some(c=>c.id==='isolator'));
});
test('wire plan writes remain serializable and migrate without resetting adjusted lengths',()=>{
 const p=demo();
 p.dcWiring.cables[0].lengthM=2.7;
 p.dcWiring.fuses.find(f=>f.id==='blue-sea-1').ratingA=7.5;
 const imported=migrateProject(JSON.parse(JSON.stringify(p)));
 assert.equal(imported.dcWiring.cables[0].lengthM,2.7);
 assert.equal(imported.dcWiring.fuses.find(f=>f.id==='blue-sea-1').ratingA,7.5);
});
