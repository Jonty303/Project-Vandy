import type { Circuit, Component, ElectricalPort, Evidence, Load, ModeUsage, OperatingMode, Project } from '../domain/model.ts';
import { newBattery } from '../domain/batteries.ts';
import { vandyCommunicationPorts, vandyAuthorities } from '../domain/connectivity.ts';

const profiles = [
  { id: 'normal', name: 'Normal day', description: 'Evening lighting, refrigeration and routine use' },
  { id: 'working', name: 'Working from van', description: 'Laptops, Starlink and daytime electricity' },
  { id: 'winter', name: 'Winter day', description: 'Short daylight and diesel heating' },
];
const component = (id: string, name: string, kind: Component['kind'], model?: string, notes?: string, evidence?: Evidence): Component => ({ id, name, kind, model, notes, evidence });
const channels = (prefix: string, count: number) => Array.from({ length: count }, (_, n) => ({ id: `${prefix}-${n + 1}`, label: `Channel ${n + 1}` }));
const usage = (normal: number, working = normal, winter = normal, duty = 1): Record<string, ModeUsage> => ({
  normal: { minutesPerDay: normal, dutyFraction: duty },
  working: { minutesPerDay: working, dutyFraction: duty },
  winter: { minutesPerDay: winter, dutyFraction: duty },
});
const mode = (id: string, name: string, watts: number | null, evidence: Evidence, normal: number, working = normal, winter = normal, duty = 1): OperatingMode => ({ id, name, watts, evidence, usage: usage(normal,working,winter,duty) });
const load = (id: string, name: string, circuitId: string, kind: Load['kind'], modes: OperatingMode[], componentId?: string, notes?: string): Load => ({ id,name,circuitId,kind,modes,componentId,notes });

const originalComponents: Component[] = [
  {...component('battery', 'WattCycle LiFePO₄ battery', 'battery', '280Ah', 'Existing 12V battery; current usable capacity not verified', 'reported'), voltage:12, hazards:['electrical-fire']},
  {...component('lynx', 'Victron Lynx Distributor', 'distribution','Lynx Distributor','Main DC distribution', 'reported'), voltage:12},
  {...component('blue-sea','Blue Sea ST Blade fuse block','distribution','5026','12 fused outputs, integrated negative bus', 'reported'), voltage:12, outputs:channels('fuse',12)},
  {...component('remote-six','Generic 6-way remote control box','controller',undefined,'Six channels, input positive/negative and reported chassis/earth connection; actual internal protection and switching unverified','unknown'), voltage:12, outputs:channels('remote',6)},
  {...component('votronic-1','Votronic rocker switch 1','switch',undefined,'Illuminated panel switch; exact rating unknown','unknown'), voltage:12},
  {...component('votronic-2','Votronic rocker switch 2','switch',undefined,'Illuminated panel switch; exact rating unknown','unknown'), voltage:12},
  {...component('usb-panel-1','USB charging panel 1','usb-charger',undefined,'2× USB-A QC3.0 + 2× USB-C PD; 108W online product match not verified','listing'),voltage:'12/24'},
  {...component('usb-panel-2','USB charging panel 2','usb-charger',undefined,'2× USB-A QC3.0 + 2× USB-C PD; 108W online product match not verified','listing'),voltage:'12/24'},
  {...component('fridge-unit','CR65X compressor fridge','appliance','CR65X','60W rated, 12/24V DC; manual supplied','manual'),voltage:'12/24'},
  {...component('diesel-heater','VEVOR diesel air heater','appliance','XMZ-F-D1 (provisional)','12V 40W listed; startup capacity 15–20A is not a measured draw','manual'),voltage:12,hazards:['carbon-monoxide','combustion-exhaust','electrical-fire']},
  {...component('water-heater','Generic LPG water heater','appliance',undefined,'12V 5A electrical input per supplied manual; LPG thermal input; brand unknown','manual'),voltage:12,hazards:['carbon-monoxide','combustion-exhaust','lpg','water-leak']},
  {...component('solar','Existing roof solar panel','solar',undefined,'Approximately 400–480W observed; exact nameplate unknown','reported')},
  {...component('mppt','Victron SmartSolar MPPT','mppt','100/50',undefined,'reported'),voltage:12},
  {...component('orion','Victron Orion XS','dc-dc','12/12-50',undefined,'reported'),voltage:12},
  {...component('multiplus','Victron MultiPlus','inverter','12/500/20','AC and DC; explicit standby consumption unverified','reported'),voltage:12},
  {...component('smartshunt','Victron SmartShunt','monitor',undefined,undefined,'reported'),voltage:12},
  {...component('cerbo','Victron Cerbo GX','monitor',undefined,undefined,'reported'),voltage:12},
];


const ac = (id: string, label: string, direction: 'input' | 'output'): ElectricalPort => ({id,label,direction,system:'ac',voltage:230,conductors:['L','N','PE']});
const dc = (id: string, label: string, direction: 'input' | 'output'): ElectricalPort => ({id,label,direction,system:'dc',voltage:12,conductors:['DC+','DC-','CHASSIS']});
// Ports represent grouped interfaces, never physical cable runs or an electrical safety verdict.
const portMap: Record<string,ElectricalPort[]> = {
  battery:[dc('dc-out','Battery DC terminals','output')],
  lynx:[dc('dc-in','DC input/bus','input'),dc('dc-out','DC distribution bus','output')],
  'remote-six':[dc('dc-in','DC input and separate chassis interface','input')],
  'blue-sea':[dc('dc-in','Fuse-block DC input','input')],
  multiplus:[ac('ac-in','AC shore input','input'),ac('ac-out','AC output','output'),dc('dc-in','DC inverter input','input')]
};
const components: Component[] = [
  ...originalComponents.map(c=>portMap[c.id] ? {...c,ports:portMap[c.id]} : c),
  {...component('shore-inlet','16A shore inlet','shore-inlet',undefined,'230V shore connection; physical wiring unverified','reported'),voltage:'230',ports:[ac('ac-out','Shore feed','output')],hazards:['electric-shock']},
  {...component('cu-shore','CU-01 — Shore protection','consumer-unit',undefined,'Separate consumer unit protecting incoming shore power; devices/rating unverified','reported'),voltage:'230',ports:[ac('ac-in','AC input','input'),ac('ac-out','Protected AC output','output')],hazards:['electric-shock']},
  {...component('cu-sockets','CU-02 — Socket distribution','consumer-unit',undefined,'Separate consumer unit protecting outgoing sockets; breaker allocation unknown','reported'),voltage:'230',ports:[ac('ac-in','AC input','input'),ac('ac-out','Socket distribution (logical)','output')],hazards:['electric-shock']},
  {...component('kitchen-socket','Kitchen double socket','socket-outlet',undefined,'Two socket positions; gas hob igniter uses one','reported'),voltage:'230',ports:[ac('ac-in','230V supply','input')],socketPositions:[{id:'left',label:'Socket 1'},{id:'right',label:'Socket 2'}],hazards:['electric-shock']},
  {...component('garage-socket','Garage single socket','socket-outlet',undefined,'230V socket; circuit and protection unverified','reported'),voltage:'230',ports:[ac('ac-in','230V supply','input')],socketPositions:[{id:'only',label:'Socket 1'}],hazards:['electric-shock']},
  {...component('maxxair-vent','Maxxair / Airxcel roof vent','appliance',undefined,'Model and current still to confirm','reported'),voltage:12},
];

const circuits: Circuit[] = [
  {id:'refrigeration',name:'Refrigeration',supply:'dc',voltage:12},
  {id:'floor-lighting',name:'Floor lighting',supply:'dc',voltage:12},
  {id:'toilet',name:'Toilet',supply:'dc',voltage:12,notes:'Toilet light and flush share a physical circuit; precise feed and protection unknown.'},
  {id:'water',name:'Water pump',supply:'dc',voltage:12},
  {id:'diesel-heating',name:'Diesel heater',supply:'dc',voltage:12},
  {id:'hot-water',name:'LPG water heater controls',supply:'dc',voltage:12},
  {id:'ventilation',name:'Ventilation',supply:'dc',voltage:12},
  {id:'communications',name:'Communications',supply:'dc',voltage:12},
  {id:'usb-charging',name:'USB charging',supply:'dc',voltage:12},
  {id:'ac-sockets',name:'Inverter-powered sockets',supply:'ac-inverter',voltage:230,sourceComponentId:'cu-sockets',notes:'Logical distribution feed only. Inverter AC OUT feeds CU-02 in the proposed topology.'},
  {id:'inverter-idle',name:'Inverter operating overhead',supply:'dc',voltage:12},
  {id:'kitchen-lighting',name:'Kitchen lighting (logical)',supply:'dc',voltage:12,notes:'Actual fuse/switch unknown'},
  {id:'main-lighting',name:'Main lighting (logical)',supply:'dc',voltage:12,notes:'Actual fuse/switch unknown'},
  {id:'outside-lighting',name:'Outside lighting (logical)',supply:'dc',voltage:12,notes:'Actual fuse/switch unknown'},
  {id:'garage-lighting',name:'Garage lighting (logical)',supply:'dc',voltage:12,notes:'Actual fuse/switch unknown'},
];

const loads: Load[] = [
  load('fridge','CR65X fridge','refrigeration','compressor',[mode('compressor','Compressor running',60,'manual',1440,1440,1440,0.35)],'fridge-unit','35% duty cycle is a starting assumption; not measured.'),
  {...load('floor-led','Floor LED strips','floor-lighting','led-strip',[mode('on','Lights on',null,'unknown',300,300,420)],undefined,'Set actual installed metres and W/m; 9.6W/m is provisional.'),led:{lengthMetres:null,wattsPerMetre:9.6,brightnessFraction:1,evidence:'estimated'}},
  load('toilet-light','Toilet light','toilet','standard',[mode('on','On',1,'estimated',4,4,4)],undefined,'1W placeholder; confirm lamp specification.'),
  load('toilet-flush','Toilet flush','toilet','standard',[mode('active','Flushing',null,'unknown',2,2,2)],undefined,'Shared circuit with toilet light; consumption to be measured.'),
  load('water-pump','Fresh water pump','water','standard',[mode('running','Pumping',null,'unknown',10,10,10)]),
  load('diesel-heater','VEVOR XMZ-F-D1 diesel heater','diesel-heating','multi-state',[
    mode('ignition','Startup/glow plug',null,'unknown',0,0,5),
    mode('heating','Running',40,'manual',0,0,360),
    mode('cooldown','Shutdown cooldown',null,'unknown',0,0,5)
  ],'diesel-heater','40W manufacturer rating; startup current and time are not confirmed measurements.'),
  load('gas-water-heater','LPG water heater electronics','hot-water','standard',[mode('active','Heating water',60,'manual',10,10,10)],'water-heater','60W derived from manufacturer 12V × 5A input rating; energy profile assumed.'),
  load('extractor','Maxxair / Airxcel roof vent','ventilation','standard',[mode('running','Running',null,'unknown',30,60,15)],'maxxair-vent','Exact Maxxair model and fan-speed power unknown.'),
  load('starlink','Starlink (230V adapter)','ac-sockets','standard',[mode('on','Online',null,'unknown',120,480,120)],undefined,'Runs via inverter in Vandy; input watts still unknown.'),
  load('usb-1','USB charging panel 1','usb-charging','standard',[mode('charging','Charging devices',null,'unknown',60,120,60)],'usb-panel-1','Enter actual input draw; do not double count devices powered through these ports.'),
  load('usb-2','USB charging panel 2','usb-charging','standard',[mode('charging','Charging devices',null,'unknown',60,120,60)],'usb-panel-2'),
  load('laptop-shared','Shared laptop charger — 80W','ac-sockets','standard',[mode('charging','Charging',80,'reported',60,360,120)],undefined,'One shared 80W rated 230V charger; actual draw varies.'),
  load('kitchen-light','Kitchen light','kitchen-lighting','standard',[mode('on','On',null,'unknown',120,90,180)]),
  load('main-light','Main light','main-lighting','standard',[mode('on','On',null,'unknown',120,90,180)]),
  load('outside-light','Outside light','outside-lighting','standard',[mode('on','On',null,'unknown',20,20,30)]),
  load('garage-light','Garage light','garage-lighting','standard',[mode('on','On',null,'unknown',20,20,30)]),
  load('hob-igniter','Gas hob electric igniter','ac-sockets','standard',[mode('ignition','Ignition',null,'unknown',2,2,2)],undefined,'Plugs into kitchen double socket. Actual electrical input unknown.'),
  load('inverter-standby','MultiPlus idle consumption','inverter-idle','standard',[mode('idle','Idle',null,'unknown',0,480,0)],'multiplus','Do not assume standby loss until rated/measured.'),
];

export const seedProject: Project = {
  schemaVersion:3,
  name:'Vandy — existing electrical installation',
  nominalBatteryVoltage:12,
  batteryCapacityAh:280,
  inverterEfficiency:0.9,
  acOperatingMode:'inverter',
  profiles,
  components,
  circuits,
  loads,

  topologyLinks:[
    {id:'shore-to-cu',fromComponentId:'shore-inlet',fromPortId:'ac-out',toComponentId:'cu-shore',toPortId:'ac-in',status:'proposed',notes:'Conceptual only, not verified wiring'},
    {id:'cu-to-multiplus',fromComponentId:'cu-shore',fromPortId:'ac-out',toComponentId:'multiplus',toPortId:'ac-in',status:'proposed',notes:'Protective devices and transfer topology unverified'},
    {id:'multiplus-to-cu',fromComponentId:'multiplus',fromPortId:'ac-out',toComponentId:'cu-sockets',toPortId:'ac-in',status:'proposed',notes:'Conceptual inverter-backed outlet supply'},
    {id:'cu-to-kitchen',fromComponentId:'cu-sockets',fromPortId:'ac-out',toComponentId:'kitchen-socket',toPortId:'ac-in',status:'proposed',notes:'Physical breaker and wiring unknown'},
    {id:'cu-to-garage',fromComponentId:'cu-sockets',fromPortId:'ac-out',toComponentId:'garage-socket',toPortId:'ac-in',status:'proposed',notes:'Physical breaker and wiring unknown'},
    {id:'lynx-to-remote',fromComponentId:'lynx',fromPortId:'dc-out',toComponentId:'remote-six',toPortId:'dc-in',status:'reported',notes:'Owner reports +, − and an earth connection; actual protective bonding unverified'},
  ],
  protectionDevices:[
    {id:'shore-rcd',consumerUnitId:'cu-shore',name:'Shore RCD (details unknown)',kind:'rcd',ratedCurrentA:null,residualTripMa:null,protectedCircuitIds:[],evidence:'unknown'},
    {id:'shore-mcb',consumerUnitId:'cu-shore',name:'Shore breaker (details unknown)',kind:'mcb',ratedCurrentA:null,residualTripMa:null,protectedCircuitIds:[],evidence:'unknown'},
    {id:'sockets-rcd',consumerUnitId:'cu-sockets',name:'Socket RCD (details unknown)',kind:'rcd',ratedCurrentA:null,residualTripMa:null,protectedCircuitIds:[],evidence:'unknown'},
    {id:'sockets-mcb-1',consumerUnitId:'cu-sockets',name:'Socket breaker 1 (unknown)',kind:'mcb',ratedCurrentA:null,residualTripMa:null,protectedCircuitIds:[],evidence:'unknown'},
    {id:'sockets-mcb-2',consumerUnitId:'cu-sockets',name:'Socket breaker 2 (unknown)',kind:'mcb',ratedCurrentA:null,residualTripMa:null,protectedCircuitIds:[],evidence:'unknown'},
  ],
  socketAssignments:[
    {id:'hob-kitchen',socketComponentId:'kitchen-socket',positionId:'left',loadId:'hob-igniter',evidence:'reported'},
  ],
  batteries:[{
    ...newBattery('battery-wattcycle'),
    name:'WattCycle 280Ah habitation battery',
    componentId:'battery',manufacturer:'WattCycle',model:'280Ah LiFePO₄ (exact variant unconfirmed)',
    chemistry:'lifepo4',nominalVoltageV:12,capacityAh:280,evidence:'reported',
    bms:{...newBattery('x').bms,integrated:'yes',bluetooth:'yes',vendorApp:'WattCycle app',
      cellVoltageMonitoring:'yes',externalManagement:'unverified',
      protectionNotes:'Owner-reported Bluetooth BMS and cell readings. No documented external Cerbo management interface.'},
    thermal:{...newBattery('x').thermal,selfHeating:'unknown',lowTemperatureChargeCutoff:'unknown'},
    notes:'Exact manufacturer variant, terminal layout and thermal/heating capabilities need documentation. Bluetooth is vendor-app-only by default.'
  }],
  batteryBanks:[{id:'habitation-bank',name:'Habitation bank',strings:[['battery-wattcycle']],notes:'One owner-reported 12V 280Ah battery. Physical cabling/series/parallel configuration remains unverified.'}],
  activeBatteryBankId:'habitation-bank',
  communicationPorts:vandyCommunicationPorts,
  communicationConnections:[],
  monitoringAuthorities:vandyAuthorities,
  auxiliaryAssignments:[],
  diagramPositions:[],
};
