import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {PDFDocument, PDFRawStream, decodePDFRawStream} from "pdf-lib";
import {planArtwork} from "../lib/lineup/artwork-plan";
import {resetReview} from "../lib/lineup/review-adjustment";
import {actualSizeReviewPdf} from "../lib/lineup/review-pdf";
import type {ProductTemplate} from "../lib/lineup/types";
import type {LogoQuality} from "../lib/lineup/print-quality";

const area={printfile_id:1,width:1800,height:2400,dpi:150};
const template={scale:.8,placement:"front_left_chest",technique:"dtg"} as ProductTemplate;
const logo:LogoQuality={width:2136,height:2164,sourceWidth:534,sourceHeight:541,enhanced:true,reviewed:false,
 visualComparison:{version:2,status:"passed",reasons:[],smallestTextHeightFraction:.018,
 sourceHash:"source",enhancedHash:"enhanced",checkedAt:"now",model:"test"}};
test("Sunday Sauce finds a readable larger front only when template permits it",()=>{
 const held=planArtwork(logo,[area],template);
 assert.equal(held.quality.status,"review");
 assert.equal(held.plan.placement,"front_left_chest");
 assert.equal(held.quality.adjustmentsExhausted,true);
 const ready=planArtwork(logo,[area],{...template,allow_front_fallback:true});
 assert.equal(ready.quality.status,"ready");
 assert.equal(ready.plan.placement,"front");
 assert.ok(ready.quality.areas[0].heightInches*.018>=.08);
 assert.ok(ready.quality.areas[0].sourceDpi>=75);
});
test("same-placement enlargement resolves small text without switching location",()=>{
 const original={...logo,width:2000,height:2000,sourceWidth:2000,sourceHeight:2000,enhanced:false,
  visualComparison:{...logo.visualComparison!,smallestTextHeightFraction:.03}};
 const result=planArtwork(original,[area],{...template,scale:.5});
 assert.equal(result.plan.placement,"front_left_chest");
 assert.ok(result.plan.scale>.5);
 assert.equal(result.quality.status,"ready");
});
test("placement changes cannot approve damaged artwork",()=>{
 const result=planArtwork({...logo,visualComparison:{...logo.visualComparison!,status:"review",reasons:["Lettering changed."]}},[area],{...template,allow_front_fallback:true});
 assert.equal(result.quality.status,"review");
 assert.match(result.quality.message,/Lettering changed/);
});
test("admin adjustment invalidates stale proof/approval and rejects already submitted work",()=>{
 const state={batches:[{printfile:area,variantIds:[1],artworkUrl:"old"}],printQuality:{status:"review" as const,message:"x",areas:[]},instantPreview:"old"};
 const result=resetReview(state,template,{scale:.6,placement:"front"});
 assert.equal(result.template.placement,"front");
 assert.equal(result.state.printQuality,undefined);
 assert.equal(result.state.batches,undefined);
 assert.equal(result.state.instantPreview,undefined);
 assert.throws(()=>resetReview({...state,publishedVariantCount:1},template),/generation has started/);
 assert.throws(()=>resetReview({...state,batches:[{...state.batches[0],taskKey:"submitted"}]},template),/generation has started/);
 assert.throws(()=>resetReview(state,template,{scale:.7,placement:"back"}),/Unsupported/);
 assert.throws(()=>resetReview(state,template,{scale:1.1,placement:"front"}),/scale/);
});
test("actual-size PDF preserves physical inches and tiles large artwork",async()=>{
 const png=await sharp({create:{width:450,height:450,channels:4,background:"#dd0000"}}).png().toBuffer();
 const pdf=await PDFDocument.load(await actualSizeReviewPdf(png,150));
 assert.equal(pdf.getPageCount(),1);
 const content=[...pdf.context.enumerateIndirectObjects()].filter((entry):entry is [typeof entry[0],PDFRawStream]=>entry[1] instanceof PDFRawStream).map(([,stream])=>{
  try{return Buffer.from(decodePDFRawStream(stream).decode()).toString();}catch{return "";}
 }).join("\n");
 assert.match(content,/216 0 0 216/,"450 px /150 dpi should occupy exactly 216 PDF points");
 const large=await sharp({create:{width:1200,height:1500,channels:4,background:"#000000"}}).png().toBuffer();
 assert.equal((await PDFDocument.load(await actualSizeReviewPdf(large,150))).getPageCount(),4);
});


test("completed supplier review responses display the image even when task_key is present",async()=>{
 const {reviewMockupResult}=await import("../lib/lineup/review-mockup-result");
 assert.deepEqual(reviewMockupResult({task_key:"task",status:"completed",mockups:[{mockup_url:"https://example.com/preview.jpg"}]}),{image:"https://example.com/preview.jpg",taskKey:null});
 assert.deepEqual(reviewMockupResult({task_key:"task",status:"pending"}),{image:null,taskKey:"task"});
 assert.throws(()=>reviewMockupResult({task_key:"task",status:"failed",error:"Unavailable"}),/Unavailable/);
});
