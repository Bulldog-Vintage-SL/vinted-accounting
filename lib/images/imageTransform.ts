export interface TransformOptions {
  cropPercent?: number;
  noiseIntensity?: number;
  brightnessShift?: number;
  rotationDeg?: number;
}

export async function transformImage(
  file: File | Blob,
  options: TransformOptions = {}
): Promise<Blob> {
  const {
    cropPercent = 0.02,
    noiseIntensity = 5,
    brightnessShift = 0.05,
    rotationDeg = 0.1,
  } = options;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const cropX = Math.round(width * cropPercent);
  const cropY = Math.round(height * cropPercent);
  const cw = width - cropX * 2;
  const ch = height - cropY * 2;

  const canvas = new OffscreenCanvas(cw, ch);
  const ctx = canvas.getContext('2d')!;

  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.filter = `brightness(${1 + brightnessShift})`;
  ctx.drawImage(bitmap, -cropX - cw / 2, -cropY - ch / 2, width, height);
  ctx.filter = 'none';

  const imageData = ctx.getImageData(0, 0, cw, ch);
  addGaussianNoise(imageData.data, noiseIntensity);
  ctx.putImageData(imageData, 0, 0);

  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
}

function addGaussianNoise(data: Uint8ClampedArray, intensity: number) {
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      data[i + c] = data[i + c] + gaussian * intensity;
    }
  }
}