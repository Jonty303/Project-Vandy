import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProject } from '../src/data/vandy.ts';
import { defaultTerminals, hydrateCableTerminals, validateTerminals } from '../src/domain/terminals.ts';
import { migrateProject, validateProject } from '../src/domain/storage.ts';
import { validateGrounding } from '../src/domain/grounding.ts';

const clone=()=>structuredClone(seedProject);
const run=(p,id)=>p.dcWiring.cables.find(c=>c.id===id);
const comp=(p,id)=>p.components.find(c=>c.id===id);

test('Vandy has named separate DC poles, SmartShunt sides and distribution outputs',()=>{
 const p=clone();
 assert.equal(comp(p,'smartshunt').terminals.find(t=>t.id==='battery-minus').kind,'dc-negative');
 assert.equal(comp(p,'smartshunt').terminals.find(t=>t.id==='system-minus').kind,'dc-negative');
 assert.ok(comp(p,'lynx').terminals.find(t=>t.id==='output-4-positive'));
 assert.equal(comp(p,'blue-sea').terminals.filter(t=>t.id.startsWith('fuse-')).length,12);
 assert.equal(comp(p,'blue-sea').terminals.filter(t=>t.id.startsWith('return-')).length,12);
 assert.equal(run(p,'battery-shunt').toTerminalId,'battery-minus');
 assert.equal(run(p,'shunt-lynx').fromTerminalId,'system-minus');
 assert.equal(run(p,'lynx-mppt').toTerminalId,'battery-positive');
 assert.equal(run(p,'lynx-multi').toTerminalId,'battery-positive');
 assert.equal(run(p,'orion-ground').toComponentId,undefined);
 assert.ok(comp(p,'orion').terminals.find(t=>t.id==='gnd'));
 assert.deepEqual(validateTerminals(p),[]);
 assert.deepEqual(validateGrounding(p),[]);
 assert.ok(validateProject(p));
});

test('AC L, N and PE are separate physical terminals and not DC negative',()=>{
 const p=clone(),m=comp(p,'multiplus');
 for(const id of ['ac-in-L','ac-in-N','ac-in-PE','ac-out-L','ac-out-N','ac-out-PE'])assert.ok(m.terminals.find(t=>t.id===id));
 assert.equal(m.terminals.find(t=>t.id==='ac-in-PE').kind,'protective-earth');
 assert.notEqual(m.terminals.find(t=>t.id==='ac-in-PE').kind,comp(p,'lynx').terminals.find(t=>t.id==='negative-bus').kind);
 assert.ok(defaultTerminals(comp(p,'mppt')).some(t=>t.id==='pv-positive'));
});

test('DC source/destination terminals survive JSON export and import',()=>{
 const p=clone();
 run(p,'lynx-mppt').fromTerminalId='output-2-positive';
 run(p,'lynx-mppt').toTerminalId='battery-positive';
 const output=JSON.stringify(p,null,2);
 const loaded=migrateProject(JSON.parse(output));
 assert.ok(loaded);
 assert.equal(run(loaded,'lynx-mppt').fromTerminalId,'output-2-positive');
 assert.equal(run(loaded,'lynx-mppt').toTerminalId,'battery-positive');
 assert.equal(validateTerminals(loaded).length,0);
});

test('migration hydrates only original endpoints; preserves user rewiring and custom terminal catalogues',()=>{
 const p=clone();
 for(const c of p.components)delete c.terminals;
 for(const c of p.dcWiring.cables){delete c.fromTerminalId;delete c.toTerminalId;}
 run(p,'lynx-mppt').toComponentId='multiplus'; // Edited destination must not infer MPPT terminal.
 const loaded=migrateProject(p);
 assert.ok(loaded);
 assert.equal(run(loaded,'battery-shunt').toTerminalId,'battery-minus');
 assert.equal(run(loaded,'lynx-mppt').toTerminalId,undefined);
 assert.equal(run(loaded,'lynx-mppt').fromTerminalId,undefined);
 assert.ok(comp(loaded,'lynx').terminals.find(t=>t.id==='negative-bus'));
 const custom=clone();
 comp(custom,'mppt').terminals=[{id:'custom-pv',label:'My terminal',kind:'dc-positive'}];
 assert.deepEqual(migrateProject(custom).components.find(c=>c.id==='mppt').terminals,custom.components.find(c=>c.id==='mppt').terminals);
});

test('invalid polarity/terminal reference is rejected without guessing a substitute',()=>{
 const p=clone();
 run(p,'battery-shunt').toTerminalId='positive-sense';
 assert.ok(validateTerminals(p).some(s=>s.includes('battery-shunt')));
 run(p,'battery-shunt').toTerminalId='no-such-terminal';
 assert.ok(validateTerminals(p).some(s=>s.includes('battery-shunt')));
});

test('switch assignments belong to circuit and persist without changing load profiles',()=>{
 const p=clone();
 const prior=structuredClone(p.loads);
 const circuit=p.circuits.find(c=>c.id==='floor-lighting');
 circuit.switchAssignments=[{id:'switch-a',componentId:'votronic-1'},
   {id:'switch-b',componentId:'remote-six',outputId:'remote-3'}];
 assert.deepEqual(validateTerminals(p),[]);
 const loaded=migrateProject(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(loaded.loads,prior);
 assert.deepEqual(loaded.circuits.find(c=>c.id==='floor-lighting').switchAssignments,circuit.switchAssignments);
 loaded.circuits.find(c=>c.id==='floor-lighting').switchAssignments.push({id:'bad',componentId:'remote-six',outputId:'remote-999'});
 assert.ok(validateTerminals(loaded).some(s=>s.includes('remote-999')));
});
