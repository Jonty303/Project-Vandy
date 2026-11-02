import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankPlanner,importPlanner,isPlanner,newLoad,moveLoadToCircuit,newCircuit} from '../src/domain/loadPlanner.ts';
import {newPlannedUnit} from '../src/domain/charging.ts';
import {
 distributionModels,standaloneInverters,activeInverter,assignmentFor,occupiedSlots,firstFreeSlot,backfillChargeSlots,
 busbarRequirements,validDistribution,distributionIssues,normaliseDistribution,dcTargets,
} from '../src/domain/distribution.ts';
const node=(id,kind='blue-sea',voltage=12)=>({id,name:id,kind,voltage});
const attach=(id,sourceId,targetType,targetId,slot=null)=>({id,sourceId,targetType,targetId,slot});
const load=(name,voltage=12,circuitId='')=>newLoad({
 name,category:'standard',voltage,watts:12,hours:2,basis:'Test',
},circuitId);
const setup=()=>{
 const p=blankPlanner();p.batteryId='mini-280';
 p.distribution.nodes=[node('lynx','lynx'),node('fuse'),node('bus','busbar')];
 return p;
};
test('empty projects do not imply distribution or inverter wiring',()=>{
 const p=blankPlanner();
 assert.equal(p.version,8);assert.ok(isPlanner(p));
 assert.deepEqual(p.distribution.nodes,[]);
 assert.equal(p.distribution.standaloneInverterId,null);
 assert.equal(activeInverter(p),null);
 assert.equal(distributionModels['blue-sea'].slots,12);
 assert.equal(distributionModels.lynx.slots,4);
 assert.ok(standaloneInverters.some(i=>i.voltage===12));
 assert.ok(standaloneInverters.some(i=>i.voltage===24));
});
test('Lynx feed to Blue Sea and two separate fused branch destinations',()=>{
 const p=setup();
 const circuit=newCircuit();circuit.voltage=12;circuit.name='Lighting';
 p.circuits=[circuit];p.loads=[load('Kitchen lights',12,circuit.id),load('Floor lights',12,circuit.id),load('Water pump')];
 p.distribution.dcAssignments=[
  attach('root','battery','node','lynx'),
  attach('feed','lynx','node','fuse',1),
  attach('c1','fuse','circuit',circuit.id,1),
  attach('c2','fuse','load',p.loads[2].id,2),
 ];
 assert.ok(validDistribution(p.distribution,p));
 assert.ok(isPlanner(p));
 assert.equal(dcTargets(p,12).filter(x=>x.targetType==='load').length,1);
 assert.equal(assignmentFor(p.distribution,'circuit',circuit.id)?.slot,1);
 assert.equal(p.distribution.dcAssignments.filter(x=>x.targetType==='circuit').length,1);
 assert.equal(p.loads.filter(l=>l.circuitId===circuit.id).length,2);
 assert.equal(distributionIssues(p).filter(i=>i.level==='error').length,0);
});
test('fuse positions cannot host two associations and positions must be in range',()=>{
 const p=setup();const a=load('A'),b=load('B');p.loads=[a,b];
 p.distribution.dcAssignments=[attach('a','fuse','load',a.id,1),attach('b','fuse','load',b.id,1)];
 assert.equal(validDistribution(p.distribution,p),false);
 p.distribution.dcAssignments[1].slot=13;assert.equal(validDistribution(p.distribution,p),false);
 p.distribution.dcAssignments[1].slot=2;assert.equal(validDistribution(p.distribution,p),true);
 p.distribution.dcAssignments[1].id='a';assert.equal(validDistribution(p.distribution,p),false);
});
test('cycles and self-feeds are structural invalidity',()=>{
 const p=setup();
 p.distribution.dcAssignments=[attach('a','bus','node','lynx'),attach('b','lynx','node','bus',1)];
 assert.equal(validDistribution(p.distribution,p),false);
 p.distribution.dcAssignments=[attach('a','lynx','node','lynx',1)];
 assert.equal(validDistribution(p.distribution,p),false);
});
test('busbar recommendation accounts for upstream, outbound and charging attachments',()=>{
 const p=setup();const c=newCircuit();p.circuits=[c];
 p.distribution.dcAssignments=[
  attach('a','battery','node','bus'),
  attach('b','bus','circuit',c.id),
  attach('c','bus','node','lynx'),
 ];
 p.charging.mppt=[newPlannedUnit('smartsolar-100-50','mppt-a')];
 p.distribution.chargerAssignments=[{chargerId:'mppt-a',destinationId:'bus',slot:null}];
 const r=busbarRequirements(p,'bus');
 assert.equal(r.positive,4);assert.equal(r.negative,4);
 assert.equal(r.downstream,2);assert.equal(r.chargers,1);
 assert.equal(busbarRequirements(p,'fuse'),null);
 assert.equal(validDistribution(p.distribution,p),true);
});
test('charger inputs connect as sources, not as consumers; stale charger IDs fail validation',()=>{
 const p=setup();
 p.charging.dc2dc=[newPlannedUnit('orion-xs-12-12-50','dc-a')];
 p.distribution.chargerAssignments=[{chargerId:'dc-a',destinationId:'lynx',slot:1}];
 assert.ok(validDistribution(p.distribution,p));
 assert.equal(p.distribution.dcAssignments.length,0);
 p.charging.dc2dc=[];
 assert.equal(validDistribution(p.distribution,p),false);
 const repaired=normaliseDistribution(p);
 assert.deepEqual(repaired.distribution.chargerAssignments,[]);
});
test('Blue Sea is terminal consumer distribution and cannot be a feeder to another block',()=>{
 const p=setup();
 p.distribution.dcAssignments=[attach('a','fuse','node','lynx',1)];
 assert.equal(validDistribution(p.distribution,p),false);
});
test('ungrouped load moving into a circuit clears its independent assignment',()=>{
 const p=setup(),l=load('Lamp'),c=newCircuit();p.loads=[l];p.circuits=[c];
 p.distribution.dcAssignments=[attach('direct','fuse','load',l.id,1)];
 const grouped=normaliseDistribution(moveLoadToCircuit(p,l.id,c.id));
 assert.equal(grouped.loads[0].circuitId,c.id);
 assert.equal(grouped.distribution.dcAssignments.length,0);
 assert.ok(validDistribution(grouped.distribution,grouped));
});
test('deleting node clears dependent child references and chargers, preserving sources and loads',()=>{
 const p=setup();const l=load('Pump');p.loads=[l];
 p.charging.mppt=[newPlannedUnit('smartsolar-100-30','mppt')];
 p.distribution.dcAssignments=[attach('a','lynx','node','fuse',1),
  attach('b','fuse','load',l.id,1)];
 p.distribution.chargerAssignments=[{chargerId:'mppt',destinationId:'fuse',slot:null}];
 p.distribution.nodes=p.distribution.nodes.filter(n=>n.id!=='fuse');
 const next=normaliseDistribution(p);
 assert.equal(next.distribution.dcAssignments.length,0);
 assert.equal(next.distribution.chargerAssignments.length,0);
 assert.equal(next.loads.length,1);
});
test('shore battery charger is not an AC inverter, MultiPlus reuses chosen identity',()=>{
 const p=setup();
 p.charging.shoreModelId='ip22-12-30';
 assert.equal(activeInverter(p),null);
 p.distribution.standaloneInverterId='phoenix-12-500';
 assert.equal(activeInverter(p)?.combined,false);
 p.charging.shoreModelId='multiplus-12-500-20';
 assert.equal(activeInverter(p)?.combined,true);
 assert.equal(activeInverter(p)?.va,500);
 assert.equal(p.distribution.standaloneInverterId,'phoenix-12-500','standalone choice is retained but inactive');
});
test('230 V assignment only permits named AC circuits and ungrouped AC loads',()=>{
 const p=setup(),c=newCircuit();c.voltage=230;p.circuits=[c];
 const l=load('230V laptop',230);p.loads=[l];
 p.distribution.acAssignments=[{targetType:'circuit',targetId:c.id},{targetType:'load',targetId:l.id}];
 assert.ok(validDistribution(p.distribution,p));
 p.distribution.acAssignments.push({targetType:'load',targetId:l.id});
 assert.equal(validDistribution(p.distribution,p),false);
});
test('voltage mismatch stays visible but is not silently changed',()=>{
 const p=setup(),l=load('Pump',24);p.loads=[l];
 p.distribution.dcAssignments=[attach('batteryfeed','battery','load',l.id)];
 assert.ok(isPlanner(p));
 const warnings=distributionIssues(p);
 assert.ok(warnings.some(w=>w.message.includes('does not match target 24 V')));
 assert.equal(l.voltage,24);
});
test('v6 project imports unchanged equipment and receives empty distribution',()=>{
 const p=setup();p.loads=[load('Lamp')];
 const prior={version:6,batteryId:p.batteryId,charging:p.charging,offGrid:p.offGrid,
  circuits:p.circuits,loads:p.loads};
 const next=importPlanner(prior);
 assert.ok(next&&isPlanner(next));
 assert.equal(next.version,8);
 assert.equal(next.batteryId,p.batteryId);
 assert.equal(next.loads[0].name,'Lamp');
 assert.deepEqual(next.distribution.nodes,[]);
});

test('MPPT and Orion share Lynx four positions with outgoing Blue Sea and MultiPlus',()=>{
 const p=setup();
 const mppt=newPlannedUnit('smartsolar-100-50','mppt1');
 const orion=newPlannedUnit('orion-xs-12-12-50','orion1');
 p.charging.mppt=[mppt];p.charging.dc2dc=[orion];
 p.charging.shoreModelId='multiplus-12-800-35';
 p.distribution.dcAssignments=[
  attach('feed','lynx','node','fuse',1),
  attach('inv','lynx','inverter','inverter',2),
 ];
 assert.equal(firstFreeSlot(p.distribution,'lynx'),3);
 p.distribution.chargerAssignments=[
  {chargerId:mppt.id,destinationId:'lynx',slot:3},
  {chargerId:orion.id,destinationId:'lynx',slot:4},
 ];
 assert.deepEqual([...occupiedSlots(p.distribution,'lynx')].sort(),[1,2,3,4]);
 assert.equal(firstFreeSlot(p.distribution,'lynx'),null);
 assert.ok(validDistribution(p.distribution,p));
 assert.ok(isPlanner(p));
});
test('charger and DC branch may not occupy same Lynx position',()=>{
 const p=setup();
 p.charging.dc2dc=[newPlannedUnit('orion-xs-12-12-50','dc')];
 p.distribution.dcAssignments=[attach('branch','lynx','node','fuse',1)];
 p.distribution.chargerAssignments=[{chargerId:'dc',destinationId:'lynx',slot:1}];
 assert.equal(validDistribution(p.distribution,p),false);
 p.distribution.chargerAssignments[0].slot=2;
 assert.ok(validDistribution(p.distribution,p));
 p.distribution.chargerAssignments[0].slot=5;
 assert.equal(validDistribution(p.distribution,p),false);
});
test('v7 charger destination migration fills spare Lynx slots and preserves the model',()=>{
 const p=setup();
 p.charging.mppt=[newPlannedUnit('smartsolar-100-50','mppt1')];
 p.charging.dc2dc=[newPlannedUnit('orion-xs-12-12-50','orion1')];
 p.charging.shoreModelId='multiplus-12-800-35';
 p.distribution.dcAssignments=[
  attach('blue','lynx','node','fuse',1),
  attach('multi','lynx','inverter','inverter',2),
 ];
 // Historical v7 project does not contain a charger slot field.
 p.distribution.chargerAssignments=[
  {chargerId:'mppt1',destinationId:'lynx'},
  {chargerId:'orion1',destinationId:'lynx'},
 ];
 const prior={...p,version:7};
 const next=importPlanner(prior);
 assert.ok(next&&isPlanner(next));
 assert.equal(next.version,8);
 assert.deepEqual(next.distribution.chargerAssignments.map(x=>x.slot),[3,4]);
 assert.equal(next.distribution.dcAssignments[0].slot,1);
 assert.equal(next.distribution.dcAssignments[1].slot,2);
 assert.equal(next.charging.mppt[0].id,'mppt1');
 assert.equal(next.charging.dc2dc[0].id,'orion1');
 assert.equal(prior.distribution.chargerAssignments[0].slot,undefined);
});
test('overbooked v7 project preserves unallocated charging links and asks for review',()=>{
 const p=setup();
 p.distribution.dcAssignments=[1,2,3,4].map(slot=>attach('branch'+slot,'lynx','load','load'+slot,slot));
 p.loads=[1,2,3,4].map(i=>({...load('Load '+i),id:'load'+i}));
 p.charging.mppt=[newPlannedUnit('smartsolar-100-50','mppt1')];
 p.distribution.chargerAssignments=[{chargerId:'mppt1',destinationId:'lynx'}];
 const upgraded=importPlanner({...p,version:7});
 assert.ok(upgraded&&isPlanner(upgraded));
 assert.equal(upgraded.distribution.chargerAssignments[0].slot,null);
 assert.ok(distributionIssues(upgraded).some(w=>w.message.includes('no free fuse position')));
});
test('moving a charger to unfused busbar frees Lynx slot',()=>{
 const p=setup();
 p.charging.mppt=[newPlannedUnit('smartsolar-100-30','mppt')];
 p.distribution.chargerAssignments=[{chargerId:'mppt',destinationId:'lynx',slot:2}];
 assert.ok(occupiedSlots(p.distribution,'lynx').has(2));
 p.distribution.chargerAssignments=[{chargerId:'mppt',destinationId:'bus',slot:null}];
 assert.equal(occupiedSlots(p.distribution,'lynx').size,0);
 assert.equal(firstFreeSlot(p.distribution,'lynx'),1);
 assert.ok(validDistribution(p.distribution,p));
});
test('backfill chooses existing free slots and avoids duplicates even if slots supplied',()=>{
 const p=setup();
 p.distribution.dcAssignments=[attach('branch','lynx','node','fuse',1)];
 p.distribution.chargerAssignments=[
  {chargerId:'a',destinationId:'lynx',slot:2},
  {chargerId:'b',destinationId:'lynx',slot:2},
  {chargerId:'c',destinationId:'bus',slot:null},
 ];
 const fixed=backfillChargeSlots(p.distribution);
 assert.deepEqual(fixed.chargerAssignments.map(a=>a.slot),[2,3,null]);
});
