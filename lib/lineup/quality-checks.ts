import {qualityFields,qualitySwitches,type QualityPolicy,type QualityValues} from './quality-policy';
import type {LogoQuality,PrintQualityReport} from './print-quality';
export type QualityCheck={id:string;label:string;setting?:keyof QualityValues;measured:string;threshold:string;result:'pass'|'review'|'blocked'|'not-applicable'|'not-measured'|'info';explanation:string;revision?:number};
const fraction=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1;
const number=(n:number)=>Number.isFinite(n)?Number(n.toFixed(4)).toString():'Not measured';
export function qualityChecks(logo:LogoQuality,report:PrintQualityReport,policy:QualityPolicy,technique:string):QualityCheck[]{
 const checks:QualityCheck[]=[],s=policy.values,v=logo.visualComparison,embro=technique.includes('embroidery');
 const add=(check:QualityCheck)=>checks.push(check);
 const numeric=(id:string,setting:keyof typeof qualityFields,value:number|undefined,limit:number,unit:string,min:boolean,explanation:string,blocked=false,revision=policy.revision)=>add({id,setting,label:qualityFields[setting].label,measured:value===undefined?'Not measured':`${number(value)} ${unit}`,threshold:`${min?'At least':'At most'} ${number(limit)} ${unit}`,result:value===undefined||!Number.isFinite(value)?'not-measured':(min?value>=limit:value<=limit)?'pass':blocked?'blocked':'review',explanation,revision});
 for(const a of report.areas){
  const area=`Print area ${a.id}. `;
  numeric(`resolution-${a.id}`,'minOutputPpi',a.outputDpi,a.requiredDpi,'PPI',true,area+'Uses the higher of the configured minimum and supplier requirement.',true);
  if(logo.enhanced)numeric(`original-${a.id}`,'minEnhancedSourcePpi',a.sourceDpi,s.minEnhancedSourcePpi,'PPI',true,area+'Original resolution before upscaling.',true);
  else add({id:`original-${a.id}`,label:'Original resolution before upscaling',setting:'minEnhancedSourcePpi',measured:`${a.sourceDpi} PPI`,threshold:'Applies to enhanced artwork only',result:'not-applicable',explanation:area+'This artwork was not upscaled.'});
  const textSetting=technique==='embroidery'?'embroideryTextMm':'printTextMm';
  if(v?.smallestTextHeightFraction===null)add({id:`text-${a.id}`,label:'Minimum lettering',setting:textSetting,measured:'No text detected',threshold:`At least ${s[textSetting]} mm when text exists`,result:'not-applicable',explanation:area+'Visual assessment recorded a text-free logo.',revision:policy.revision});
  else numeric(`text-${a.id}`,textSetting,fraction(v?.smallestTextHeightFraction)?a.heightInches*v.smallestTextHeightFraction*25.4:undefined,s[textSetting],'mm',true,area+'Estimated smallest letter at the actual physical logo size; not the displayed mockup size.');
  if(embro){
   numeric(`line-${a.id}`,'embroideryLineMm',v?.embroidery?a.heightInches*v.embroidery.minLineFraction*25.4:undefined,s.embroideryLineMm,'mm',true,area+'Estimated thinnest meaningful stroke.');
   if(v?.embroidery?.minGapFraction===null)add({id:`gap-${a.id}`,setting:'embroideryGapMm',label:'Minimum embroidered gap',measured:'No gaps detected',threshold:`At least ${s.embroideryGapMm} mm when gaps exist`,result:'not-applicable',explanation:area+'No negative-space gaps recorded.',revision:policy.revision});
   else numeric(`gap-${a.id}`,'embroideryGapMm',typeof v?.embroidery?.minGapFraction==='number'?a.heightInches*v.embroidery.minGapFraction*25.4:undefined,s.embroideryGapMm,'mm',true,area+'Estimated smallest negative-space gap.');
  }
 }
 if(!report.areas.length)add({id:'dimensions',label:'Valid print dimensions',measured:'Missing or invalid',threshold:'Positive source, prepared and print-area dimensions',result:'blocked',explanation:'Physical checks cannot be calculated without valid dimensions.'});
 add({id:'visual',label:'Logo identity and visual comparison',measured:v?.status??'Not measured',threshold:'Confident comparison with no recorded concerns',result:!v?'not-measured':[1,2].includes(v.version)&&v.status==='passed'&&!v.reasons.length?'pass':'review',explanation:v?.reasons.join(' ')||'Checks lettering, shapes, colors and edges. Passing this check does not waive physical-size requirements.',revision:v?.policyRevision});
 const comparisonPassed=!!v&&[1,2].includes(v.version)&&v.status==='passed'&&!v.reasons.length&&checks.filter(c=>c.id.startsWith('text-')).every(c=>c.result==='pass'||c.result==='not-applicable');
 for(const a of report.areas)add({id:`source-detail-${a.id}`,label:'Original detail or verified comparison',measured:`${a.sourceDpi} original PPI; comparison ${comparisonPassed?'passed':'not passed'}`,threshold:`Original at least ${a.requiredDpi} PPI, or passing visual and lettering checks`,result:a.sourceDpi>=a.requiredDpi||comparisonPassed?'pass':'review',explanation:`Print area ${a.id}. Increasing prepared pixel dimensions alone does not verify original detail.`});
 if(logo.enhanced)add({id:'enhancement-verification',label:'Enhancement verification',measured:comparisonPassed?'Comparison passed':logo.reviewed?'Previously reviewed':'No passing verification',threshold:'Passing comparison or explicit artwork review',result:comparisonPassed||logo.reviewed?'pass':'review',explanation:'Upscaled artwork must preserve the original design.'});
 if(embro){
  const e=v?.embroidery;
  numeric('colors','embroideryColors',e?.colorCount,s.embroideryColors,'colors',false,'Detected solid colors in the prepared artwork.');
  for(const [key,label] of [['flatColors','Solid colors'],['simpleShapes','Simple shapes'],['transparentBackground','Transparent background']] as const)add({id:key,label,measured:e?String(e[key]):'Not measured',threshold:'Required',result:!e?'not-measured':e[key]?'pass':'review',explanation:'Fixed flat-embroidery requirement.'});
  add({id:'embroidery-confidence',label:'Embroidery measurement confidence',measured:e?e.uncertain?'Uncertain':'Confident':'Not measured',threshold:'Confident flat-embroidery assessment',result:!e?'not-measured':e.uncertain||technique!=='embroidery'||v?.version!==2?'review':'pass',explanation:'Other embroidery techniques and incomplete measurements need review.'});
 }
 const t=logo.transparency;
 const exception=!embro&&s.allowEdgeSmoothing&&logo.edgeSmoothingOnly===true;
 add({id:'transparency',setting:'partialPixelPercent',label:'Partially transparent pixels',measured:t?`${number(t.partialPercent)}%`:logo.semiTransparent===undefined?'Not measured':logo.semiTransparent?'Above recorded transparency limit (exact percentage not recorded)':'Within recorded transparency limit (exact percentage not recorded)',threshold:t?`At most ${t.settings.partialPixelPercent}%`:'Numeric threshold not recorded with source analysis',result:!s.reviewTransparency?'not-applicable':logo.semiTransparent===undefined?'not-measured':logo.semiTransparent&&!exception?'review':'pass',explanation:!s.reviewTransparency?'Transparency review is disabled.':exception?(t?.minorOutliersAccepted?'Edge smoothing and bounded minor-transparency exception applies.':'Harmless edge-smoothing exception applies.'):'Broad or detached partial transparency may need review.',revision:t?.revision});
 if(t){
  for(const [id,key,value] of [['edge-outlier-partial','edgeOutlierPercent',t.outlierPercent],['edge-outlier-visible','edgeOutlierVisiblePercent',t.outlierVisiblePercent],['edge-outlier-cluster','edgeOutlierClusterPixels',t.maxOutlierCluster]] as const) {
    if(t.analysisVersion===2) numeric(id,key,value,t.settings[key]??s[key],qualityFields[key].unit,false,`Minor-transparency exception: ${t.outliers??0} outliers; ${t.detached??0} pixels beyond the solid-edge limit. All exception limits must pass.`,false,t.revision);
  }

  numeric('edge-solid','edgeSolidPixels',t.maxSolidDistance,t.settings.edgeSolidPixels,'source pixels',false,'Maximum recorded distance to a solid pixel. Legacy distances may be capped; analysis version 2 records exact distances.',false,t.revision);
  numeric('edge-clear','edgeClearPixels',t.maxClearDistance,t.settings.edgeClearPixels,'source pixels',false,'Maximum recorded distance to a clear pixel. Legacy distances may be capped; analysis version 2 records exact distances.',false,t.revision);
  for(const key of ['alphaLow','alphaHigh'] as const)add({id:key,setting:key,label:qualityFields[key].label,measured:'Analysis parameter',threshold:String(t.settings[key]),result:'info',explanation:'Alpha boundaries define which source pixels are clear, partial or solid.',revision:t.revision});
  // Edge distances classify the exception, rather than independently blocking publication.
  for(const c of checks)if(c.id.startsWith('edge-')){c.result='info';c.explanation+=' This classifies edge smoothing; it is not an independent approval gate.';}
 }
 const vp=v?.policy;
 for(const [key,metric] of [['meanDifference','meanDifference'],['tileDifference','worstTileDifference'],['alphaDifference','alphaDifference'],['aspectDifference','aspectDifference']] as const){
  if(vp)numeric(key,key,v?.metrics?.[metric],vp.values[key],'ratio',false,'Comparison between original and prepared artwork. Uses the policy recorded when image analysis ran.',false,vp.revision);
  else add({id:key,setting:key,label:qualityFields[key].label,measured:v?.metrics?.[metric]===undefined?'Not measured':number(v.metrics[metric]!),threshold:'Threshold not recorded with this image comparison',result:'not-measured',explanation:'Upload again to record complete comparison measurements and thresholds.',revision:v?.policyRevision});
 }
 for(const key of ['allowEdgeSmoothing','reviewTransparency','growOtherPrints'] as const)add({id:key,setting:key,label:qualitySwitches[key].label,measured:'Policy option',threshold:s[key]?'On':'Off',result:'info',explanation:qualitySwitches[key].description,revision:policy.revision});
 for(const key of ['minDtgScalePercent','minOtherScalePercent','minFrontInches'] as const)add({id:key,setting:key,label:qualityFields[key].label,measured:'Sizing search constraint',threshold:`${s[key]} ${qualityFields[key].unit}`,result:'info',explanation:qualityFields[key].description,revision:policy.revision});
 for(const key of Object.keys(qualityFields) as (keyof typeof qualityFields)[]){
  if(checks.some(c=>c.setting===key))continue;
  const f=qualityFields[key];
  const irrelevant=(f.group==='Embroidery'&&!embro)||(key==='printTextMm'&&technique==='embroidery');
  add({id:`unused-${key}`,setting:key,label:f.label,measured:irrelevant?'Not applicable to this technique':'Not measured',threshold:irrelevant?`${s[key]} ${f.unit}`:'Analysis threshold not recorded',result:irrelevant?'not-applicable':'not-measured',explanation:irrelevant?'This setting does not apply to this product’s technique.':'Upload again to record this analysis detail.',revision:irrelevant?policy.revision:undefined});
 }
 return checks;
}

/** Historical evidence only: never infer unrecorded settings from today's policy. */
export function legacyQualityChecks(report:PrintQualityReport,embroidery=false):QualityCheck[]{
 const rows:QualityCheck[]=[];
 for(const a of report.areas){
  rows.push({id:`legacy-resolution-${a.id}`,setting:'minOutputPpi',label:`Prepared resolution — area ${a.id}`,measured:`${a.outputDpi} PPI`,threshold:`At least ${a.requiredDpi} PPI`,result:a.outputDpi>=a.requiredDpi?'pass':'blocked',explanation:'Both resolution values were recorded in the original assessment.'});
  const f=report.visualComparison?.smallestTextHeightFraction;
  rows.push({id:`legacy-text-${a.id}`,setting:embroidery?'embroideryTextMm':'printTextMm',label:`Smallest lettering — area ${a.id}`,measured:f===null?'No text detected':typeof f==='number'?`${number(a.heightInches*f*25.4)} mm`:'Not measured',threshold:'Threshold not recorded',result:f===null?'not-applicable':'not-measured',explanation:'Estimated from the recorded letter fraction and physical logo size. A historical numeric threshold cannot be inferred from current settings.'});
 }
 const v=report.visualComparison;
 rows.push({id:'legacy-visual',label:'Recorded visual comparison',measured:v?.status??'Not measured',threshold:'Detailed check settings not recorded',result:!v?'not-measured':v.status==='passed'&&!v.reasons.length?'pass':'review',explanation:v?.reasons.join(' ')||'This is the saved visual result, not a new assessment.'});
 return rows;
}
