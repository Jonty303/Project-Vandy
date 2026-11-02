import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  newLoad,loadEnergy,plannerTotal,isPlanner,blankPlanner,newCircuit,effectivePhysicalSwitch,
  catalogue,importPlanner,
} from '../src/domain/loadPlanner.ts';
const template=(name)=>catalogue.find(t=>t.name===name);
const sample=()=>newLoad({name:'Test',category:'standard',voltage:12,watts:60,hours:2,basis:'Test'});
test('empty planner and nonempty catalogue with defaults',()=>{
  const p=blankPlanner();assert.ok(isPlanner(p));assert.deepEqual(p.loads,[]);
  for(const t of catalogue){
    const l=newLoad(t);
    assert.ok(l.rating!==null&&l.hours!==null,'missing default: '+t.name);
    assert.ok(loadEnergy(l).wh!==null,'invalid default: '+t.name);
  }
  assert.equal(plannerTotal(p).wh,0);
});
test('each device has one daily average with correct W/A/Wh/Ah conversion',()=>{
  const l=sample();l.quantity=2;
  let r=loadEnergy(l);
  assert.equal(r.watts,120);assert.equal(r.amps,10);assert.equal(r.wh,240);assert.equal(r.ah,20);
  l.ratingUnit='A';l.rating=5;r=loadEnergy(l);assert.equal(r.wh,240);
});
test('LED strips use length and average watts per metre; no separate seasonal brightness',()=>{
  const l=newLoad(template('Floor LED strip'));
  assert.equal(l.rating,5);assert.equal(l.length,2);assert.equal(l.hours,5);
  assert.equal(loadEnergy(l).wh,50);
  l.length=3;assert.equal(loadEnergy(l).wh,75);
  l.length=null;assert.equal(loadEnergy(l).wh,null);
});
test('fridge runs 24 hours at averaged input; heater uses only the average and set hours',()=>{
  const fridge=newLoad(template('CR65X fridge'));
  assert.equal(fridge.rating,21);assert.equal(fridge.hours,24);
  assert.equal(loadEnergy(fridge).wh,504);
  const heater=newLoad(template('VEVOR diesel heater'));
  assert.equal(heater.rating,40);assert.equal(heater.hours,4);
  assert.equal(loadEnergy(heater).wh,160);
});
test('mixed-voltage energy aggregates while Ah stays separate',()=>{
  const a=sample(),b=sample();b.id='second';b.voltage=230;
  const t=plannerTotal({version:2,circuits:[],loads:[a,b]});
  assert.equal(t.wh,240);assert.equal(t.byVoltage[0].ah,10);
  assert.equal(t.byVoltage[2].ah,120/230);
});
test('unknown and invalid figures remain partial; no silent zero',()=>{
  const l=sample();l.rating=null;
  const p={version:2,circuits:[],loads:[l]};
  assert.equal(loadEnergy(l).wh,null);assert.equal(plannerTotal(p).missing,1);
  l.rating=60;l.hours=25;assert.equal(loadEnergy(l).wh,null);
  assert.equal(isPlanner(p),false);l.hours=0;
  assert.equal(loadEnergy(l).wh,0);assert.equal(isPlanner(p),true);
});
test('physical switch is circuit-level and ignored for 6-gang remote control',()=>{
  const c=newCircuit();
  c.physicalSwitch=true;assert.equal(effectivePhysicalSwitch(c),true);
  c.control='remote6';assert.equal(effectivePhysicalSwitch(c),false);
  assert.equal(c.physicalSwitch,true,'remember preference for direct control');
  const p=blankPlanner();p.circuits=[c];p.loads=[{...sample(),circuitId:c.id}];
  assert.ok(isPlanner(p));c.control='direct';assert.equal(effectivePhysicalSwitch(c),true);
});
test('validation rejects mismatched circuit voltages and duplicated IDs',()=>{
  const p=blankPlanner();p.circuits=[newCircuit()];
  const l=sample();l.circuitId=p.circuits[0].id;p.loads.push(l);
  assert.ok(isPlanner(p));p.circuits[0].voltage=230;assert.equal(isPlanner(p),false);
  p.circuits[0].voltage=12;p.loads.push({...l});assert.equal(isPlanner(p),false);
});
test('legacy version 1 project converts Summer usage without dropping other seasonal records',()=>{
  const old={version:1,circuits:[{id:'c',name:'Lights',voltage:12}],loads:[{
    id:'l',name:'Floor LED strip',circuitId:'c',voltage:12,category:'led',
    ratingUnit:'W',rating:10,quantity:1,length:2,brightness:50,fridgeMode:'compressor',
    startupWatts:null,startupMinutes:null,shutdownWatts:null,shutdownMinutes:null,
    usage:{Spring:{hours:3,duty:100,cycles:0},Summer:{hours:4,duty:100,cycles:0},
      Autumn:{hours:2,duty:100,cycles:0},Winter:{hours:6,duty:100,cycles:0}},notes:'Original',
  }]};
  const migrated=importPlanner(old);
  assert.ok(migrated&&isPlanner(migrated));
  assert.equal(migrated.loads[0].hours,4);
  assert.equal(loadEnergy(migrated.loads[0]).wh,40);
  assert.equal(migrated.loads[0].legacySeasonal.usage.Winter.hours,6);
  assert.equal(migrated.circuits[0].physicalSwitch,false);
  assert.equal(migrated.circuits[0].control,'direct');
});
test('reject malformed external imports',()=>{
  assert.equal(importPlanner({version:2,circuits:[],loads:[{id:'broken'}]}),null);
  assert.equal(importPlanner({version:1,circuits:null,loads:[]}),null);
});
