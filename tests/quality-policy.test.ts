import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultQualityValues,validateQualityValues} from '../lib/lineup/quality-policy';
import {assessPrintQuality} from '../lib/lineup/print-quality';
import {planArtwork} from '../lib/lineup/artwork-plan';
import {analyzeTransparency} from '../lib/lineup/logo-transparency';
import type {ProductTemplate} from '../lib/lineup/types';
const policy={revision:12,values:{...defaultQualityValues,printTextMm:0.9}};
const area={printfile_id:816,width:1500,height:600,dpi:300};
const logo={sourceWidth:1000,sourceHeight:1000,width:2000,height:2000,enhanced:true,reviewed:false,visualComparison:{version:2,status:'passed' as const,reasons:[],sourceHash:'source',enhancedHash:'prepared',checkedAt:'now',model:'test',smallestTextHeightFraction:0.018}};
test('0.90 mm lettering policy accepts Sunday Sauce at full hat size, retains other checks and records revision',()=>{
 assert.equal(assessPrintQuality(logo,[area],1,'front_dtf_hat','dtfilm').status,'review');
 const report=assessPrintQuality(logo,[area],1,'front_dtf_hat','dtfilm',policy);
 assert.equal(report.status,'ready');assert.equal(report.policyRevision,12);
 assert.equal(assessPrintQuality(logo,[area],.8,'front_dtf_hat','dtfilm',policy).status,'review');
 assert.equal(assessPrintQuality({...logo,width:100,height:100},[area],1,'front_dtf_hat','dtfilm',policy).status,'blocked');
 assert.equal(assessPrintQuality({...logo,visualComparison:{...logo.visualComparison,reasons:['Lettering changed'],status:'review'}},[area],1,'front_dtf_hat','dtfilm',policy).status,'review');
});
test('enabling larger DTF candidates uses the configured lettering threshold',()=>{
 const template={scale:.8,technique:'dtfilm',placement:'front_dtf_hat'} as ProductTemplate;
 assert.equal(planArtwork(logo,[area],template,policy).quality.status,'review');
 const result=planArtwork(logo,[area],template,{...policy,values:{...policy.values,growOtherPrints:true}});
 assert.equal(result.quality.status,'ready');assert.ok(result.plan.scale>.8);
});
test('validates every field and rejects invalid settings rather than silently falling back',()=>{
 assert.deepEqual(validateQualityValues(defaultQualityValues),defaultQualityValues);
 for(const values of [{...defaultQualityValues,printTextMm:NaN},{...defaultQualityValues,printTextMm:-1},{...defaultQualityValues,embroideryColors:1.5},{...defaultQualityValues,alphaLow:250,alphaHigh:200},{...defaultQualityValues,allowEdgeSmoothing:'yes'},{...defaultQualityValues,extra:1},{}])assert.throws(()=>validateQualityValues(values));
});
test('configured transparency percentage changes detection',()=>{
 const pixels=Buffer.from([0,0,0,255,0,0,0,128]);
 assert.equal(analyzeTransparency(pixels,2,1).semiTransparent,true);
 assert.equal(analyzeTransparency(pixels,2,1,{...defaultQualityValues,partialPixelPercent:60}).semiTransparent,false);
});
