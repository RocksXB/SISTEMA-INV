import { describe, expect, it } from "vitest";
import { removeTrackedPortrait, reservePortraitBytes } from "./aparicoesQuota.js";

function testBucket() {
  const objects = new Map([["fichas.json", { size: 2_999_998_772 }], ["retrato.webp", { size: 100 }]]);
  let sequence = 0;
  return {
    async list({ cursor }) {
      const key = cursor ? "retrato.webp" : "fichas.json";
      return { objects: objects.has(key) ? [{ key, ...objects.get(key) }] : [], truncated: !cursor, cursor: "next" };
    },
    async get(key) {
      const object = objects.get(key);
      return object ? { ...object, json: async () => JSON.parse(object.value) } : null;
    },
    async head(key) { return objects.get(key) || null; },
    async delete(key) { objects.delete(key); },
    async put(key, value, { onlyIf }) {
      const existing = objects.get(key);
      if (onlyIf instanceof Headers ? !!existing : existing?.etag !== onlyIf.etagMatches) return null;
      const object = { value, size: value.length, etag: String(++sequence) };
      objects.set(key, object);
      return object;
    },
  };
}

describe("reserva de espaço no R2", () => {
  it("computa os objetos anteriores e bloqueia reservas concorrentes acima de 3 GB", async () => {
    const bucket = testBucket();
    const results = await Promise.all([reservePortraitBytes(bucket, 600), reservePortraitBytes(bucket, 600)]);
    expect(results.sort()).toEqual([false, true]);
    await expect(reservePortraitBytes(bucket, 401)).resolves.toBe(false);
    await removeTrackedPortrait(bucket, "retrato.webp");
    await expect(reservePortraitBytes(bucket, 500)).resolves.toBe(true);
    await expect(reservePortraitBytes(bucket, 1)).resolves.toBe(false);
  });

  it("não desconta um retrato removido antes da inicialização do contador", async () => {
    const bucket = testBucket();
    await removeTrackedPortrait(bucket, "retrato.webp");
    await expect(reservePortraitBytes(bucket, 1101)).resolves.toBe(false);
    await expect(reservePortraitBytes(bucket, 1100)).resolves.toBe(true);
  });
});
