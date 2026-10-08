/** Internal screening defaults, not supplier certification. Units are explicit in the UI. */
export const qualityFields = {
 printTextMm: {group:'Lettering',label:'Minimum printed lettering',unit:'mm',value:2.032,min:0.1,max:20,step:0.01,description:'Smallest estimated letter height at the physical placement. Applies to all non-embroidery techniques, including DTF. A value of 0.90 accepts lettering at or above 0.90 mm when other checks pass.'},
 embroideryTextMm: {group:'Embroidery',label:'Minimum embroidered lettering',unit:'mm',value:6.35,min:0.1,max:30,step:0.01,description:'Minimum estimated letter height for flat embroidery.'},
 minOutputPpi: {group:'Resolution',label:'Minimum prepared resolution',unit:'PPI',value:150,min:1,max:1200,step:1,description:'The higher of this value and the supplier’s print-area requirement is enforced. Lowering this cannot bypass the supplier requirement.'},
 minEnhancedSourcePpi: {group:'Resolution',label:'Minimum original resolution before upscaling',unit:'PPI',value:75,min:1,max:1200,step:1,description:'An enhanced logo below this original resolution at the proposed size is blocked even if the enlarged file has enough pixels.'},
 embroideryColors: {group:'Embroidery',label:'Maximum thread colors',unit:'colors',value:6,min:1,max:20,step:1,description:'Maximum detected solid colors for automatic flat-embroidery approval. This does not change the supplier’s available thread colors.'},
 embroideryLineMm: {group:'Embroidery',label:'Minimum embroidered line thickness',unit:'mm',value:1.27,min:0.1,max:20,step:0.01,description:'Minimum estimated meaningful stroke thickness at the finished size.'},
 embroideryGapMm: {group:'Embroidery',label:'Minimum embroidered gap',unit:'mm',value:6.35,min:0.1,max:30,step:0.01,description:'Minimum estimated negative-space gap, including letter counters. Only checked when the logo contains gaps.'},
 partialPixelPercent: {group:'Transparency',label:'Partially transparent pixel limit',unit:'%',value:2,min:0,max:100,step:0.1,description:'Review when the percentage of visible pixels with partial alpha exceeds this limit, unless the bounded edge-smoothing exception passes.'},
 edgeOutlierPercent: {group:'Transparency',label:'Maximum edge outliers among partial pixels',unit:'%',value:0.5,min:0,max:5,step:0.05,description:'Allow this small percentage of partial pixels to exceed the clear-edge distance only when the visible-pixel and connected-group limits also pass. Every partial pixel must still be near solid artwork. Zero restores strict edge checking.'},
 edgeOutlierVisiblePercent: {group:'Transparency',label:'Maximum edge outliers among visible pixels',unit:'%',value:0.05,min:0,max:1,step:0.01,description:'Additional cap on how much of the visible logo can receive the minor-transparency exception.'},
 edgeOutlierClusterPixels: {group:'Transparency',label:'Maximum connected outlier group',unit:'source pixels',value:64,min:0,max:256,step:1,description:'Maximum eight-connected group of partial pixels outside the clear-edge distance. Keeps larger translucent seams or regions in review.'},
 alphaLow: {group:'Transparency',label:'Clear alpha boundary',unit:'0–255',value:20,min:0,max:254,step:1,description:'Alpha at or below this value is treated as clear. Partial pixels lie between the clear and solid boundaries.'},
 alphaHigh: {group:'Transparency',label:'Solid alpha boundary',unit:'0–255',value:235,min:1,max:255,step:1,description:'Alpha at or above this value is treated as solid.'},
 edgeSolidPixels: {group:'Transparency',label:'Edge distance to solid pixels',unit:'source pixels',value:2,min:0,max:12,step:1,description:'Every partially transparent pixel must be this close to a solid pixel to qualify as harmless edge smoothing.'},
 edgeClearPixels: {group:'Transparency',label:'Edge distance to clear pixels',unit:'source pixels',value:4,min:0,max:12,step:1,description:'Partial pixels should be this close to a clear pixel; only bounded minor outliers can receive the exception. Measured before upscaling.'},
 meanDifference: {group:'Image comparison',label:'Maximum average image difference',unit:'fraction 0–1',value:0.06,min:0,max:1,step:0.001,description:'Maximum average pixel difference between original and prepared artwork. Higher values allow greater changes; visual identity checks still apply.'},
 tileDifference: {group:'Image comparison',label:'Maximum local image difference',unit:'fraction 0–1',value:0.18,min:0,max:1,step:0.001,description:'Maximum difference in the worst region of the 8×8 comparison grid.'},
 alphaDifference: {group:'Image comparison',label:'Maximum transparency difference',unit:'fraction 0–1',value:0.025,min:0,max:1,step:0.001,description:'Maximum average alpha difference between original and prepared artwork.'},
 aspectDifference: {group:'Image comparison',label:'Maximum aspect-ratio difference',unit:'absolute ratio',value:0.005,min:0,max:0.1,step:0.001,description:'Maximum absolute difference between source and prepared width/height ratios.'},
 minDtgScalePercent: {group:'Automatic sizing',label:'Minimum DTG search size',unit:'% of placement',value:1,min:1,max:100,step:1,description:'Smallest DTG size considered during automatic adjustment. Template preferred sizing is still tried first.'},
 minOtherScalePercent: {group:'Automatic sizing',label:'Minimum other-technique search size',unit:'% of preferred size',value:50,min:1,max:100,step:1,description:'Smallest automatic size relative to the template’s preferred size for DTF, embroidery and other techniques.'},
 minFrontInches: {group:'Automatic sizing',label:'Minimum automatic front/chest logo dimension',unit:'inches',value:2.5,min:0.1,max:20,step:0.1,description:'Minimum larger dimension for alternative front/chest placements and DTG front/chest size candidates.'},
} as const;
export const qualitySwitches = {
 allowEdgeSmoothing: {group:'Transparency',label:'Allow harmless edge smoothing on printed products',value:true,description:'Waive partial-transparency review for edge smoothing and bounded minor artifacts. Every partial pixel must be near solid artwork; clear-edge outliers must pass all three outlier limits. Embroidery does not receive this exception.'},
 reviewTransparency: {group:'Transparency',label:'Review excessive partial transparency',value:true,description:'Require review when the transparency limit is exceeded and no edge-smoothing exception applies.'},
 growOtherPrints: {group:'Automatic sizing',label:'Allow automatic enlargement for DTF and other printing',value:false,description:'Try sizes above the preferred size up to 100% of the supplier area when smaller sizes cannot pass. DTG and flat embroidery already try enlargement.'},
} as const;
export type QualityValues = {[K in keyof typeof qualityFields]:number} & {[K in keyof typeof qualitySwitches]:boolean};
export type QualityPolicy = {revision:number;values:QualityValues};
export const defaultQualityValues = Object.fromEntries([...Object.entries(qualityFields),...Object.entries(qualitySwitches)].map(([k,v])=>[k,v.value])) as QualityValues;
export const defaultQualityPolicy:QualityPolicy={revision:0,values:defaultQualityValues};
export function validateQualityValues(input:unknown):QualityValues {
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid quality settings');
 const values=input as Record<string,unknown>;
 const keys=[...Object.keys(qualityFields),...Object.keys(qualitySwitches)];
 if(Object.keys(values).length!==keys.length||Object.keys(values).some(k=>!keys.includes(k)))throw Error('Quality settings are incomplete or contain unknown fields. Reload the page.');
 for(const [key,field] of Object.entries(qualityFields)){
  const n=values[key];
  if(typeof n!=='number'||!Number.isFinite(n)||n<field.min||n>field.max||(field.step===1&&!Number.isInteger(n)))throw Error(`${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`);
 }
 for(const [key,field] of Object.entries(qualitySwitches))if(typeof values[key]!=='boolean')throw Error(`${field.label} must be enabled or disabled.`);
 if(Number(values.alphaLow)>=Number(values.alphaHigh))throw Error('Clear alpha boundary must be below the solid alpha boundary.');
 return {...values} as QualityValues;
}
