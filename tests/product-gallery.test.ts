import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryStyles, galleryImages, selectedGallery } from '../lib/lineup/gallery';
test('preferred styles and available fallbacks apply to all product categories',()=>{
 assert.deepEqual(galleryStyles('T-Shirts',["Men's 5","Women's 5","Couple's","Flat"]),["Men's 5","Women's 5","Couple's"]);
 assert.deepEqual(galleryStyles('Hats & Beanies',["Men's 5"]),["Men's 5"]);
 assert.deepEqual(galleryStyles('Long Sleeve Shirts',["Men's","Women's",'Ghost','Flat']),["Men's","Women's",'Flat']);
 assert.deepEqual(galleryStyles('Tank Tops',["Men's","Men's 2","Men's 3",'Flat','Labels']),["Men's 2","Men's 3",'Flat']);
 assert.deepEqual(galleryStyles('Home & Living',['Default','Lifestyle','Flat','Product details','Holiday season']),['Lifestyle','Flat','Product details']);
 assert.deepEqual(galleryStyles('Bags & Accessories',['Flat','Product details'],['Flat']),['Product details']);
 assert.deepEqual(galleryStyles('New category',['Ghost','Labels','Templates','Production','Halloween']),[]);
});
test('extracts requested front views from extras and primary with color mappings',()=>{
 const result=galleryImages([{placement:'front',variant_ids:[1],mockup_url:'couple',extra:[{option:'Front',option_group:"Men's 5",url:'men'},{option:'Back',option_group:"Men's 5",url:'back'},{option:'Front',option_group:"Women's 5",url:'women'}]}],["Men's 5","Women's 5","Couple's"],[{id:1,variantIds:[1,2]}]);
 assert.deepEqual(result.map(i=>[i.url,i.style,i.variant_ids]),[['men',"Men's 5",[1,2]],['women',"Women's 5",[1,2]],['couple',"Couple's",[1,2]]]);
});
test('gallery never shows another color and preserves primary first',()=>{
 const images=[{url:'men-red',style:"Men's 5",variant_ids:[1,2]},{url:'men-blue',style:"Men's 5",variant_ids:[3]}];
 assert.deepEqual(selectedGallery('ghost-red',2,images).map(i=>i.url),['ghost-red','men-red']);
 assert.deepEqual(selectedGallery('ghost-blue',3,images).map(i=>i.url),['ghost-blue','men-blue']);
});

test('fallback extraction retains detail views and non-front placement mockups',()=>{
 const images=galleryImages([{placement:'default',variant_ids:[1],mockup_url:'flat',extra:[{option:'Product details',option_group:'Product details',url:'detail'},{option:'Back',option_group:'Lifestyle',url:'back'},{option:'Front',option_group:'Lifestyle',url:'front'}]}],['Lifestyle','Flat','Product details'],[{id:1,variantIds:[1]}]);
 assert.deepEqual(images.map(i=>[i.style,i.url]),[['Lifestyle','front'],['Flat','flat'],['Product details','detail']]);
});
test('back artwork favors back views instead of blank front views',()=>{
 assert.equal(galleryImages([{placement:'back',variant_ids:[1],mockup_url:'main',extra:[{option:'Front',option_group:'Lifestyle',url:'front'},{option:'Back',option_group:'Lifestyle',url:'back'}]}],['Lifestyle'],[{id:1,variantIds:[1]}],'back')[0].url,'back');
});

test('a back extra does not conceal the primary flat front image',()=>{
 const images=galleryImages([{placement:'front',variant_ids:[1],mockup_url:'flat-front',extra:[
 {option:'Back',option_group:'Flat',url:'blank-back'},
 {option:'Front',option_group:"Men's 2",url:'model'}
 ]}],["Men's 2",'Flat'],[{id:1,variantIds:[1]}]);
 assert.equal(images.find(i=>i.style==='Flat')?.url,'flat-front');
});
