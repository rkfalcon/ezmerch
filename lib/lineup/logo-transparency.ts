import {defaultQualityValues,type QualityValues} from "./quality-policy";
/** Inspect source-resolution RGBA pixels; never use upscaled dimensions here. */
export function analyzeTransparency(rgba: Buffer, width: number, height: number, settings: QualityValues = defaultQualityValues) {
  if (rgba.length !== width * height * 4 || width < 1 || height < 1)
    throw new Error('Invalid RGBA dimensions');
  let visible = 0, partial = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] > 0) visible++;
    if (rgba[i] > settings.alphaLow && rgba[i] < settings.alphaHigh) partial++;
  }
  const semiTransparent = partial / Math.max(visible, 1) > settings.partialPixelPercent / 100;
  const transparency={partialPercent:partial / Math.max(visible,1)*100,settings:{partialPixelPercent:settings.partialPixelPercent,alphaLow:settings.alphaLow,alphaHigh:settings.alphaHigh,edgeSolidPixels:settings.edgeSolidPixels,edgeClearPixels:settings.edgeClearPixels,edgeOutlierPercent:settings.edgeOutlierPercent,edgeOutlierVisiblePercent:settings.edgeOutlierVisiblePercent,edgeOutlierClusterPixels:settings.edgeOutlierClusterPixels}};
  if (!partial) return { semiTransparent, edgeSmoothingOnly: false, transparency };
  // Exact Chebyshev distances; two passes keep work linear in image size.
  function distances(opaque: boolean) {
    const d = new Uint32Array(width * height).fill(Math.max(width,height)+1);
    for (let i = 0; i < d.length; i++)
      if (opaque ? rgba[i * 4 + 3] >= settings.alphaHigh : rgba[i * 4 + 3] <= settings.alphaLow) d[i] = 0;
    for (const forward of [true, false]) {
      const step = forward ? 1 : -1;
      for (let y = forward ? 0 : height - 1; y >= 0 && y < height; y += step)
        for (let x = forward ? 0 : width - 1; x >= 0 && x < width; x += step) {
          const i = y * width + x, px = x - step, py = y - step;
          if (px >= 0 && px < width) d[i] = Math.min(d[i], d[i - step] + 1);
          if (py >= 0 && py < height)
            for (let dx = -1; dx <= 1; dx++)
              if (x + dx >= 0 && x + dx < width)
                d[i] = Math.min(d[i], d[py * width + x + dx] + 1);
        }
    }
    return d;
  }
  const solid = distances(true), clear = distances(false);
  const outlierMask = new Uint8Array(width * height);
  let edgeSmoothingOnly = true,maxSolidDistance=0,maxClearDistance=0,outliers=0,detached=0,minOutlierAlpha=255,maxOutlierAlpha=0;
  for (let i = 0; i < solid.length; i++) {
    const a = rgba[i * 4 + 3];
    if(a>settings.alphaLow&&a<settings.alphaHigh){maxSolidDistance=Math.max(maxSolidDistance,solid[i]);maxClearDistance=Math.max(maxClearDistance,clear[i]);}
    if (a > settings.alphaLow && a < settings.alphaHigh && (solid[i] > settings.edgeSolidPixels || clear[i] > settings.edgeClearPixels)) {
      minOutlierAlpha=Math.min(minOutlierAlpha,a);maxOutlierAlpha=Math.max(maxOutlierAlpha,a);outlierMask[i]=1; edgeSmoothingOnly = false; outliers++; if(solid[i]>settings.edgeSolidPixels)detached++;

    }
  }
  let maxOutlierCluster = 0;
  for(let i=0;i<outlierMask.length;i++) {
    if(!outlierMask[i])continue;
    const pending=[i];outlierMask[i]=0;let count=0;
    while(pending.length) {
      const index=pending.pop()!;count++;
      const x=index%width,y=Math.floor(index/width);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
        const nx=x+dx,ny=y+dy;
        if(nx<0||nx>=width||ny<0||ny>=height)continue;
        const next=ny*width+nx;
        if(outlierMask[next]){outlierMask[next]=0;pending.push(next);}
      }
    }
    maxOutlierCluster=Math.max(maxOutlierCluster,count);
  }
  const outlierPercent=outliers/partial*100;
  const outlierVisiblePercent=outliers/Math.max(visible,1)*100;
  const minorOutliersAccepted=outliers>0 && detached===0 &&
    outlierPercent<=settings.edgeOutlierPercent &&
    outlierVisiblePercent<=settings.edgeOutlierVisiblePercent &&
    maxOutlierCluster<=settings.edgeOutlierClusterPixels;
  edgeSmoothingOnly ||= minorOutliersAccepted;
  return { semiTransparent, edgeSmoothingOnly,transparency:{...transparency,maxSolidDistance,maxClearDistance,minOutlierAlpha,maxOutlierAlpha,maxOutlierCluster,outliers,partial,visible,outlierPercent,outlierVisiblePercent,minorOutliersAccepted,detached,analysisVersion:2} };
}
