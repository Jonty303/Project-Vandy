import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyCharging,validCharging,deviceCatalogue,findModel,chargingWarnings,panelArray,plannedInverter,
} from '../src/domain/charging.ts';

const use=(modelId,id=modelId)=>({id,modelId});
test('charging starts as planning-only, with no devices and an editable 30A alternator allowance',()=>{
  const plan=emptyCharging();
  assert.equal(validCharging(plan),true);
  assert.equal(plan.spareAlternatorAmps,30);
  assert.equal(plan.alternatorVoltage,12);
  assert.equal(plan.panel.watts,null);
  assert.equal(plan.panel.quantity,1);
  assert.equal(plan.panel.connection,'parallel');
  assert.equal(plan.panel.voc,null);
  assert.equal(plan.panel.isc,null);
  assert.deepEqual(plan.dc2dc,[]);
  assert.deepEqual(plan.mppt,[]);
  assert.equal(plan.shoreModelId,null);
  assert.equal(plannedInverter(plan),null);
});
test('model catalogue has distinct 12/24 V selections and manufacturer source links',()=>{
  const groups=new Set(deviceCatalogue.map(m=>m.kind));
  assert.deepEqual([...groups].sort(),['dc2dc','inverterCharger','mppt','shoreCharger']);
  assert.ok(deviceCatalogue.some(m=>m.manufacturer==='Renogy'&&m.kind==='dc2dc'));
  assert.ok(deviceCatalogue.some(m=>m.manufacturer==='Renogy'&&m.kind==='mppt'));
  assert.ok(deviceCatalogue.some(m=>m.kind==='inverterCharger'&&m.outputVoltages.includes(24)));
  assert.ok(deviceCatalogue.some(m=>m.kind==='shoreCharger'&&m.outputVoltages.includes(24)));
  assert.equal(deviceCatalogue.every(m=>m.sourceUrl.startsWith('https://')),true);
  assert.equal(findModel('orion-xs-12-12-50')?.chargeAmps,50);
  assert.equal(findModel('multiplus-24-800-16')?.inverterVA,800);
});
test('multiple DC–DC chargers share the same spare alternator source budget',()=>{
  const c=emptyCharging();
  c.dc2dc=[use('orion-xs-12-12-50','unit1'),use('orion-tr-12-12-30','unit2')];
  assert.equal(validCharging(c),true);
  assert.ok(chargingWarnings(c,12).some(x=>x.area==='dc2dc'&&x.message.includes('exceeds')));
  c.spareAlternatorAmps=100;
  assert.equal(chargingWarnings(c,12).some(x=>x.message.includes('exceeds')),false);
  c.alternatorVoltage=24;
  assert.equal(chargingWarnings(c,12).filter(x=>x.message.includes('expects')).length,2);
});
test('DC–DC output voltage mismatch is warned, rather than changing planned battery voltage',()=>{
  const c=emptyCharging();c.dc2dc=[use('orion-tr-12-24-15')];
  assert.equal(chargingWarnings(c,12).some(w=>w.message.includes('planned battery is 12 V')),true);
  assert.equal(chargingWarnings(c,24).some(w=>w.message.includes('planned battery is 12 V')),false);
});
test('solar generic watts, quantity and series/parallel affect PV calculations',()=>{
  const c=emptyCharging();
  c.panel={watts:200,quantity:3,connection:'series',voc:41,isc:7};
  assert.deepEqual(panelArray(c.panel),{watts:600,voc:123,isc:7});
  c.panel.connection='parallel';
  assert.deepEqual(panelArray(c.panel),{watts:600,voc:41,isc:21});
});
test('MPPT validation checks nominated panel Voc and Isc and nominal PV power',()=>{
  const c=emptyCharging();
  c.mppt=[use('smartsolar-100-30')];
  c.panel={watts:200,quantity:3,connection:'series',voc:41,isc:7};
  const warnings=chargingWarnings(c,12);
  assert.ok(warnings.some(w=>w.message.includes('PV Voc limit')));
  assert.ok(warnings.some(w=>w.message.includes('nominal PV power')));
  c.panel={watts:100,quantity:4,connection:'parallel',voc:40,isc:10};
  assert.ok(chargingWarnings(c,12).some(w=>w.message.includes('short-circuit-current limit')));
  c.panel={watts:100,quantity:1,connection:'parallel',voc:null,isc:null};
  assert.ok(chargingWarnings(c,12).some(w=>w.message.includes('panel Voc and Isc')));
});
test('multiple MPPT units do not implicitly receive the same entire solar array',()=>{
  const c=emptyCharging();c.mppt=[use('smartsolar-100-30','a'),use('renogy-rover-40','b')];
  assert.equal(validCharging(c),true);
  assert.ok(chargingWarnings(c,12).some(w=>w.message.includes('allocation')));
  c.mppt[1].id='a';
  assert.equal(validCharging(c),false,'duplicate instance id not allowed');
});
test('shore-only charger does not become inverter; inverter/charger supplies a future prefill reference',()=>{
  const c=emptyCharging();
  c.shoreModelId='ip22-12-30';
  assert.equal(plannedInverter(c),null);
  assert.equal(chargingWarnings(c,12).filter(w=>w.area==='shore').length,0);
  c.shoreModelId='multiplus-24-800-16';
  assert.equal(plannedInverter(c)?.id,'multiplus-24-800-16');
  assert.equal(chargingWarnings(c,12).some(w=>w.area==='shore'),true);
  assert.equal(chargingWarnings(c,24).some(w=>w.area==='shore'),false);
});
test('invalid catalog ids and solar specifications block saving; electrical mismatches do not',()=>{
  const c=emptyCharging();
  c.dc2dc=[use('not-in-catalogue')];
  assert.equal(validCharging(c),false);
  c.dc2dc=[];
  c.panel.quantity=0;assert.equal(validCharging(c),false);
  c.panel.quantity=2;c.panel.watts=-50;assert.equal(validCharging(c),false);
  c.panel.watts=null;assert.equal(validCharging(c),true);
  c.shoreModelId='bad-model';assert.equal(validCharging(c),false);
  c.shoreModelId='ip22-24-16';assert.equal(validCharging(c),true);
  assert.ok(chargingWarnings(c,12).length>0,'voltage mismatch is a warning, not a schema failure');
});
