import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPrintQuality} from '../lib/lineup/print-quality';
import {defaultQualityValues} from '../lib/lineup/quality-policy';
const logo={width:2000,height:2000,sourceWidth:1000,sourceHeight:1000,enhanced:true,reviewed:false,visualComparison:{version:2,status:'passed' as const,reasons:[],sourceHash:'a',enhancedHash:'b',checkedAt:'now',model:'test',smallestTextHeightFraction:.018}};
const area={printfile_id:816,width:1500,height:600,dpi:300};
test('review records measured lettering and exact threshold snapshot with setting link key',()=>{
 const policy={revision:7,values:{...defaultQualityValues}};
 const report=assessPrintQuality(logo,[area],1,'front_dtf_hat','dtfilm',policy);
 const text=report.checks!.find(c=>c.id==='text-816')!;
 assert.equal(text.setting,'printTextMm');assert.equal(text.measured,'0.9144 mm');assert.equal(text.threshold,'At least 2.032 mm');assert.equal(text.result,'review');
 policy.values.printTextMm=.9;
 assert.equal(report.policy!.values.printTextMm,2.032);
 const pass=assessPrintQuality(logo,[area],1,'front_dtf_hat','dtfilm',policy);
 assert.equal(pass.checks!.find(c=>c.id==='text-816')!.result,'pass');
 assert.equal(report.checks!.find(c=>c.id==='resolution-816')!.result,'pass');
});
test('missing measurements and image thresholds are not invented',()=>{
 const report=assessPrintQuality({...logo,visualComparison:{...logo.visualComparison,smallestTextHeightFraction:undefined}},[area],1,'front','dtfilm');
 assert.equal(report.checks!.find(c=>c.id==='text-816')!.result,'not-measured');
 assert.equal(report.checks!.find(c=>c.id==='meanDifference')!.threshold,'Threshold not recorded with this image comparison');
});
test('every configurable setting has a mapped check, including inapplicable and unmeasured ones',async()=>{
 const {qualityFields,qualitySwitches}=await import('../lib/lineup/quality-policy');
 const report=assessPrintQuality(logo,[area],1,'front_dtf_hat','dtfilm');
 for(const setting of [...Object.keys(qualityFields),...Object.keys(qualitySwitches)])assert.ok(report.checks!.some(c=>c.setting===setting),setting);
 assert.equal(report.checks!.find(c=>c.setting==='embroideryColors')!.result,'not-applicable');
});
test('legacy breakdown preserves recorded resolution but never invents a lettering threshold',async()=>{
 const {legacyQualityChecks}=await import('../lib/lineup/quality-checks');
 const report=assessPrintQuality(logo,[area],1,'front_dtf_hat','dtfilm');
 const rows=legacyQualityChecks({...report,checks:undefined,policy:undefined});
 assert.equal(rows.find(c=>c.id==='legacy-text-816')!.threshold,'Threshold not recorded');
 assert.equal(rows.find(c=>c.id==='legacy-resolution-816')!.threshold,'At least 300 PPI');
});
