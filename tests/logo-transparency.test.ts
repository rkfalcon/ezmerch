import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultQualityValues} from '../lib/lineup/quality-policy';
import { analyzeTransparency } from '../lib/lineup/logo-transparency';
function artwork(alpha: (x:number,y:number)=>number) {
 const rgba=Buffer.alloc(40*40*4,255);
 for(let y=0;y<40;y++)for(let x=0;x<40;x++)rgba[(y*40+x)*4+3]=alpha(x,y);
 return analyzeTransparency(rgba,40,40);
}
test('accepts thin smoothing around an opaque shape',()=>{
 assert.equal(artwork((x,y)=>x<5||x>34||y<5||y>34?0:x<7||x>32||y<7||y>32?128:255).edgeSmoothingOnly,true);
});
test('rejects translucent interiors and isolated translucent artwork',()=>{
 assert.equal(artwork((x,y)=>x<5||x>34||y<5||y>34?0:128).edgeSmoothingOnly,false);
 assert.equal(artwork((x,y)=>x<5||x>34||y<5||y>34?0:x>17&&x<22?128:255).edgeSmoothingOnly,false);
});
test('rejects broad feathering',()=>{
 assert.equal(artwork((x,y)=>x<2||x>37||y<2||y>37?0:x<10||x>29||y<10||y>29?128:255).edgeSmoothingOnly,false);
});
test('opaque artwork needs no transparency exception',()=>{
 assert.equal(artwork(()=>255).semiTransparent,false);
});
test('allows a tiny interior artifact but rejects a long translucent seam',()=>{
 const width=300,height=300,rgba=Buffer.alloc(width*height*4,255);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)rgba[(y*width+x)*4+3]=x<5||y<5||x>294||y>294?0:x<7||y<7||x>292||y>292?128:255;
 for(let x=100;x<110;x++)rgba[(150*width+x)*4+3]=128;
 assert.equal(analyzeTransparency(rgba,width,height).edgeSmoothingOnly,true);
 for(let x=100;x<200;x++)rgba[(150*width+x)*4+3]=128;
 assert.equal(analyzeTransparency(rgba,width,height).edgeSmoothingOnly,false);
});
test('detached translucent specks do not receive an outlier exception',()=>{
 const width=300,height=300,rgba=Buffer.alloc(width*height*4,255);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)rgba[(y*width+x)*4+3]=x<20||y<20||x>279||y>279?0:x<22||y<22||x>277||y>277?128:255;
 rgba[(4*width+4)*4+3]=128;
 assert.equal(analyzeTransparency(rgba,width,height).edgeSmoothingOnly,false);
});
test('cluster cap still rejects seams when percentage limits pass; zero tolerance restores strict behavior',()=>{
 const width=300,height=300,rgba=Buffer.alloc(width*height*4,255);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)rgba[(y*width+x)*4+3]=x<5||y<5||x>294||y>294?0:x<7||y<7||x>292||y>292?128:255;
 for(let x=100;x<110;x++)rgba[(150*width+x)*4+3]=128;
 const defaults=analyzeTransparency(rgba,width,height);
 assert.ok('maxClearDistance' in defaults.transparency && defaults.transparency.maxClearDistance>5);
 assert.equal(analyzeTransparency(rgba,width,height,{...defaultQualityValues,edgeOutlierPercent:0}).edgeSmoothingOnly,false);
 for(let x=100;x<200;x++)rgba[(150*width+x)*4+3]=128;
 const result=analyzeTransparency(rgba,width,height,{...defaultQualityValues,edgeOutlierPercent:5,edgeOutlierVisiblePercent:1});
 assert.ok('outlierPercent' in result.transparency && result.transparency.outlierPercent<5);
 assert.ok('maxOutlierCluster' in result.transparency);
 assert.equal(result.transparency.maxOutlierCluster,100);
 assert.equal(result.edgeSmoothingOnly,false);
});
