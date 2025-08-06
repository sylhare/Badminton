export interface PixelCropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Creates a new File containing the cropped region of an image selected via `react-easy-crop`.
 *
 * @param imageSrc ObjectURL / data URL of the source image to crop
 * @param cropPixels Pixel coordinates produced by `onCropComplete` (react-easy-crop)
 * @returns Promise that resolves with a PNG `File` representing the cropped image
 */
export async function getCroppedImageFile(
  imageSrc: string,
  cropPixels: PixelCropArea,
): Promise<File> {
  // Load the image so we can draw it to a canvas
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  // Create a canvas with the desired size of the crop
  const canvas = document.createElement('canvas');
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context while cropping image');
  }

  // Draw the cropped portion of the image onto the canvas
  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height,
  );

  // Convert the canvas back to a Blob / File
  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b as Blob), 'image/png');
  });

  const file = new File([blob], 'cropped.png', { type: 'image/png' });
  return file;
}