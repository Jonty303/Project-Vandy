import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProject } from '../src/data/vandy.ts';
import { migrateProject, validateProject } from '../src/domain/storage.ts';

test('PE busbar is an unconnected planning placeholder, not an installed bond',()=>{
  const p=structuredClone(seedProject);
  const bar=p.components.find(c=>c.id==='pe-busbar');
  assert.ok(bar);
  assert.equal(bar.kind,'busbar');
  assert.equal(bar.busbarFunction,'PE');
  assert.equal(bar.evidence,'unknown');
  assert.equal(bar.ports?.length??0,0);
  assert.equal(p.topologyLinks.some(l=>l.fromComponentId===bar.id||l.toComponentId===bar.id),false);
  assert.equal(p.dcWiring.cables.some(c=>c.fromComponentId===bar.id||c.toComponentId===bar.id),false);
  assert.ok(validateProject(p));
});

test('existing Vandy v3 data gains PE placeholder without changing installed relationships',()=>{
  const p=structuredClone(seedProject);
  const before=structuredClone(p.topologyLinks);
  const wiring=structuredClone(p.dcWiring);
  p.components=p.components.filter(c=>c.id!=='pe-busbar');
  assert.ok(validateProject(p));
  const migrated=migrateProject(p);
  assert.ok(migrated);
  assert.equal(migrated.components.filter(c=>c.id==='pe-busbar').length,1);
  assert.deepEqual(migrated.topologyLinks,before);
  assert.deepEqual(migrated.dcWiring,wiring);
  assert.equal(migrateProject(migrated).components.filter(c=>c.id==='pe-busbar').length,1);
});
