const quotaKey = "_cota_retratos";
const limitBytes = 3_000_000_000;
// Keep room for the usage counter and the session key, even if initialized later.
const internalBytes = 128;
const attempts = 8;

async function countExistingBytes(bucket) {
  let cursor;
  let bytes = 0;
  do {
    const page = await bucket.list({ limit: 1000, cursor });
    for (const object of page.objects) {
      if (object.key !== quotaKey) bytes += object.size;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return bytes;
}

async function changeUsage(bucket, delta) {
  let initial;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const recorded = await bucket.get(quotaKey);
    if (!recorded && delta < 0) return true;
    if (!recorded && initial === undefined) initial = await countExistingBytes(bucket);
    const used = recorded ? (await recorded.json()).used : initial;
    if (!Number.isSafeInteger(used) || used < 0) throw Error("Cota de retratos inválida");
    const next = used + delta;
    if (delta > 0 && next + internalBytes > limitBytes) return false;
    if (next < 0) throw Error("Cota de retratos inconsistente");
    const onlyIf = recorded ? { etagMatches: recorded.etag } : new Headers({ "If-None-Match": "*" });
    if (await bucket.put(quotaKey, JSON.stringify({ used: next }), { onlyIf })) return true;
  }
  throw Error("A cota mudou durante a operação");
}

export function reservePortraitBytes(bucket, bytes) {
  return changeUsage(bucket, bytes);
}

export async function removeTrackedPortrait(bucket, key) {
  const object = await bucket.head(key);
  if (!object) return;
  const counter = await bucket.head(quotaKey);
  await bucket.delete(key);
  if (counter) await changeUsage(bucket, -object.size);
}
