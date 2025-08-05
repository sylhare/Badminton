import { loadOpenCV } from './opencvLoader';

// ----------------------- helpers ---------------------------

/** Deskews an image by analysing dominant horizontal lines. */
function deskew(cv: any, srcGray: any): any {
  const edges = new cv.Mat();
  cv.Canny(srcGray, edges, 50, 150);

  const lines = new cv.Mat();
  // HoughLines: rho=1px, theta=1°, threshold=200
  cv.HoughLines(edges, lines, 1, Math.PI / 180, 200);

  let angleSum = 0;
  let count = 0;
  for (let i = 0; i < lines.rows; i++) {
    const theta = lines.data32F[i * 2 + 1];
    const deg = (theta * 180) / Math.PI;
    if (deg > 45 && deg < 135) {
      angleSum += deg - 90;
      count++;
    }
  }

  lines.delete();
  edges.delete();

  if (!count) return srcGray; // nothing detected, skip

  const angle = angleSum / count;
  if (Math.abs(angle) < 0.5) return srcGray; // negligible

  const rotMat = cv.getRotationMatrix2D(
    new cv.Point(srcGray.cols / 2, srcGray.rows / 2),
    angle,
    1,
  );
  const dst = new cv.Mat();
  cv.warpAffine(
    srcGray,
    dst,
    rotMat,
    new cv.Size(srcGray.cols, srcGray.rows),
    cv.INTER_LINEAR,
    cv.BORDER_REPLICATE,
  );
  rotMat.delete();
  srcGray.delete();
  return dst;
}

/**
 * Preprocesses the given image using OpenCV.js.
 * Steps:
 *  1. Upscale (auto scaling factor similar to previous logic)
 *  2. Convert to grayscale
 *  3. Adaptive threshold for robust binarisation
 *  4. Morphological closing to remove small holes / noise
 * Returns a canvas containing the processed image – call signature unchanged
 */
export async function preprocessImage(file: File): Promise<HTMLCanvasElement> {
  const cv = await loadOpenCV();

  const blobUrl = URL.createObjectURL(file);
  const imageEl = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = blobUrl;
  });

  // --- OpenCV pipeline --------------------------------------------------
  const src = cv.imread(imageEl); // RGBA Mat

  // Maintain previous auto-scaling behaviour
  const autoScale =
    Math.min(src.cols, src.rows) < 1400
      ? 1400 / Math.min(src.cols, src.rows)
      : 1.5;
  const dsize = new cv.Size(
    Math.round(src.cols * autoScale),
    Math.round(src.rows * autoScale),
  );
  const scaled = new cv.Mat();
  cv.resize(src, scaled, dsize, 0, 0, cv.INTER_LINEAR);

  // Grayscale conversion
  const gray = new cv.Mat();
  cv.cvtColor(scaled, gray, cv.COLOR_RGBA2GRAY);

  // ---------- 1. Local contrast enhancement (CLAHE) ----------
  const claheObj = new cv.CLAHE(2.0, new cv.Size(8, 8));
  const enhanced = new cv.Mat();
  claheObj.apply(gray, enhanced);
  claheObj.delete();
  gray.delete();

  // ---------- 2. Deskew (uses Canny + Hough) ----------
  const corrected = deskew(cv, enhanced);

  // ---------- 3. Threshold with Otsu ----------
  const bin = new cv.Mat();
  cv.threshold(corrected, bin, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
  corrected.delete();

  // Ensure text is dark on light background (Tesseract likes it)
  cv.bitwise_not(bin, bin);

  // ---------- 4. Morphological clean up ----------
  const kernelOpen = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
  cv.morphologyEx(bin, bin, cv.MORPH_OPEN, kernelOpen);
  kernelOpen.delete();

  const kernelClose = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, kernelClose);
  kernelClose.delete();

  // Draw the result to a canvas so the rest of the app can keep using it
  const outCanvas = document.createElement('canvas');
  cv.imshow(outCanvas, bin);

  // Cleanup mats and blob URL to avoid memory leaks
  src.delete();
  scaled.delete();
  // enhanced.delete(); // This line is removed as enhanced is deleted
  // corrected.delete(); // This line is removed as corrected is deleted
  bin.delete();
  // if a kernel was used, remember to delete it to free memory
  URL.revokeObjectURL(blobUrl);

  return outCanvas;
}