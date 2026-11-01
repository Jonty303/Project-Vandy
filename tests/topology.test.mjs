import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProject } from '../src/data/vandy.ts';
import { calculateLoad } from '../src/domain/calculations.ts';
import { checkLogicalLink, inspectTopology } from '../src/domain/topology.ts';
import { migrateProject, validateProject } from '../src/domain/storage.ts';

const seed=()=>structuredClone(seedProject);

test('Vandy has two separate consumer units and three outlet positions',()=>{
  const p=seed();
  const units=p.components.filter(c=>c.kind==='consumer-unit');
  assert.deepEqual(units.map(u=>u.id),['cu-shore','cu-sockets']);
  assert.equal(p.components.find(c=>c.id==='kitchen-socket').socketPositions.length,2);
  assert.equal(p.components.find(c=>c.id==='garage-socket').socketPositions.length,1);
  assert.equal(p.socketAssignments.find(a=>a.loadId==='hob-igniter').socketComponentId,'kitchen-socket');
});
test('logical topology uses distinct L/N/PE and DC+/DC-/CHASSIS port groups',()=>{
  const p=seed();
  assert.deepEqual(p.components.find(c=>c.id==='cu-shore').ports[0].conductors,['L','N','PE']);
  assert.deepEqual(p.components.find(c=>c.id==='remote-six').ports[0].conductors,['DC+','DC-','CHASSIS']);
  assert.equal(inspectTopology(p).length,0);
  assert.ok(p.topologyLinks.filter(l=>l.status==='proposed').length>=5);
});
test('invalid AC-to-DC logical link is rejected by diagnostics',()=>{
  const p=seed();
  const link={id:'wrong',fromComponentId:'cu-sockets',fromPortId:'ac-out',toComponentId:'remote-six',toPortId:'dc-in',status:'proposed'};
  assert.ok(checkLogicalLink(p,link).some(msg=>msg.includes('AC and DC')));
});
test('outlet assignments are independent of load energy and duplicate positions are diagnosed',()=>{
  const p=seed();
  const before=p.loads.length;
  p.socketAssignments.push({id:'duplicate',socketComponentId:'kitchen-socket',positionId:'left',loadId:'laptop-shared',evidence:'reported'});
  assert.equal(p.loads.length,before);
  assert.ok(inspectTopology(p).some(i=>i.message.includes('same socket position')));
});
test('Starlink and the shared 80W laptop adapter are AC inverter loads',()=>{
  const p=seed();
  assert.equal(p.loads.filter(l=>l.id.startsWith('laptop-')).length,1);
  for(const id of ['laptop-shared','starlink']){
    const l=p.loads.find(l=>l.id===id);
    assert.equal(p.circuits.find(c=>c.id===l.circuitId).supply,'ac-inverter');
  }
  const l=p.loads.find(l=>l.id==='laptop-shared');
  const c=p.circuits.find(c=>c.id===l.circuitId);
  const result=calculateLoad(l,c,p,'working');
  assert.equal(result.deliveredWh,480);
  assert.ok(Math.abs(result.batteryWh-480/0.9)<1e-8);
});
test('all four additional lights exist with unknown, not invented, wattage',()=>{
  const p=seed();
  for(const id of ['kitchen-light','main-light','outside-light','garage-light']){
    const l=p.loads.find(l=>l.id===id);
    assert.ok(l);
    assert.equal(l.modes[0].watts,null);
  }
});
test('v1 project migrates without overwriting modified loads or duplicating default laptop chargers',()=>{
  const p=seed();
  const legacy=structuredClone(p);
  legacy.schemaVersion=1;
  delete legacy.topologyLinks;delete legacy.socketAssignments;delete legacy.protectionDevices;
  legacy.loads=legacy.loads.filter(l=>!['laptop-shared','kitchen-light','main-light','outside-light','garage-light','hob-igniter'].includes(l.id));
  legacy.components=legacy.components.filter(c=>!['shore-inlet','cu-shore','cu-sockets','kitchen-socket','garage-socket','maxxair-vent'].includes(c.id));
  legacy.loads.find(l=>l.id==='starlink').circuitId='communications';
  const first=legacy.loads.find(l=>l.id==='floor-led');first.name='My custom floor lights';first.led.lengthMetres=7.5;
  const adapter=(id)=>({id,name:id,circuitId:'ac-sockets',kind:'standard',modes:[{id:'charging',name:'Charging',watts:65,evidence:'estimated',usage:{
    normal:{minutesPerDay:0,dutyFraction:1},working:{minutesPerDay:480,dutyFraction:1},winter:{minutesPerDay:0,dutyFraction:1}
  }}]});
  legacy.loads.push(adapter('laptop-one'),adapter('laptop-two'));
  const next=migrateProject(legacy);
  assert.ok(next);
  assert.ok(validateProject(next));
  assert.equal(next.loads.find(l=>l.id==='floor-led').name,'My custom floor lights');
  assert.equal(next.loads.find(l=>l.id==='floor-led').led.lengthMetres,7.5);
  assert.equal(next.loads.filter(l=>l.id.startsWith('laptop-')).length,1);
  assert.equal(next.loads.find(l=>l.id==='starlink').circuitId,'ac-sockets');
  assert.equal(next.components.filter(c=>c.kind==='consumer-unit').length,2);
});
test('edited legacy laptop entries are retained rather than silently discarded',()=>{
  const p=seed();const legacy=structuredClone(p);
  legacy.schemaVersion=1;delete legacy.topologyLinks;delete legacy.socketAssignments;delete legacy.protectionDevices;
  legacy.loads=legacy.loads.filter(l=>l.id!=='laptop-shared');
  legacy.loads.push({id:'laptop-one',name:'Custom laptop device',circuitId:'ac-sockets',kind:'standard',modes:[
    {id:'charging',name:'Charging',watts:90,evidence:'measured',usage:{normal:{minutesPerDay:15,dutyFraction:1},working:{minutesPerDay:100,dutyFraction:1},winter:{minutesPerDay:0,dutyFraction:1}}}
  ]});
  const migrated=migrateProject(legacy);
  assert.ok(migrated.loads.some(l=>l.id==='laptop-one'&&l.modes[0].watts===90));
  assert.ok(!migrated.loads.some(l=>l.id==='laptop-shared'));
});
