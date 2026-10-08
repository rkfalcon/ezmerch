import test from 'node:test';
import assert from 'node:assert/strict';
import {PrintfulClient} from '../lib/lineup/printful';
import {stockTechnique} from '../lib/lineup/catalog-techniques';
import {techniqueCatalog} from '../lib/lineup/technique-catalog';
import type {ProductTemplate, MockupBatch} from '../lib/lineup/types';
test('DTF printfiles and mockups explicitly select DTF and its actual placement', async()=>{
 const calls:{url:string,body:{technique?:string;files:{placement:string}[]}}[]=[];
 const client=new PrintfulClient(async(url,init)=>{calls.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):null});return Response.json({result:{}});});
 await client.printfiles(206,'dtfilm');
 await client.createMockup(206,{variantIds:[7854],artworkUrl:'https://example.com/logo.png',printfile:{width:1500,height:600,dpi:300,printfile_id:816}} as MockupBatch,{technique:'dtfilm',placement:'front_dtf_hat',option_groups:[]} as unknown as ProductTemplate);
 assert.ok(calls[0].url.endsWith('?technique=DTFILM'));
 assert.equal(calls[1].body.technique,'DTFILM');
 assert.equal(calls[1].body.files[0].placement,'front_dtf_hat');
});
test('stock uses alternate technique but preserves legacy default templates',()=>{
 const product={techniques:[{key:'EMBROIDERY',is_default:true,display_name:'Embroidery'},{key:'DTFILM',is_default:false,display_name:'DTF'}]};
 assert.equal(stockTechnique('dtfilm',product),'dtfilm');
 assert.equal(stockTechnique('embroidery',product),'embroidery');
 assert.equal(stockTechnique('dtg',product),'embroidery');
});
test('alternate technique prices never reuse embroidery costs',async()=>{
 const client=new PrintfulClient(async(url)=>Response.json({result:String(url).includes('/prices')?{currency:'USD',variants:[{id:1,techniques:[{technique_key:'dtfilm',price:'16.75'}]}]}:{product:{techniques:[{key:'EMBROIDERY',is_default:true},{key:'DTFILM',is_default:false}]},variants:[{id:1,price:'18.25',in_stock:true},{id:2,price:'18.25',in_stock:true}]}}));
 const result=await techniqueCatalog(206,'dtfilm',client);
 assert.equal(result.variants[0].price,'16.75');
 assert.equal(result.variants[1].in_stock,false);
 assert.equal(result.variants[1].price,'');
 await assert.rejects(()=>techniqueCatalog(206,'uv',client),/does not support/);
});
