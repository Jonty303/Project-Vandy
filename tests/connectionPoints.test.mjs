import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankPlanner,newCircuit,newLoad,plannerTotal,isPlanner,importPlanner} from '../src/domain/loadPlanner.ts';
import {newSocket,validConnections,plannedConsumerUnits,connectionIssues,normaliseConnections,connectedSocket} from '../src/domain/connectionPoints.ts';
const circuit=(p,voltage)=>{const c=newCircuit();c.voltage=voltage;c.name='Test';p.circuits.push(c);return c;};
const appliance=(p,voltage,name)=>{const l=newLoad({name,category:'standard',voltage,watts:50,hours:2,basis:'Test'});p.loads.push(l);return l;};
test('connection points are separate from energy loads',()=>{
 const p=blankPlanner(),c=circuit(p,12),a=appliance(p,12,'Phone'),b=appliance(p,12,'Tablet');
 const before=plannerTotal(p).wh;
 p.connections.sockets=[newSocket('usb',c.id,2,'u')];
 p.connections.loadSocketLinks=[{loadId:a.id,socketId:'u'},{loadId:b.id,socketId:'u'}];
 assert.equal(plannerTotal(p).wh,before);assert.equal(connectedSocket(p,a.id)?.id,'u');assert.ok(isPlanner(p));
 p.connections.loadSocketLinks.push({loadId:a.id,socketId:'u'});
 assert.equal(validConnections(p.connections,p),false);
});
test('single and double 3-pin outlets require inverter output group but consume no Wh',()=>{
 const p=blankPlanner(),c=circuit(p,230);const l=appliance(p,230,'Starlink');
 p.connections.sockets=[newSocket('uk-3pin',c.id,1,'one'),newSocket('uk-3pin',c.id,2,'two')];
 assert.equal(plannerTotal(p).wh,100);
 assert.deepEqual(plannedConsumerUnits(p).map(u=>u.id),['inverter-output']);
 assert.ok(connectionIssues(p).some(i=>i.message.includes('no selected inverter')));
 p.distribution.standaloneInverterId='phoenix-12-500';
 p.distribution.acAssignments=[{targetType:'circuit',targetId:c.id}];
 assert.equal(connectionIssues(p).filter(i=>i.id==='one'||i.id==='two').length,0);
 assert.equal(l.voltage,230);
});
test('shore charging and shore inlet derive one independent shore consumer unit',()=>{
 const p=blankPlanner();p.charging.shoreModelId='ip22-12-30';
 assert.deepEqual(plannedConsumerUnits(p).map(u=>u.id),['shore-input']);
 assert.ok(connectionIssues(p).some(i=>i.id==='shore-inlet'));
 p.connections.shoreInlet={id:'shore',name:'External 230V inlet'};
 assert.ok(isPlanner(p));assert.equal(connectionIssues(p).filter(i=>i.id==='shore-inlet').length,0);
 const c=circuit(p,230);p.connections.sockets.push(newSocket('uk-3pin',c.id,2,'sockets'));
 assert.deepEqual(plannedConsumerUnits(p).map(u=>u.id),['shore-input','inverter-output']);
});
test('orphaned socket links clear when circuit or load is deleted',()=>{
 const p=blankPlanner(),c=circuit(p,12),l=appliance(p,12,'Phone');
 p.connections.sockets=[newSocket('usb',c.id,1,'u')];
 p.connections.loadSocketLinks=[{loadId:l.id,socketId:'u'}];
 p.circuits=[];const n=normaliseConnections(p);
 assert.deepEqual(n.connections.sockets,[]);assert.deepEqual(n.connections.loadSocketLinks,[]);
 assert.ok(isPlanner(n));
});
test('v8 saved configuration migrates to v9 retaining battery, loads, chargers',()=>{
 const p=blankPlanner();p.batteryId='mini-280';const l=appliance(p,230,'Laptop');
 const old={...p,version:8};delete old.connections;
 const newer=importPlanner(old);assert.ok(newer&&isPlanner(newer));
 assert.equal(newer.version,9);assert.equal(newer.batteryId,'mini-280');
 assert.equal(newer.loads[0].id,l.id);assert.deepEqual(newer.connections.sockets,[]);
});
