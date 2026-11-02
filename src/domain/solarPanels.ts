/** Catalogued panel electrical ratings are for the linked exact variants at STC.
 * Custom values are illustrative user-editable inputs, not verified specifications.
 */
export type PanelModel={
 id:string;name:string;manufacturer:string;watts:number;voc:number;isc:number;
 vmp:number|null;imp:number|null;vocTempCoeffPct:number|null;sourceUrl:string;
};
export const solarPanels:readonly PanelModel[]=[
 {id:'renogy-100-bifacial',name:'100W N-Type Bifacial',manufacturer:'Renogy',watts:100,
  voc:28.5,isc:4.45,vmp:23.6,imp:4.24,vocTempCoeffPct:null,
  sourceUrl:'https://eu.renogy.com/products/100w-n-type-bifacial-solar-panel'},
 {id:'renogy-200-bifacial',name:'200W N-Type Bifacial',manufacturer:'Renogy',watts:200,
  voc:29.6,isc:8.7,vmp:25,imp:8,vocTempCoeffPct:null,
  sourceUrl:'https://eu.renogy.com/products/n-type-bifacial-solar-panel'},
 {id:'renogy-320-bifacial',name:'320W N-Type Bifacial',manufacturer:'Renogy',watts:320,
  voc:43.82,isc:8.92,vmp:37.85,imp:8.46,vocTempCoeffPct:null,
  sourceUrl:'https://eu.renogy.com/products/320w-n-type-bifacial-solar-panel-2-pack'},
 {id:'renogy-400-bifacial',name:'400W N-Type Bifacial',manufacturer:'Renogy',watts:400,
  voc:39.42,isc:13.06,vmp:34,imp:11.76,vocTempCoeffPct:null,
  sourceUrl:'https://eu.renogy.com/products/400w-n-type-bifacial-solar-panel'},
];
export const panelModel=(id:string)=>solarPanels.find(p=>p.id===id);
export const customSolarPanel=()=>({
 modelId:'custom',watts:400,voc:40,isc:13,vmp:34,imp:11.76,
 vocTempCoeffPct:null,quantity:1,connection:'parallel' as const,
});
