export async function preprocessImage(file: File, scale = 1.5): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // create canvas and upscale
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Cannot get canvas context'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // convert to grayscale + simple binary threshold
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const avg = (r + g + b) / 3;
        const value = avg > 180 ? 255 : 0; // threshold
        data[i] = data[i + 1] = data[i + 2] = value;
      }
      ctx.putImageData(imageData, 0, 0);

      resolve(canvas);
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}