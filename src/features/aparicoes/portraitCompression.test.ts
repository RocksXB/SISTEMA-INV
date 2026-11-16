import { afterEach, expect, it, vi } from "vitest";
import { prepareNpcPortrait } from "./portraitCompression";

afterEach(() => vi.unstubAllGlobals());

it("envia o original intacto quando escolhido e preserva GIF e WebP animado", async () => {
  const original = new Blob(["foto"], { type: "image/jpeg" });
  const gif = new Blob(["GIF89a"], { type: "image/gif" });
  const bytes = new Uint8Array(21);
  bytes.set(new TextEncoder().encode("VP8X"), 12);
  bytes[20] = 2;
  const animatedWebp = new Blob([bytes], { type: "image/webp" });
  await expect(prepareNpcPortrait(original, false)).resolves.toBe(original);
  await expect(prepareNpcPortrait(gif, true)).resolves.toBe(gif);
  await expect(prepareNpcPortrait(animatedWebp, true)).resolves.toBe(animatedWebp);
});

it("redimensiona a imagem estática e retorna o WebP comprimido", async () => {
  const source = new Blob(["foto original em alta resolução"], { type: "image/jpeg" });
  const encoded = new Blob(["foto comprimida"], { type: "image/webp" });
  const drawImage = vi.fn();
  const bitmap = { width: 1000, height: 2000, close: vi.fn() };
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }),
    toBlob: (complete: (blob: Blob) => void) => complete(encoded) };
  vi.stubGlobal("createImageBitmap", async () => bitmap);
  vi.stubGlobal("document", { createElement: () => canvas });
  await expect(prepareNpcPortrait(source, true)).resolves.toBe(encoded);
  expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 480, 960);
  expect(bitmap.close).toHaveBeenCalledOnce();
  const smaller = new Blob(["foto"], { type: "image/jpeg" });
  await expect(prepareNpcPortrait(smaller, true)).resolves.toBe(smaller);
});
