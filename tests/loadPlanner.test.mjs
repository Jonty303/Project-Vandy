import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  newLoad,loadEnergy,plannerTotal,isPlanner,blankPlanner,newCircuit,moveLoadToCircuit,
  catalogue,importPlanner,batteries,selectedBattery,batteryRuntime,voltageIssues,
  circuitVoltageIssues,loadVoltageIssues,
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
  const t=plannerTotal({...blankPlanner(),loads:[a,b]});
  assert.equal(t.wh,240);assert.equal(t.byVoltage[0].ah,10);
  assert.equal(t.byVoltage[2].ah,120/230);
});
test('unknown and invalid figures remain partial; no silent zero',()=>{
  const l=sample();l.rating=null;
  const p={...blankPlanner(),loads:[l]};
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
test('circuit voltage mismatches are non-blocking but centrally flagged; duplicated IDs are invalid',()=>{
  const p=blankPlanner();p.circuits=[newCircuit()];
  const l=sample();l.circuitId=p.circuits[0].id;p.loads.push(l);
  assert.ok(isPlanner(p));
  p.circuits[0].voltage=230;
  assert.equal(isPlanner(p),true,'mismatches are saveable');
  assert.equal(voltageIssues(p).length,1);
  assert.equal(circuitVoltageIssues(p,p.circuits[0].id).length,1);
  assert.equal(loadVoltageIssues(p,l.id).length,1);
  assert.equal(plannerTotal(p).wh,120,'Wh is retained and provisional');
  p.circuits[0].voltage=12;
  assert.deepEqual(voltageIssues(p),[],'warnings clear automatically');
  p.loads.push({...l});assert.equal(isPlanner(p),false,'duplicate IDs remain invalid');
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
  assert.equal(importPlanner({version:5,batteryId:null,charging:blankPlanner().charging,circuits:[],loads:[{id:'broken'}]}),null);
  assert.equal(importPlanner({version:1,circuits:null,loads:[]}),null);
});

test('v2 circuit with old remote setting migrates without inferring a physical switch',()=>{
  const old={version:2,circuits:[{id:'remote',name:'Lights',voltage:12,
    physicalSwitch:true,control:'remote6'}],loads:[]};
  const next=importPlanner(old);
  assert.ok(next&&isPlanner(next));
  assert.equal(next.version,5);
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

test('drag/drop assignment preserves voltage and flags mismatches without changing energy',()=>{
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
  assert.equal(inMains.loads[0].voltage,12,'moving to a circuit must not rewrite device voltage');
  assert.equal(voltageIssues(inMains).length,1,'mismatch is displayed everywhere relevant');
  assert.ok(isPlanner(inMains),'voltage mismatch is saveable');
  assert.equal(inMains.loads[0].rating,5,'average watts per metre not rewritten');
  assert.equal(plannerTotal(inMains).wh,daily);
  const ungrouped=moveLoadToCircuit(inMains,light.id,'');
  assert.equal(ungrouped.loads[0].circuitId,'');
  assert.equal(ungrouped.loads[0].voltage,12,'ungrouping retains original device voltage');
  assert.deepEqual(voltageIssues(ungrouped),[]);
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

test('three EU WattCycle battery selections expose rated Wh and specifications',()=>{
  assert.deepEqual(batteries.map(b=>b.id),['mini-280','ultra-628-12','ultra-314-24']);
  const [mini,large12,large24]=batteries;
  assert.equal(mini.nominalVoltage,12.8);
  assert.equal(mini.capacityAh,280);
  assert.equal(mini.energyWh,3584);
  assert.equal(large12.nominalVoltage,12.8);
  assert.equal(large12.capacityAh,628);
  assert.equal(large12.energyWh,8038.4);
  assert.equal(large24.nominalVoltage,25.6);
  assert.equal(large24.capacityAh,314);
  assert.equal(large24.energyWh,8038.4);
  assert.equal(large12.bmsAmps,300);
  assert.equal(large24.bmsAmps,300);
});
test('Battery Selection runtime uses load Wh and keeps a 10 percent reserve, without charging',()=>{
  const p=blankPlanner();p.batteryId='mini-280';
  assert.equal(selectedBattery(p)?.id,'mini-280');
  const load=sample();load.rating=100;load.hours=10;p.loads.push(load);
  const e=batteryRuntime(p);
  assert.equal(e.dailyWh,1000);
  assert.equal(e.availableWh,3584*0.9);
  assert.equal(e.days,3584*0.9/1000);
  assert.equal(e.hours,e.days*24);
  assert.equal(e.bankVoltageLoads.length,0);
  assert.equal(e.provisional,false);
  p.batteryId='ultra-628-12';
  assert.equal(batteryRuntime(p).days,8038.4*0.9/1000);
  p.batteryId='ultra-314-24';
  assert.equal(batteryRuntime(p).days,8038.4*0.9/1000,'same Wh gives same ideal endurance');
});
test('12V battery flags 24V loads; 24V battery flags 12V loads, no auto-voltage rewriting',()=>{
  const p=blankPlanner();p.batteryId='mini-280';
  const load=sample();load.voltage=24;p.loads.push(load);
  assert.equal(batteryRuntime(p).bankVoltageLoads.length,1);
  assert.equal(batteryRuntime(p).provisional,true);
  assert.equal(p.loads[0].voltage,24);
  p.batteryId='ultra-314-24';
  assert.equal(batteryRuntime(p).bankVoltageLoads.length,0);
  p.loads[0].voltage=12;
  assert.equal(batteryRuntime(p).bankVoltageLoads.length,1);
  const ac=sample();ac.voltage=230;p.loads.push(ac);
  assert.equal(batteryRuntime(p).bankVoltageLoads.length,1,'230V draws are separate; wiring deferred');
  assert.equal(batteryRuntime(p).acLoads.length,1);
});
test('no loads yields undefined endurance; incomplete loads generate provisional estimate',()=>{
  const p=blankPlanner();p.batteryId='mini-280';
  assert.equal(batteryRuntime(p).days,null);
  const l=sample();l.hours=null;p.loads.push(l);
  assert.equal(batteryRuntime(p).missing,1);
  assert.equal(batteryRuntime(p).days,null);
  l.hours=4;
  assert.equal(batteryRuntime(p).missing,0);
  assert.ok(batteryRuntime(p).days>0);
});
test('legacy v3 imports as v5 preserving voltage mismatches and not forcing a battery selection',()=>{
  const p=blankPlanner();
  const c=newCircuit();c.voltage=24;p.circuits.push(c);
  const l=sample();l.circuitId=c.id;p.loads.push(l);
  const legacy={version:3,circuits:p.circuits,loads:p.loads};
  const upgraded=importPlanner(legacy);
  assert.ok(upgraded&&isPlanner(upgraded));
  assert.equal(upgraded.version,5);
  assert.equal(upgraded.batteryId,null);
  assert.equal(upgraded.loads[0].voltage,12);
  assert.equal(voltageIssues(upgraded).length,1);
  assert.equal(isPlanner(upgraded),true);
});
test('invalid battery selection IDs are rejected, voltage mismatches are not',()=>{
  const p=blankPlanner();
  p.batteryId='not-real';
  assert.equal(isPlanner(p),false);
  p.batteryId=null;
  assert.ok(isPlanner(p));
});

test('legacy v4 preserves the battery selection and loads while adding empty planned charging',()=>{
  const original=blankPlanner();
  original.batteryId='ultra-314-24';
  original.loads.push(sample());
  const v4={version:4,batteryId:original.batteryId,circuits:original.circuits,loads:original.loads};
  const updated=importPlanner(v4);
  assert.ok(updated&&isPlanner(updated));
  assert.equal(updated.version,5);
  assert.equal(updated.batteryId,'ultra-314-24');
  assert.deepEqual(updated.charging.dc2dc,[]);
  assert.deepEqual(updated.charging.mppt,[]);
  assert.equal(updated.charging.shoreModelId,null);
  assert.equal(updated.loads.length,1);
  assert.equal(v4.version,4,'old plan not rewritten');
});
