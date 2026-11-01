import type { Circuit, Component, Evidence, Load, ModeUsage, OperatingMode, Project } from '../domain/model.ts';

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

const components: Component[] = [
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
  {id:'ac-sockets',name:'Inverter-powered sockets',supply:'ac-inverter',voltage:230},
  {id:'inverter-idle',name:'Inverter operating overhead',supply:'dc',voltage:12},
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
  load('extractor','Roof extractor fan','ventilation','standard',[mode('running','Running',null,'unknown',30,60,15)]),
  load('starlink','Starlink','communications','standard',[mode('on','Online',null,'unknown',120,480,120)]),
  load('usb-1','USB charging panel 1','usb-charging','standard',[mode('charging','Charging devices',null,'unknown',60,120,60)],'usb-panel-1','Enter actual input draw; do not double count devices powered through these ports.'),
  load('usb-2','USB charging panel 2','usb-charging','standard',[mode('charging','Charging devices',null,'unknown',60,120,60)],'usb-panel-2'),
  load('laptop-one','Laptop charger 1','ac-sockets','standard',[mode('charging','Charging',65,'estimated',0,480,0)],undefined,'65W adapter rating is a planning estimate; actual draw varies.'),
  load('laptop-two','Laptop charger 2','ac-sockets','standard',[mode('charging','Charging',65,'estimated',0,480,0)],undefined,'65W planning estimate; verify actual charger.'),
  load('inverter-standby','MultiPlus idle consumption','inverter-idle','standard',[mode('idle','Idle',null,'unknown',0,480,0)],'multiplus','Do not assume standby loss until rated/measured.'),
];

export const seedProject: Project = {
  schemaVersion:1,
  name:'Vandy — existing electrical installation',
  nominalBatteryVoltage:12,
  batteryCapacityAh:280,
  inverterEfficiency:0.9,
  profiles,
  components,
  circuits,
  loads,
};
