import type { GroundingConnection, GroundingTerminal, Project } from './model.ts';

/** Structural checks only. These are recorded protective conductors or chassis bonds,
 * not a continuity test, an AC neutral-earth bond or a DC negative return.
 */
export function groundingTerminal(project:Project, componentId:string, terminalId:string):GroundingTerminal|undefined {
  const component=project.components.find(c=>c.id===componentId);
  const t=component?.terminals?.find(t=>t.id===terminalId);
  if(t)return t.kind==='chassis'?{id:t.id,label:t.label,kind:'chassis'}:
    t.kind==='protective-earth'?{id:t.id,label:t.label,kind:'pe'}:undefined;
  // Old v3 projects may not yet contain the new terminal catalogue.
  return component?.terminals===undefined?component?.groundingTerminals?.find(t=>t.id===terminalId):undefined;
}
export function checkGroundingLink(project:Project, link:GroundingConnection):string[] {
  const a=groundingTerminal(project,link.fromComponentId,link.fromTerminalId);
  const b=groundingTerminal(project,link.toComponentId,link.toTerminalId);
  const issues:string[]=[];
  if(!a||!b)return ['Grounding endpoint is missing from the equipment inventory.'];
  if(link.fromComponentId===link.toComponentId)return ['A grounding connection must join two separate devices or attachment points.'];
  if(link.kind==='chassis-bond'&&(a.kind!=='chassis'||b.kind!=='chassis'))
    issues.push('Chassis bonds must connect chassis/bonding terminals. Do not substitute PE or DC negative.');
  if(link.kind==='protective-earth'&&!(a.kind==='pe'||b.kind==='pe'))
    issues.push('Protective earth must terminate at a designated PE terminal on at least one end.');
  if(link.kind!=='chassis-bond'&&link.kind!=='protective-earth')
    issues.push('Unknown grounding connection type.');
  return issues;
}
export function validateGrounding(project:Project):string[] {
  const seen=new Set<string>();const issues:string[]=[];
  for(const link of project.groundingConnections??[]){
    for(const issue of checkGroundingLink(project,link))issues.push(`${link.id}: ${issue}`);
    const a=`${link.fromComponentId}/${link.fromTerminalId}`,b=`${link.toComponentId}/${link.toTerminalId}`;
    const key=[a,b].sort().join('~');
    if(seen.has(key))issues.push(`${link.id}: duplicate grounding connection between the same terminals.`);
    seen.add(key);
  }
  return issues;
}
