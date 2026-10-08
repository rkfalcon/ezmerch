import sharp from "sharp";
import {defaultQualityValues} from "../lib/lineup/quality-policy";
const settingsChain={select:()=>settingsChain,eq:()=>settingsChain,single:async()=>({data:{revision:1,values:defaultQualityValues},error:null})};
import test from "node:test";
import assert from "node:assert/strict";
import { approvedLogo } from "../lib/lineup/prepared-logo";
test("server selects completed enhancement without requiring or trusting owner approval", async () => {
  const row = {
    id: "00000000-0000-0000-0000-000000000001",
    status: "enhanced",
    metadata: { width: 500 },
    enhanced_metadata: {
      width: 2000,
      height: 2000,
      sourceWidth: 500,
      sourceHeight: 500,
      enhanced: true,
      reviewed: true,
      visualComparison: { version: 1, status: "passed", sourceHash: "different-original", enhancedHash: "different-output", reasons: [], smallestTextHeightFraction: null },
    },
    warnings: [],
  };
  const bytes=await sharp({create:{width:16,height:16,channels:4,background:"red"}}).png().toBuffer();
  const paths: string[] = [];
  const chain = {
    update: () => chain,
    select: () => chain,
    eq: () => chain,
    single: async () => ({ data: row, error: null }),
  };
  const db = {
    from: (table:string) => table==="artwork_quality_settings"?settingsChain:chain,
    storage: {
      from: () => ({
        download: async (p: string) => {
          paths.push(p);
          return { data: new Blob([new Uint8Array(bytes)]), error: null };
        },
      }),
    },
  } as unknown as Parameters<typeof approvedLogo>[0];
  const form = new FormData();
  form.set("preparationId", row.id);
  form.set("useEnhanced", "false");
  form.set("logoReviewed", "true");
  const selected = await approvedLogo(db, "owner", form);
  assert.match(paths[0], /enhanced.png$/);
  assert.match(paths[1], /clean.png$/);
  assert.equal(selected.metadata.reviewed, false);
  assert.equal(selected.metadata.visualComparison?.status, "review", "A cached pass for other image bytes must never approve this upload");
  form.delete("logoReviewed");
  assert.equal(
    (await approvedLogo(db, "owner", form)).metadata.reviewed,
    false,
  );
});

test('unenhanced originals also carry the cached server artwork screening', async () => {
  const {imageHash, comparisonVersion} = await import('../lib/lineup/visual-comparison');
  const bytes=await sharp({create:{width:16,height:16,channels:4,background:"red"}}).png().toBuffer();
  const visualComparison={version:comparisonVersion,policyRevision:1,policy:{revision:1,values:defaultQualityValues},status:'passed',sourceHash:imageHash(bytes),enhancedHash:imageHash(bytes),reasons:[],smallestTextHeightFraction:null};
  const row={id:'00000000-0000-0000-0000-000000000002',status:'prepared',metadata:{width:2400,enhanced:false,visualComparison},warnings:[]};
  const chain={select:()=>chain,eq:()=>chain,single:async()=>({data:row,error:null})};
  const db={from:(table:string)=>table==="artwork_quality_settings"?settingsChain:chain,storage:{from:()=>({download:async()=>({data:new Blob([new Uint8Array(bytes)]),error:null})})}} as unknown as Parameters<typeof approvedLogo>[0];
  const form=new FormData(); form.set('preparationId',row.id);
  const selected=await approvedLogo(db,'owner',form);
  assert.equal(selected.metadata.visualComparison,visualComparison);
  assert.equal(selected.metadata.enhanced,false);
});
