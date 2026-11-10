export function computeOtsuThreshold(grayPixels: Uint8Array): number {
  const histogram = new Int32Array(256);
  const total = grayPixels.length;
  for (let i = 0; i < total; i++) {
    histogram[grayPixels[i]]++;
  }

  let sum = 0;
  for (let t = 0; t < 256; t++) {
    sum += t * histogram[t];
  }

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 255; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varianceBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      threshold = t;
    }
  }

  return threshold;
}

export async function preprocessImage(blob: Blob): Promise<HTMLCanvasElement> {
  const blobUrl = URL.createObjectURL(blob);

  const imageEl = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = blobUrl;
  }).finally(() => {
    URL.revokeObjectURL(blobUrl);
  });

  const minDim = Math.min(imageEl.width, imageEl.height);
  let scale = minDim < 1400 ? 1400 / Math.max(minDim, 1) : 1;
  const maxDim = Math.max(imageEl.width, imageEl.height);
  if (maxDim * scale > 2500) {
    scale = 2500 / maxDim;
  }
  const targetWidth = Math.round(imageEl.width * scale);
  const targetHeight = Math.round(imageEl.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imageEl, 0, 0, targetWidth, targetHeight);

  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;
  const numPixels = targetWidth * targetHeight;
  const grayPixels = new Uint8Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const gray = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    grayPixels[i] = gray;
  }

  const threshold = computeOtsuThreshold(grayPixels);

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const val = grayPixels[i] >= threshold ? 255 : 0;
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
    data[idx + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
