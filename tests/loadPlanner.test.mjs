import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  newLoad,loadEnergy,plannerTotal,isPlanner,blankPlanner,newCircuit,moveLoadToCircuit,
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
  const l=newLoad(template('LED lights'));
  assert.equal(l.rating,5);assert.equal(l.length,1);assert.equal(l.hours,3);
  assert.equal(loadEnergy(l).wh,15);
  l.length=3;assert.equal(loadEnergy(l).wh,45);
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
  const t=plannerTotal({version:3,circuits:[],loads:[a,b]});
  assert.equal(t.wh,240);assert.equal(t.byVoltage[0].ah,10);
  assert.equal(t.byVoltage[2].ah,120/230);
});
test('unknown and invalid figures remain partial; no silent zero',()=>{
  const l=sample();l.rating=null;
  const p={version:3,circuits:[],loads:[l]};
  assert.equal(loadEnergy(l).wh,null);assert.equal(plannerTotal(p).missing,1);
  l.rating=60;l.hours=25;assert.equal(loadEnergy(l).wh,null);
  assert.equal(isPlanner(p),false);l.hours=0;
  assert.equal(loadEnergy(l).wh,0);assert.equal(isPlanner(p),true);
});
test('physical switch belongs to a named circuit; no controller assignment in this stage',()=>{
  const c=newCircuit();
  assert.equal(c.physicalSwitch,false);
  assert.equal('control' in c,false);
  c.physicalSwitch=true;
  const p=blankPlanner();
  p.circuits=[c];p.loads=[{...sample(),circuitId:c.id}];
  assert.ok(isPlanner(p));assert.equal(p.circuits[0].physicalSwitch,true);
});
test('Ungrouped loads is implicit and can remain empty, independent of mixed voltage',()=>{
  const p=blankPlanner();
  assert.equal(p.circuits.length,0);
  assert.equal(p.loads.length,0);
  assert.ok(isPlanner(p));
  const l=sample();const ac=sample();ac.id='ac';ac.voltage=230;
  p.loads.push(l,ac);
  assert.equal(p.loads.every(x=>x.circuitId===''),true);
  assert.equal(p.circuits.length,0,'no placeholder circuit should be stored');
  assert.equal(plannerTotal(p).wh,240);
  assert.ok(isPlanner(p));
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
  assert.equal('control' in migrated.circuits[0],false);
});
test('reject malformed external imports',()=>{
  assert.equal(importPlanner({version:3,circuits:[],loads:[{id:'broken'}]}),null);
  assert.equal(importPlanner({version:1,circuits:null,loads:[]}),null);
});

test('v2 circuit with old remote setting migrates without inferring a physical switch',()=>{
  const old={version:2,circuits:[{id:'remote',name:'Lights',voltage:12,
    physicalSwitch:true,control:'remote6'}],loads:[]};
  const next=importPlanner(old);
  assert.ok(next&&isPlanner(next));
  assert.equal(next.version,3);
  assert.equal(next.circuits[0].physicalSwitch,false);
  assert.equal('control' in next.circuits[0],false);
  assert.equal(old.circuits[0].physicalSwitch,true,'source data remains untouched');
});
test('v2 direct switch migrates and new model cannot persist controller fields',()=>{
  const old={version:2,circuits:[{id:'direct',name:'Outside lights',voltage:12,
    physicalSwitch:true,control:'direct'}],loads:[]};
  const next=importPlanner(old);
  assert.ok(next&&isPlanner(next));
  assert.equal(next.circuits[0].physicalSwitch,true);
  assert.equal('control' in next.circuits[0],false);
});

test('Add load catalogue offers exactly one generic LED lights preset',()=>{
  const lights=catalogue.filter(t=>/light|LED/i.test(t.name));
  assert.deepEqual(lights.map(l=>l.name),['LED lights']);
  const first=newLoad(template('LED lights'));
  const second=newLoad(template('LED lights'));
  assert.equal(first.category,'led');
  assert.equal(first.circuitId,'');
  assert.equal(first.name,'LED lights');
  assert.notEqual(first.id,second.id,'multiple separate lighting instances supported');
  first.name='Kitchen counter lights';
  first.length=1.5;
  first.hours=2;
  assert.equal(loadEnergy(first).wh,15);
  assert.equal(second.name,'LED lights','editing one entry must not rename another');
});

test('drag/drop domain assignment updates circuitId and circuit voltage without changing energy',()=>{
  const p=blankPlanner();
  const kitchen=newCircuit();kitchen.name='Kitchen';kitchen.voltage=12;
  const mains=newCircuit();mains.name='Mains';mains.voltage=230;
  p.circuits.push(kitchen,mains);
  const light=newLoad(template('LED lights'));
  p.loads.push(light);
  const daily=plannerTotal(p).wh;
  const inKitchen=moveLoadToCircuit(p,light.id,kitchen.id);
  assert.notEqual(inKitchen,p);
  assert.equal(inKitchen.loads[0].circuitId,kitchen.id);
  assert.equal(inKitchen.loads[0].voltage,12);
  assert.equal(plannerTotal(inKitchen).wh,daily);
  const inMains=moveLoadToCircuit(inKitchen,light.id,mains.id);
  assert.equal(inMains.loads[0].circuitId,mains.id);
  assert.equal(inMains.loads[0].voltage,230);
  assert.equal(inMains.loads[0].rating,5,'average watts per metre not rewritten');
  assert.equal(plannerTotal(inMains).wh,daily);
  const ungrouped=moveLoadToCircuit(inMains,light.id,'');
  assert.equal(ungrouped.loads[0].circuitId,'');
  assert.equal(ungrouped.loads[0].voltage,230,'ungrouping retains last voltage');
  assert.ok(isPlanner(ungrouped));
  assert.equal(p.loads[0].circuitId,'','original planner unchanged');
});

test('dropping on the same group or an unknown identifier is a safe no-op',()=>{
  const p=blankPlanner();
  const circuit=newCircuit();p.circuits.push(circuit);
  const l=newLoad(template('LED lights'));p.loads.push(l);
  assert.equal(moveLoadToCircuit(p,l.id,''),p);
  assert.equal(moveLoadToCircuit(p,l.id,'no-such-circuit'),p);
  assert.equal(moveLoadToCircuit(p,'no-such-load',circuit.id),p);
  const next=moveLoadToCircuit(p,l.id,circuit.id);
  assert.equal(moveLoadToCircuit(next,l.id,circuit.id),next);
  assert.ok(isPlanner(next));
});
