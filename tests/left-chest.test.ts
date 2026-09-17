import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fitArtwork, renderArtwork } from "../lib/lineup/artwork";
import { printfulPlacement, leftChestPlacement } from "../lib/lineup/placement";
test("left chest fits the wearer left (viewer right) chest region and preserves proportions", async () => {
  const fit=fitArtwork(400,200,1200,1600,0.8,leftChestPlacement);
  assert.equal(fit.width/fit.height,2);
  assert.equal(fit.left+fit.width/2,900);
  assert.equal(fit.top+fit.height/2,288);
  assert.ok(fit.left+fit.width<=1200);
  const logo=await sharp({create:{width:400,height:200,channels:4,background:"red"}}).png().toBuffer();
  const art=await renderArtwork(logo,1200,1600,0.8,leftChestPlacement);
  const {data,info}=await sharp(art).raw().toBuffer({resolveWithObject:true});
  assert.equal(data[(288*info.width+900)*4+3],255);
  assert.equal(data[(800*info.width+600)*4+3],0);
  assert.equal(printfulPlacement(leftChestPlacement),"front");
  assert.equal(printfulPlacement("embroidery_chest_left"),"embroidery_chest_left");
});
