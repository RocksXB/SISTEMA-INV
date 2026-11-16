export const maxNpcPortrait = 8 * 1024 * 1024;
const maxPortraitSource = 24 * 1024 * 1024;
const maxDimension = 960;

export function portraitSourceLimit(compress: boolean) {
  return compress ? maxPortraitSource : maxNpcPortrait;
}

async function isAnimated(image: Blob) {
  if (image.type === "image/gif") return true;
  if (image.type === "image/webp") {
    const header = new Uint8Array(await image.slice(0, 21).arrayBuffer());
    return String.fromCharCode(...header.slice(12, 16)) === "VP8X" && (header[20] & 2) !== 0;
  }
  if (image.type !== "image/png") return false;
  const bytes = new DataView(await image.arrayBuffer());
  for (let offset = 8; offset + 8 <= bytes.byteLength;) {
    const length = bytes.getUint32(offset);
    const chunk = bytes.getUint32(offset + 4);
    if (chunk === 0x6163544c) return true; // acTL
    if (chunk === 0x49444154) return false; // IDAT
    offset += length + 12;
  }
  return false;
}

export async function prepareNpcPortrait(source: Blob, compress: boolean): Promise<Blob> {
  if (source.size > portraitSourceLimit(compress)) {
    throw Error(compress ? "Selecione uma imagem de até 24 MB para comprimir." : "O retrato original deve ter até 8 MB.");
  }
  if (!compress || await isAnimated(source)) {
    if (source.size > maxNpcPortrait) throw Error("Envie uma imagem animada de até 8 MB.");
    return source;
  }
  const bitmap = await createImageBitmap(source).catch(() => {
    throw Error("Não foi possível abrir essa imagem para comprimir.");
  });
  try {
    const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw Error("A compressão não está disponível neste navegador.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encoded = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
    if (encoded && encoded.size <= maxNpcPortrait && encoded.size < source.size) return encoded;
    if (source.size <= maxNpcPortrait) return source;
    throw Error("A imagem comprimida ultrapassou 8 MB.");
  } finally {
    bitmap.close();
  }
}
