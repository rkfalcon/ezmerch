'use client';
import {useState} from 'react';
import {qualityFields,qualitySwitches,defaultQualityValues,validateQualityValues,type QualityPolicy} from '@/lib/lineup/quality-policy';
import {Button} from '@/components/ui/button';
export function QualitySettings({initial}:{initial:QualityPolicy}){
 const [saved,setSaved]=useState(initial),[values,setValues]=useState(initial.values),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const groups=[...new Set(Object.values(qualityFields).map(f=>f.group))];
 async function save(event:React.FormEvent){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   validateQualityValues(values);
   const r=await fetch('/api/lineup/quality-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:saved.revision,values})});
   const data=await r.json();if(!r.ok)throw Error(data.error);
   setSaved(data);setValues(data.values);setMessage('Saved. Future logo assessments for all stores will use these settings. Retry automatic adjustments applies lettering and sizing changes to held products. Upload again to rerun image comparison and transparency with new limits.');
  }catch(e){setMessage(e instanceof Error?e.message:'Could not save settings');}finally{setBusy(false);}
 }
 return <form onSubmit={save} className="space-y-6">
  <p className="text-sm text-muted-foreground">Recommended values are conservative VeryMerch screening defaults, not supplier approval or a guarantee of physical results. Lowering a minimum or increasing a maximum makes that check more permissive. Other checks still apply.</p>
  <p className="text-sm">Applies to new logo uploads and subsequent artwork assessments for every new or existing store. Already completed assessments and products are not automatically regenerated or published. Retry held products for new lettering/sizing thresholds; upload again for new image-comparison/transparency limits. Saved revision: {saved.revision}.</p>
  <fieldset disabled={busy} className="space-y-6">
   {groups.map(group=><section key={group} className="rounded-lg border p-4 space-y-4">
    <h2 className="text-lg font-semibold">{group}</h2>
    {Object.entries(qualityFields).filter(([,f])=>f.group===group).map(([key,f])=>{
     const k=key as keyof typeof qualityFields;
     return <div key={key} className="grid gap-3 border-t pt-4 md:grid-cols-[1fr_16rem]">
      <div><label htmlFor={key} className="font-medium">{f.label}</label><p className="text-sm text-muted-foreground">{f.description}</p>
       <p className="text-sm mt-1">Saved: <strong>{saved.values[k]} {f.unit}</strong> · Recommended: <strong>{f.value} {f.unit}</strong></p></div>
      <div className="flex items-center gap-2"><input id={key} type="number" required min={f.min} max={f.max} step="any" value={Number.isNaN(values[k])?'':values[k]} onChange={e=>setValues({...values,[k]:e.target.value===''?NaN:Number(e.target.value)})} className="w-28 rounded border p-2"/><span className="text-xs">{f.unit}</span></div>
     </div>;
    })}
    {Object.entries(qualitySwitches).filter(([,f])=>f.group===group).map(([key,f])=>{
     const k=key as keyof typeof qualitySwitches;
     return <div key={key} className="border-t pt-4"><label className="flex gap-2 items-center"><input id={key} type="checkbox" checked={values[k]} onChange={e=>setValues({...values,[k]:e.target.checked})}/>{f.label}</label><p className="text-sm text-muted-foreground">{f.description}</p><p className="text-sm">Saved: {saved.values[k]?'On':'Off'} · Recommended: {f.value?'On':'Off'}</p></div>;
    })}
   </section>)}
   <section className="rounded-lg border p-4 text-sm space-y-2"><h2 className="font-semibold">Checks that remain enforced</h2>
    <p>Supplier print-area boundaries and required resolution; valid image dimensions; unchanged logo lettering, shapes and colors; legible original and prepared text; clean edges; and a complete, confident visual assessment.</p>
    <p>Flat embroidery also requires simple shapes, solid colors, a transparent background and confident line/gap measurements. Other embroidery techniques need review. Enhanced artwork without a passing visual comparison or explicit review cannot automatically pass. A legacy upload without quality metadata must be uploaded again to run the full current checks.</p>
    <p>Automatic sizing preserves aspect ratio, searches in 1% steps up to 100% of the placement, and only switches front/chest placement when allowed on the product template. Template placement and preferred size are edited under Product templates.</p>
   </section>
   <div className="flex flex-wrap gap-2"><Button type="submit">Save quality settings</Button><Button type="button" variant="outline" onClick={()=>setValues({...defaultQualityValues})}>Use recommended values</Button><Button type="button" variant="outline" onClick={()=>setValues({...saved.values})}>Discard unsaved changes</Button></div>
  </fieldset>
  {message&&<p role="status" className="rounded border p-3">{message}</p>}
 </form>;
}
