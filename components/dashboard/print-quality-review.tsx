"use client";
import Link from "next/link";
import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import type {PrintQualityReport} from "@/lib/lineup/print-quality";
import type {ProductTemplate} from "@/lib/lineup/types";
import {reviewMockupResult} from "@/lib/lineup/review-mockup-result";
import {QualityCheckBreakdown} from "./quality-check-breakdown";
import {Button} from "@/components/ui/button";

export function PrintQualityReview({quality,storeId,jobId,template,image,imageKind,held,reviewImage,onQueued}:{
 onQueued:()=>void;
 quality:PrintQualityReport;storeId:string;jobId:string;template?:ProductTemplate;
 reviewImage?:string|null; image?:string|null;imageKind?:string;held?:boolean;
}){
 const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [open,setOpen]=useState(false),[scale,setScale]=useState(Math.round(Number(template?.scale??.8)*100));
 const [placement,setPlacement]=useState(template?.placement??"front");
 const [mockup,setMockup]=useState<string|null>(reviewImage??null);
 const router=useRouter();
 const embroidery=template?.technique.includes("embroidery")??false;
 const [imageLoaded,setImageLoaded]=useState(false),[retryPreview,setRetryPreview]=useState(0);
 const [submitting,setSubmitting]=useState(false);
 const [previewError,setPreviewError]=useState(false);
 const approved=quality.status==="ready"||!!quality.reviewedAt;
 useEffect(()=>{
  if(!held||approved||quality.status!=="review"||submitting)return;
  let cancelled=false;
  let timer:ReturnType<typeof setTimeout>;
  const controller=new AbortController();
  async function load(){
   try{
    const response=await fetch("/api/lineup/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({storeId,jobId}),signal:controller.signal});
    const result=await response.json();
    if(cancelled)return;
    if(response.status===409||response.status===429){
     setMessage("Preparing the product preview automatically. Waiting for an available rendering slot.");
     timer=setTimeout(load,Math.min(60000,Math.max(15000,result.retryAfterMs||15000)));return;
    }
    if(!response.ok)throw Error(result.error);
    const outcome=reviewMockupResult(result);
    if(outcome.image){setMockup(outcome.image);setMessage("");setPreviewError(false);return;}
    setMessage("Preparing the product preview…");
    timer=setTimeout(load,10000);
   }catch(error){
    if(!cancelled){setPreviewError(true);setMessage(error instanceof Error?error.message:"Could not prepare product preview.");}
   }
  }
  void load();
  return ()=>{cancelled=true;controller.abort();clearTimeout(timer);};
 },[embroidery,held,approved,quality.status,storeId,jobId,retryPreview,submitting]);

 async function update(values:Record<string,unknown>){
  setSubmitting(true);setMessage("Saving adjustment…");setBusy(true);setChecked(false);setMockup(null);setImageLoaded(false);
  try{
   const r=await fetch("/api/lineup/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({storeId,jobId,...values})});
   const result=await r.json();if(!r.ok)throw Error(result.error);
   setMessage(values.approveQuality?"Review recorded. Generation will continue.":"Checks queued. The preview and dimensions will update after processing.");
   onQueued();
   router.refresh();
  }catch(e){setSubmitting(false);setMessage(e instanceof Error?e.message:"Could not update design");}
  finally{setBusy(false);}
 }
 const currentMockup=submitting?null:(mockup||reviewImage||(imageKind==="mockup"?image:null));
 const smallest=quality.visualComparison?.smallestTextHeightFraction;
 return <div className="mt-2 w-full max-w-xl space-y-3 rounded border p-3 text-sm">
  <p className="font-medium">{approved?"Print quality checked":"VeryMerch design review"}</p>
  <p>{quality.message}</p>
  <QualityCheckBreakdown quality={quality} embroidery={embroidery}/>
  {quality.policyRevision!=null&&<p className="text-xs text-muted-foreground">Quality settings revision {quality.policyRevision}. <Link href="/dashboard/admin/quality" className="underline">View quality settings</Link></p>}
  {!approved&&<p className="text-muted-foreground">This product stays unavailable while VeryMerch resolves the artwork. No action is required from the store owner.</p>}
  <ul className="space-y-1 text-xs">{quality.areas.map(a=><li key={a.id}>
   Logo: {a.widthInches.toFixed(2)}″ × {a.heightInches.toFixed(2)}″ {!embroidery&&<> · Original: {a.sourceDpi} PPI · Prepared: {a.outputDpi} PPI · Required: {a.requiredDpi} PPI</>}
   {!embroidery&&typeof smallest==="number"&&<span className="block">Estimated smallest lettering: {(a.heightInches*smallest*25.4).toFixed(2)} mm. Automated estimate, not a production rejection.</span>}
  </li>)}</ul>
  {!embroidery&&!held&&<Button variant="outline" onClick={()=>setOpen(!open)}>{open?"Close placement review":"Review product placement"}</Button>}
  {(embroidery||held||open)&&<div className="space-y-3">
   {(embroidery||held) ? (
    currentMockup ?
      <a href={currentMockup} target="_blank" rel="noopener noreferrer">
       <img key={currentMockup} src={currentMockup} onLoad={()=>setImageLoaded(true)} onError={()=>{setImageLoaded(false);setPreviewError(true);setMessage("The preview image could not load. Retry the product preview.");}} alt="Product mockup for placement approval" className="aspect-square w-full rounded border object-contain"/>
      </a> : <div role="status" className="rounded bg-muted p-4">
       {!previewError&&<span aria-hidden="true" className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
       {message||"Preparing the product mockup…"}
       {!previewError&&<p className="mt-2 text-xs">The updated product image will appear automatically. No refresh is needed.</p>}
      </div>
   ) : (mockup||image)?<a href={mockup||image!} target="_blank" rel="noopener noreferrer"><img src={mockup||image!} alt="Prepared logo placement on product" className="aspect-square w-full rounded border object-contain"/></a>:<p>Product preview is not available yet. Run automatic checks to prepare it.</p>}
   <p className="text-xs">{embroidery ? "Embroidery mockup. Review the logo, lettering and placement. This is a digital preview of the stitched appearance." : (currentMockup||imageKind==="mockup"?"Actual Product mockup.":"Placement simulation; use the product mockup to check garment appearance.")}</p>
   {previewError&&held&&<Button variant="outline" disabled={busy} onClick={()=>{setPreviewError(false);setMockup(null);setRetryPreview(n=>n+1);}}>Retry product preview</Button>}
   {!embroidery&&quality.proofs?.map(proof=><div key={proof.id} className="space-y-1">
    <a className="block text-xs underline" href={proof.url} target="_blank" rel="noopener noreferrer">Download production PNG (full print canvas, not a product preview)</a>
   </div>)}
  </div>}
  {!approved&&held&&template&&<div className="space-y-2 border-t pt-3">
   <p className="font-medium">Adjust and reassess this product</p>
   <label className="block">Placement
    <select className="ml-2 max-w-full rounded border p-1" value={placement} onChange={e=>setPlacement(e.target.value)} disabled={busy}>
     {template.technique==="dtg"&&["front","front_left_chest"].includes(template.placement)?<><option value="front">Centered front</option><option value="front_left_chest">Left chest</option></>:<option value={template.placement}>{template.placement.replaceAll("_"," ")}</option>}
    </select>
   </label>
   <label className="block">Preferred size (% of placement area)
    <input className="ml-2 w-20 rounded border p-1" type="number" min={1} max={100} value={scale} disabled={busy} onChange={e=>setScale(Number(e.target.value))}/>
   </label>
   <p className="text-xs">The system will try nearby sizes if needed. Review the resulting dimensions and refreshed preview.</p>
   <Button disabled={busy||scale<1||scale>100} onClick={()=>update({adjustment:{scale:scale/100,placement}})}>Adjust & regenerate preview</Button>
   <Button variant="outline" disabled={busy} onClick={()=>update({prepareAgain:true})}>Retry automatic adjustments</Button>
  </div>}
  {!approved&&held&&quality.status==="review"&&<>
   <label className="flex items-start gap-2"><input type="checkbox" checked={checked} disabled={busy||((embroidery||held)&&!imageLoaded)} onChange={e=>setChecked(e.target.checked)}/>{embroidery?"I reviewed the embroidery mockup and approve the logo appearance and placement for embroidery.":"I reviewed the placement and physical lettering size and accept this design for printing."}</label>
   <Button disabled={!checked||busy||((embroidery||held)&&!imageLoaded)} onClick={()=>update({approveQuality:true})}>{embroidery?"Approve embroidery & continue":"Approve design & continue"}</Button>
   <p className="text-xs">If unsuitable, leave it unapproved. It will remain unavailable for purchase while VeryMerch prepares a better design.</p>
  </>}
  {currentMockup&&imageLoaded&&<p role="status">Preview ready — review the updated logo and placement above.</p>}
  {message&&(!embroidery||!!currentMockup)&&<p role="status">{message}</p>}
 </div>;
}
