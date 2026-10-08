import test from 'node:test';
import assert from 'node:assert/strict';
import { brandedFiles, insideLabelPlacement, insideLabelTone } from '../lib/lineup/inside-label';
import { addInsideLabels } from '../lib/lineup/inside-label-server';
import type { CatalogProduct } from '../lib/lineup/types';
const product = { techniques:[{key:'DTG',display_name:'DTG',is_default:true}], files: [{ id: 'label_inside', type: 'label_inside', title: 'Inside label' }] } as CatalogProduct;
test('catalog support includes DTF labels but excludes outside labels', () => {
  assert.equal(insideLabelPlacement(product)?.type, 'label_inside');
  assert.equal(insideLabelPlacement({...product,techniques:[{key:'CUT-SEW',display_name:'AOP',is_default:true}]}),undefined);
  assert.equal(insideLabelPlacement({...product,files:[{id:'x',type:'label_inside_dtf',title:''}]})?.type,'label_inside_dtf');
  assert.equal(insideLabelPlacement({files:[{id:'x',type:'label_outside',title:''}]}),undefined);
});
test('selects contrasting label and preserves exterior artwork', () => {
  assert.equal(insideLabelTone('#FFFFFF'),'black');
  assert.equal(insideLabelTone('#000000'),'white');
  assert.throws(()=>insideLabelTone('unknown'));
  const front = {type:'front',url:'https://example.com/store-logo.png'};
  const result = brandedFiles([front], product, '#000000');
  assert.deepEqual(result[0], front);
  assert.match(result[1].url,/white.png$/);
  assert.deepEqual(result[1].options,[{id:'template_type',value:'native'}]);
  assert.equal(brandedFiles(result,product,'#000000').length,2);
  assert.throws(()=>brandedFiles([{type:'label_outside',url:'x'}], product,'#FFFFFF'),/conflict/);
});
test('unsupported products retain original files',()=>{
  const files=[{type:'front',url:'x'}];assert.deepEqual(brandedFiles(files,{} as CatalogProduct,'unknown'),files);
});
test('resolves each catalog once and labels all variants',async()=>{
  const paths:string[]=[];
  const payload={sync_variants:[1,2].map(variant_id=>({variant_id,files:[{type:'front',url:'x'}]}))};
  const result=await addInsideLabels(payload,async <T>(path:string):Promise<T>=>{
    paths.push(path);
    return (path.includes('/variant/')?{variant:{product_id:71}}:{product,variants:[{id:1,color_code:'#FFFFFF'},{id:2,color_code:'#000000'}]}) as T;
  });
  assert.equal(paths.length,2);assert.match(result.sync_variants[0].files[1].url,/black.png$/);assert.match(result.sync_variants[1].files[1].url,/white.png$/);
});
