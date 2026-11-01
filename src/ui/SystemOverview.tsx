import { useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Network, Move, Cable, AlertTriangle } from 'lucide-react';
import type { Component, Project } from '../domain/model.ts';
import { recommendConnections } from '../domain/connectivity.ts';
import { effectiveWiring } from '../domain/dcWiring.ts';

type Layer='ac'|'dc'|'communications';
type Props={project:Project;change:(fn:(p:Project)=>Project)=>void;onOpenDevice?:(id:string)=>void};
type Point={x:number;y:number};
type Edge={id:string;from:string;to:string;status:'proposed'|'reported'|'verified';description:string};
const WIDTH=1730,HEIGHT=1050,NW=205,NH=82;
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
function group(c:Component,layer:Layer):number{
  if(layer==='communications')return c.id==='cerbo'?2:c.kind==='battery'?0:1;
  if(c.kind==='solar'||c.kind==='shore-inlet'||c.kind==='battery')return 0;
  if(['mppt','dc-dc','inverter','monitor'].includes(c.kind))return 1;
  if(['distribution','consumer-unit','controller','switch'].includes(c.kind))return 2;
  return 3;
}
function defaultPosition(c:Component,layer:Layer,groupIndex:number):Point{
  if(layer==='dc'&&c.id.startsWith('circuit:'))return {x:1240+(groupIndex%2)*240,y:45+Math.floor(groupIndex/2)*150};
  return {x:35+group(c,layer)*385,y:52+groupIndex*130};
}
function networkData(project:Project,layer:Layer){
  const components=project.components.filter(c=>
    layer==='ac'?c.ports?.some(p=>p.system==='ac'):
    layer==='dc'?c.voltage===12||c.voltage===24||c.voltage==='12/24'||c.kind==='solar'||c.kind==='battery':
    project.communicationPorts.some(p=>p.componentId===c.id)
  );
  const wiring=effectiveWiring(project);
  if(layer==='dc')for(const c of project.circuits.filter(c=>wiring.cables.some(w=>w.toCircuitId===c.id))){
    components.push({id:'circuit:'+c.id,name:c.name,kind:'appliance',voltage:c.voltage===230?'230':c.voltage,
      evidence:'estimated',notes:'Virtual circuit destination from the provisional Blue Sea wiring schedule. Physical routing and connected individual appliances have not been confirmed.'});
  }
  const ids=new Set(components.map(c=>c.id));
  const edges:Edge[]=layer==='communications'?
    project.communicationConnections.flatMap(link=>{
      const source=project.communicationPorts.find(p=>p.id===link.fromPortId);
      const target=project.communicationPorts.find(p=>p.id===link.toPortId);
      return source&&target&&ids.has(source.componentId)&&ids.has(target.componentId)?[{
        id:link.id,from:source.componentId,to:target.componentId,status:link.status,
        description:`${source.name} → ${target.name}: ${link.cable} (${link.status})`
      }]:[];
    }):
    project.topologyLinks.flatMap(link=>{
      const fromPort=project.components.find(c=>c.id===link.fromComponentId)?.ports?.find(p=>p.id===link.fromPortId);
      if(fromPort?.system!==layer||!ids.has(link.fromComponentId)||!ids.has(link.toComponentId))return [];
      return [{id:link.id,from:link.fromComponentId,to:link.toComponentId,status:link.status,
        description:`${link.fromPortId} → ${link.toPortId} (${link.status})`}];
    });
  if(layer==='dc'){
    const pairs=new Set(wiring.cables.filter(c=>c.toComponentId||c.toCircuitId).map(c=>c.fromComponentId+'~'+(c.toComponentId??('circuit:'+c.toCircuitId))));
    for(let index=edges.length-1;index>=0;index--){
      if(pairs.has(edges[index].from+'~'+edges[index].to))edges.splice(index,1);
    }
    for(const c of wiring.cables){
      const dest=c.toComponentId??(c.toCircuitId?'circuit:'+c.toCircuitId:undefined);
      if(!dest||!ids.has(c.fromComponentId)||!ids.has(dest)||c.status==='unknown')continue;
      // Draw positive and negative paths separately, including the confirmed shunt return.
      if(c.polarity==='negative'&&c.toCircuitId)continue;
      const fuse=wiring.fuses.find(f=>f.id===c.fuseId);
      edges.push({id:c.id,from:c.fromComponentId,to:dest,status:c.status==='reported'?'reported':'proposed',
        description:`${c.name} · ${c.lengthM}m (${c.lengthEvidence}) · ${c.polarity}${fuse?` · ${fuse.ratingA??'?'}A ${fuse.status} fuse, ${fuse.placement} near ${fuse.nearComponentId??'unconfirmed'}`:''}`});
    }
  }
  const count=new Map<number,number>();
  const positions=new Map<string,Point>();
  for(const c of components){
    const col=group(c,layer);const idx=count.get(col)??0;count.set(col,idx+1);
    const saved=project.diagramPositions.find(p=>p.componentId===c.id&&p.layer===layer);
    positions.set(c.id,saved?{x:saved.x,y:saved.y}:defaultPosition(c,layer,idx));
  }
  return {components,edges,positions};
}
export function SystemOverviewPage({project,change,onOpenDevice}:Props){
  const [layer,setLayer]=useState<Layer>('dc');
  const [selected,setSelected]=useState('battery');
  const [zoom,setZoom]=useState(0.92);
  const [pan,setPan]=useState<Point>({x:30,y:20});
  const [live,setLive]=useState<{id:string;point:Point}|null>(null);
  const interaction=useRef<{mode:'pan'|'node';id?:string;startX:number;startY:number;origin:Point;original:Point;didMove:boolean}|null>(null);
  const svgRef=useRef<SVGSVGElement>(null);
  const data=useMemo(()=>networkData(project,layer),[project,layer]);
  const coords=(id:string):Point=>live?.id===id?live.point:data.positions.get(id)??{x:0,y:0};
  const item=data.components.find(c=>c.id===selected)??data.components[0];
  const related=new Set(item?[item.id,...data.edges.filter(e=>e.from===item.id||e.to===item.id).flatMap(e=>[e.from,e.to])]:[]);
  const recommendations=useMemo(()=>recommendConnections(project),[project]);
  function start(e:PointerEvent<SVGElement>,id?:string){
    if(e.button!==0)return;
    if(!svgRef.current)return;
    const point=id?coords(id):pan;
    interaction.current={mode:id?'node':'pan',id,startX:e.clientX,startY:e.clientY,
      origin:{...point},original:{...point},didMove:false};
    e.currentTarget.setPointerCapture(e.pointerId);
    if(id)setSelected(id);
  }
  function move(e:PointerEvent<SVGElement>){
    const info=interaction.current,rect=svgRef.current?.getBoundingClientRect();
    if(!info||!rect)return;
    const factor=WIDTH/rect.width;
    const dx=(e.clientX-info.startX)*factor,dy=(e.clientY-info.startY)*factor;
    if(Math.abs(dx)+Math.abs(dy)>3)info.didMove=true;
    if(info.mode==='pan')setPan({x:info.origin.x+dx,y:info.origin.y+dy});
    else if(info.id)setLive({id:info.id,point:{x:clamp(info.origin.x+dx/zoom,0,WIDTH-NW),y:clamp(info.origin.y+dy/zoom,0,HEIGHT-NH)}});
  }
  function end(){
    const current=interaction.current;interaction.current=null;
    if(current?.mode==='node'&&current.id&&live?.id===current.id&&current.didMove){
      const {id,point}=live;
      change(p=>({...p,diagramPositions:[...p.diagramPositions.filter(x=>!(x.componentId===id&&x.layer===layer)),{componentId:id,layer,...point}]}));
    }
    setLive(null);
  }
  const activeCount=data.edges.filter(e=>e.status==='verified').length;
  return <div className="system-2d">
    <div className="section-heading heading-top"><div><div className="eyebrow">ITERATION 03 / INTERACTIVE 2D</div><h1>System overview</h1><p>Explore the recorded AC, DC and communications networks. Drag nodes to lay out your system; no connections are created by dragging.</p></div></div>
    <div className="notice"><AlertTriangle size={20}/><div><strong>Conceptual topology — not a wiring schematic</strong><p>Links represent recorded port-group relationships or communications cables, not a verified terminal-by-terminal connection, earthing arrangement or installable cable route. Missing edges mean a relationship has not been recorded.</p></div></div>
    <div className="overview-controls">
      <div className="overview-tabs" role="group" aria-label="Network layer">
        {(['dc','ac','communications'] as const).map(l=><button key={l} className={layer===l?'active':''} onClick={()=>{setLayer(l);setLive(null)}}>{l==='dc'?'12V / DC':l==='ac'?'230V / AC':'Communications'}</button>)}
      </div><div className="overview-tools">
        <button className="button small" onClick={()=>setZoom(z=>clamp(z/1.2,.35,2.4))} aria-label="Zoom out"><ZoomOut size={17}/></button>
        <span>{Math.round(zoom*100)}%</span>
        <button className="button small" onClick={()=>setZoom(z=>clamp(z*1.2,.35,2.4))} aria-label="Zoom in"><ZoomIn size={17}/></button>
        <button className="button small" onClick={()=>{setZoom(.92);setPan({x:30,y:20})}}><Maximize2 size={16}/> Fit view</button>
      </div>
    </div>
    <div className="overview-legend"><span>Dashed = proposed</span><span>Solid = reported</span><span>Bright = user-marked verified</span><span><Move size={13}/> Drag items to arrange</span></div>
    <div className="overview-layout">
      <div className="overview-svg-wrap"><svg ref={svgRef} className="overview-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          onPointerDown={e=>{if(e.target===e.currentTarget)start(e)}} onPointerMove={move}
          onPointerUp={end} onPointerCancel={end} aria-label={`${layer.toUpperCase()} system overview`} role="img">
        <defs><pattern id="vandy-grid" patternUnits="userSpaceOnUse" width="28" height="28"><path d="M28 0 L0 0 0 28" fill="none" stroke="#223c4a" strokeWidth=".7"/></pattern>
          <marker id="vandy-arrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0 0 L8 3 L0 6" fill="none" stroke="#89b7c0" strokeWidth="1.2"/></marker></defs>
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#vandy-grid)"/>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {data.edges.map(e=>{
            const a=coords(e.from),b=coords(e.to);
            const x=a.x+NW/2,y=a.y+NH/2,q=b.x+NW/2,r=b.y+NH/2;
            const focus=related.has(e.from)&&related.has(e.to);
            return <path key={e.id} d={`M${x} ${y} C${(x+q)/2} ${y},${(x+q)/2} ${r},${q} ${r}`}
              fill="none" stroke={focus?'#6fdfc6':'#6b8d9c'} opacity={focus?1:.45}
              strokeWidth={e.status==='verified'?3.5:2} strokeDasharray={e.status==='proposed'?'7 6':undefined}
              markerEnd="url(#vandy-arrow)"><title>{e.description}</title></path>;
          })}
          {data.components.map(c=>{
            const p=coords(c.id),isSelected=item?.id===c.id,connected=data.edges.some(e=>e.from===c.id||e.to===c.id);
            return <g key={c.id} transform={`translate(${p.x} ${p.y})`} className="overview-node"
              onPointerDown={e=>{e.stopPropagation();start(e,c.id)}} onPointerMove={move} onPointerUp={end}
              onPointerCancel={end} onClick={()=>setSelected(c.id)}>
              <rect width={NW} height={NH} rx="11" className={isSelected?'overview-node-selected':'overview-node-body'}/>
              <rect x="11" y="11" width="7" height="7" rx="2" fill={connected?'#6fdfc6':'#87919a'}/>
              <text x="26" y="21" className="overview-label">{c.name.length>25?c.name.slice(0,23)+'…':c.name}</text>
              <text x="14" y="46" className="overview-detail">{c.kind.replaceAll('-',' ')} · {c.model??'model unconfirmed'}</text>
              <text x="14" y="67" className="overview-detail">{connected?'Relationship recorded':'No recorded link in this layer'}</text>
              <title>{c.name} — selectable and movable for layout only</title>
            </g>;
          })}
        </g>
      </svg></div>
      <aside className="overview-detail-panel"><div className="overview-detail-heading"><Network size={20}/><h3>{item?.name??'Select equipment'}</h3></div>
        {item?<><p><strong>Type:</strong> {item.kind.replaceAll('-',' ')}</p><p><strong>Model:</strong> {item.model??'Unconfirmed'}</p>
          <p><strong>Evidence:</strong> {item.evidence??'unknown'}</p>
          <p>{item.notes??'No additional equipment notes.'}</p>
          <h4>Recorded relationships</h4>
          {data.edges.filter(e=>e.from===item.id||e.to===item.id).length?data.edges.filter(e=>e.from===item.id||e.to===item.id).map(e=>
            <div className="overview-link-detail" key={e.id}><Cable size={14}/><span>{e.from===item.id?'To':'From'} {project.components.find(c=>c.id===(e.from===item.id?e.to:e.from))?.name} · {e.status}<small>{e.description}</small></span></div>):
            <p>There are no saved links for this device in the selected layer. We will not infer them from product names.</p>}
          {layer==='communications'&&recommendations.filter(r=>r.deviceId===item.id).map(r=><div className="overview-link-detail" key={r.id}><AlertTriangle size={14}/><span>{r.verdict}: {r.cable}<small>{r.benefits}</small></span></div>)}
          <h4>Documented / recorded interfaces</h4>{project.communicationPorts.filter(p=>p.componentId===item.id).map(p=>
            <p key={p.id}>{p.name} — {p.protocol} ({p.evidence})</p>)}
          {onOpenDevice&&<button className="button small" onClick={()=>onOpenDevice(item.id)}>Open device details</button>}
        </>:<p>No selectable devices in this layer.</p>}
        <div className="overview-metrics"><span>{data.components.length} devices</span><span>{data.edges.length} saved links</span><span>{activeCount} marked verified</span></div>
      </aside>
    </div>
    <p className="autonomy-note">Diagram placements are cosmetic; press Update to save them. DC edges now use the individually recorded cable plan, including its 1m assumptions and fuse-position evidence. These edges do not certify wiring, conductor sizing or installation.</p>
  </div>;
}
