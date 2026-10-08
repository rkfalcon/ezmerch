import test from "node:test";
import assert from "node:assert/strict";
import { storeProductSummary } from "../lib/lineup/store-product-summary";
const product = {id:"p",published:true,default_color:"Green Camo",enabled_colors:null,global_enabled_colors:null,variants:[
 {variant_id:1,name:"Black",color:"Black",size:"One size",retail_price:"27.00",image_url:"black"},
 {variant_id:2,name:"Camo",color:"Green Camo",size:"One size",retail_price:"28.00",image_url:"camo"},
]};
test("lineup card reflects saved default color and actual store prices",()=>{
 const summary=storeProductSummary(product);
 assert.equal(summary.image,"camo");
 assert.equal(summary.variants[1].retail_price,"28.00");
 assert.equal(summary.published,true);
});
test("previous artwork never becomes the default during regeneration",()=>{
 assert.equal(storeProductSummary({...product,variants:product.variants.map(v=>({...v,artwork_pending:true}))}).image,null);
 assert.equal(storeProductSummary({...product,variants:[product.variants[0],{...product.variants[1],artwork_pending:true}]}).image,"black");
});
