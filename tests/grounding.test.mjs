import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProject } from '../src/data/vandy.ts';
import { checkGroundingLink, validateGrounding } from '../src/domain/grounding.ts';
import { migrateProject, validateProject } from '../src/domain/storage.ts';

const seed=()=>structuredClone(seedProject);

test('Vandy has a front busbar with a separate rear-pillar PE attachment point',()=>{
  const p=seed();
  assert.equal(p.components.find(c=>c.id==='front-earth-busbar').kind,'bonding-busbar');
  assert.equal(p.components.find(c=>c.id==='front-chassis-ground').kind,'ground-point');
  assert.equal(p.components.find(c=>c.id==='rear-pillar-ground').kind,'ground-point');
  assert.deepEqual((p.groundingConnections??[]).map(c=>[c.fromComponentId,c.toComponentId]),[
    ['lynx','front-earth-busbar'],
    ['front-earth-busbar','front-chassis-ground'],
    ['cu-shore','rear-pillar-ground'],
    ['cu-sockets','rear-pillar-ground']
  ]);
  assert.equal(validateGrounding(p).length,0);
  assert.ok(validateProject(p));
});

test('the chassis earth topology does not infer DC negative or neutral bonds',()=>{
  const p=seed();
  assert.ok((p.groundingConnections??[]).every(c=>!c.fromTerminalId.includes('dc-')&&!c.toTerminalId.includes('dc-')));
  assert.ok(!(p.groundingConnections??[]).some(c=>c.fromComponentId==='smartshunt'||c.fromComponentId==='battery'));
  const bad={id:'bad',fromComponentId:'cu-shore',fromTerminalId:'pe',
    toComponentId:'front-earth-busbar',toTerminalId:'bond',kind:'chassis-bond'};
  assert.ok(checkGroundingLink(p,bad).some(e=>e.includes('Chassis bonds')));
});

test('changing a single grounding destination persists while others remain unchanged',()=>{
  const p=seed();
  p.groundingConnections[1].toComponentId='rear-pillar-ground';
  const migrated=migrateProject(p);
  assert.ok(migrated);
  assert.equal(migrated.groundingConnections[1].toComponentId,'rear-pillar-ground');
  assert.equal(migrated.groundingConnections[0].toComponentId,'front-earth-busbar');
});

test('saved v3 projects gain reported grounding without losing existing loads',()=>{
  const p=seed();
  const before=structuredClone(p.loads);
  delete p.groundingConnections;
  p.components=p.components.filter(c=>!['front-earth-busbar','front-chassis-ground','rear-pillar-ground'].includes(c.id))
    .map(c=>{delete c.groundingTerminals;return c;});
  const migrated=migrateProject(p);
  assert.ok(migrated);
  assert.deepEqual(migrated.loads,before);
  assert.equal(migrated.groundingConnections.length,4);
  assert.equal(validateGrounding(migrated).length,0);
});
