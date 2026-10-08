import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesTechnique, templateTechnique} from '../lib/lineup/catalog-techniques';
import type {CatalogProduct} from '../lib/lineup/types';
const product = (key:string):CatalogProduct => ({id:1,title:'Product',model:'',brand:'',image:'',is_discontinued:false,techniques:[{key,display_name:key,is_default:true}]});
test('printing filter excludes embroidery, knitting and missing technique data',()=>{
 for(const key of ['DTG','DTFILM','SUBLIMATION','UV','DIGITAL','CUT-SEW','DIRECT-TO-FABRIC']) assert.equal(matchesTechnique(product(key),'non-embroidery'),true);
 for(const key of ['EMBROIDERY','KNITWEAR','']) assert.equal(matchesTechnique(product(key),'non-embroidery'),false);
 assert.equal(matchesTechnique({...product('DTG'),techniques:[]},'non-embroidery'),false);
 assert.equal(matchesTechnique({...product('DTG'),techniques:[]},'all'),true);
});
test('filter follows selected technique on mixed-technique products',()=>{
 const p=product('EMBROIDERY');p.techniques!.push({key:'DTFILM',display_name:'DTF',is_default:false});
 assert.equal(matchesTechnique(p,'non-embroidery'),true);
 assert.equal(matchesTechnique(p,'DTFILM'),true);
 assert.equal(templateTechnique(p),'embroidery');
 assert.equal(templateTechnique(p,'non-embroidery'),'dtfilm');
 assert.equal(templateTechnique(p,'DTFILM'),'dtfilm');
 assert.equal(templateTechnique(product('DTG')),'dtg');
 assert.equal(templateTechnique(product('SUBLIMATION')),'sublimation');
});
