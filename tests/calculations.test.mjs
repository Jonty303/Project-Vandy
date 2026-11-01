import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLoad, calculateProject, ledRatedWatts } from '../src/domain/calculations.ts';
import { validateProject } from '../src/domain/storage.ts';
import { seedProject } from '../src/data/vandy.ts';

const demo = structuredClone(seedProject);
const profile = 'normal';

test('sample project validates', () => assert.equal(validateProject(demo), true));
test('a malformed import fails validation', () => assert.equal(validateProject({schemaVersion:1}), false));
test('CR65X 60W, 24h, 35% duty is 504Wh', () => {
  const load = demo.loads.find(l => l.id === 'fridge');
  const circuit = demo.circuits.find(c => c.id === load.circuitId);
  const result = calculateLoad(load, circuit, demo, profile);
  assert.ok(Math.abs(result.deliveredWh - 504) < 1e-8);
  assert.ok(Math.abs(result.batteryWh - 504) < 1e-8);
  assert.equal(result.peakWatts, 60);
});
test('LED strips calculate per metre, brightness discounts energy not peak', () => {
  const load = structuredClone(demo.loads.find(l => l.id === 'floor-led'));
  load.led.lengthMetres = 2.5;
  load.led.wattsPerMetre = 9.6;
  load.led.brightnessFraction = 0.5;
  const circuit = demo.circuits.find(c => c.id === load.circuitId);
  assert.equal(ledRatedWatts(load), 24);
  assert.equal(calculateLoad(load, circuit, demo, profile).deliveredWh, 60);
  assert.equal(calculateLoad(load, circuit, demo, profile).peakWatts, 24);
});
test('24V battery with direct 12V circuit requires converter and excludes unverified battery draw', () => {
  const project = structuredClone(demo);
  project.nominalBatteryVoltage = 24;
  const load = project.loads.find(l => l.id === 'fridge');
  const circuit = project.circuits.find(c => c.id === 'refrigeration');
  const result = calculateLoad(load, circuit, project, profile);
  assert.equal(result.incomplete, true);
  assert.equal(result.batteryWh, 0);
  assert.ok(Math.abs(result.deliveredWh - 504) < 1e-8);
});
test('AC inverter load applies conversion loss while AC shore load does not draw battery', () => {
  const p = structuredClone(demo);
  const load = structuredClone(p.loads.find(l => l.id === 'fridge'));
  load.modes[0].usage.normal = {minutesPerDay:60,dutyFraction:1};
  const c = {id:'ac',name:'AC',supply:'ac-inverter',voltage:230};
  assert.ok(Math.abs(calculateLoad(load,c,p,profile).batteryWh - 60/p.inverterEfficiency) < 0.0001);
  c.supply = 'ac-shore';
  assert.equal(calculateLoad(load,c,p,profile).batteryWh, 0);
});
test('missing active power ratings produce partial totals and explicit warnings', () => {
  const result = calculateProject(demo,'normal');
  assert.ok(result.incompleteLoads.includes('Toilet flush'));
  assert.ok(result.warnings.some(w => /partial/.test(w)));
  assert.ok(Number.isFinite(result.batteryWh));
});
test('invalid usage is flagged not silently calculated', () => {
  const load = structuredClone(demo.loads.find(l => l.id === 'fridge'));
  load.modes[0].usage.normal.minutesPerDay = 2000;
  const circuit = demo.circuits.find(c => c.id === 'refrigeration');
  assert.equal(calculateLoad(load,circuit,demo,profile).incomplete,true);
});
