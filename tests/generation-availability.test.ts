import test from "node:test";
import assert from "node:assert/strict";
import {generationUnavailable} from "../lib/lineup/generation-availability";
test("stock holds and discontinued products are unavailable, not ordinary queued previews",()=>{
 assert.equal(generationUnavailable("No available variants for this product"),true);
 assert.equal(generationUnavailable("This Printful product has been discontinued"),true);
 for(const error of [null,undefined,"","Printful 429","Mockup timed out"])
   assert.equal(generationUnavailable(error),false);
});
