'use client';
import {legacyQualityChecks} from '@/lib/lineup/quality-checks';
import {useEffect,useState} from 'react';
import type {PrintQualityReport} from '@/lib/lineup/print-quality';
import {qualityFields,qualitySwitches,type QualityPolicy} from '@/lib/lineup/quality-policy';
export function QualityCheckBreakdown({quality,embroidery=false}:{quality:PrintQualityReport;embroidery?:boolean}){
 const [open,setOpen]=useState(false),[current,setCurrent]=useState<QualityPolicy|null>(null);
 useEffect(()=>{if(!open)return;const c=new AbortController();fetch('/api/lineup/quality-settings',{signal:c.signal}).then(r=>r.ok?r.json():null).then(setCurrent).catch(()=>{});return()=>c.abort();},[open]);
 const checks=quality.checks??legacyQualityChecks(quality,embroidery);
 const failures=checks?.filter(c=>c.result==='review'||c.result==='blocked')??[];
 return <div className="space-y-2 rounded border p-3">
  <p className="font-medium">Assessment details</p>
  {failures.length>0&&<ul className="list-disc pl-4 space-y-1">{failures.map(c=><li key={c.id}><strong>{c.label}:</strong> {c.measured}; {c.threshold.toLowerCase()}. {c.setting&&<a className="underline" href={`/dashboard/admin/quality#${c.setting}`}>View setting</a>}</li>)}</ul>}
  {!quality.checks&&<p className="text-xs">This older assessment did not record a full check breakdown. The review reason and available measurements are shown above. Retry automatic adjustments for a new placement assessment; upload again to record image-comparison and transparency details. Missing historical thresholds are not replaced with today’s settings.</p>}
  {checks&&<details open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer underline">All checks and settings used ({checks.length})</summary>
   <p className="my-2 text-xs">Thresholds below were recorded with this assessment. Today’s values are shown separately. “Info” rows describe policy options, not independent reasons to reject a product. Other checks may still need attention after the first issue is resolved.</p>
   <div className="space-y-3">{checks.map(c=>{
    const field=c.setting?(qualityFields[c.setting as keyof typeof qualityFields]??qualitySwitches[c.setting as keyof typeof qualitySwitches]):null;
    return <div key={c.id} className="border-t pt-2 text-xs space-y-1">
     <p className="font-semibold">{c.label} — {c.result.replaceAll('-',' ')}</p>
     <p>Measured: {c.measured}</p><p>Threshold used: {c.threshold}{c.revision!=null?` (revision ${c.revision})`:''}</p>
     <p>{c.explanation}</p>
     {c.setting&&<p>Current setting: {current?String(current.values[c.setting]):'Unavailable until loaded'}{field&&'unit' in field?` ${field.unit}`:''}. <a href={`/dashboard/admin/quality#${c.setting}`} className="underline">Edit {field?.label??c.setting}</a></p>}
    </div>;
   })}</div>
  </details>}
 </div>;
}
