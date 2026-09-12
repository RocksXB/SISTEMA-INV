import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "vitest";

let environment: RulesTestEnvironment;
const request = (requestedBy: string, characterId: string) => ({
  requestedBy,
  characterId,
  status: "pending",
  name: "Katana",
  description: "Lâmina do player.",
  category: "weapon",
  weight: 2.1,
  imageUrl: "",
  rarity: "rare",
  stackable: false,
  maxStack: 1,
  equippable: true,
  allowedEquipmentSlots: ["mainHand"],
  tags: ["lâmina"],
  quantity: 1,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-sistema-inv",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
afterAll(async () => environment.cleanup());
afterEach(async () => environment.clearFirestore());
beforeEach(async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/admin"), { role: "admin" });
    await setDoc(doc(db, "users/alice"), { role: "player" });
    await setDoc(doc(db, "users/bob"), { role: "player" });
    await setDoc(doc(db, "characters/alice-character"), { ownerId: "alice" });
    await setDoc(doc(db, "characters/bob-character"), { ownerId: "bob" });
    await setDoc(doc(db, "items/sword"), {
      name: "Espada",
      stackable: false,
      maxStack: 1,
      equippable: true,
      allowedEquipmentSlots: ["mainHand"],
    });
    await setDoc(doc(db, "characters/alice-character/inventory/entry"), {
      itemId: "sword",
      quantity: 1,
      equipped: false,
      equipmentSlot: null,
    });
  });
});

describe("itemRequests Firestore Rules", () => {
  it("permite criar solicitação própria pending", async () => {
    const db = environment.authenticatedContext("alice").firestore();
    await assertSucceeds(
      addDoc(
        collection(db, "itemRequests"),
        request("alice", "alice-character"),
      ),
    );
  });
  it("nega personagem alheio, status approved e campos de revisão", async () => {
    const db = environment.authenticatedContext("alice").firestore();
    await assertFails(
      addDoc(collection(db, "itemRequests"), request("alice", "bob-character")),
    );
    await assertFails(
      addDoc(collection(db, "itemRequests"), {
        ...request("alice", "alice-character"),
        status: "approved",
      }),
    );
    await assertFails(
      addDoc(collection(db, "itemRequests"), {
        ...request("alice", "alice-character"),
        reviewedBy: "alice",
        reviewedAt: serverTimestamp(),
        approvedItemId: "sword",
      }),
    );
  });
  it("nega leitura de outro player e qualquer atualização pelo player", async () => {
    await environment.withSecurityRulesDisabled((context) =>
      setDoc(
        doc(context.firestore(), "itemRequests/bob-request"),
        request("bob", "bob-character"),
      ),
    );
    const alice = environment.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(alice, "itemRequests/bob-request")));
    await assertFails(
      updateDoc(doc(alice, "itemRequests/bob-request"), { status: "approved" }),
    );
  });
  it("permite excluir própria pending, mas não uma revisada", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(
        doc(db, "itemRequests/pending"),
        request("alice", "alice-character"),
      );
      await setDoc(doc(db, "itemRequests/approved"), {
        ...request("alice", "alice-character"),
        status: "approved",
        reviewedBy: "admin",
        reviewedAt: serverTimestamp(),
        approvedItemId: "sword",
      });
    });
    const alice = environment.authenticatedContext("alice").firestore();
    await assertSucceeds(deleteDoc(doc(alice, "itemRequests/pending")));
    await assertFails(deleteDoc(doc(alice, "itemRequests/approved")));
  });
  it("permite admin ler e revisar, vinculando reviewedBy ao UID autenticado", async () => {
    await environment.withSecurityRulesDisabled((context) =>
      setDoc(
        doc(context.firestore(), "itemRequests/review"),
        request("alice", "alice-character"),
      ),
    );
    const admin = environment.authenticatedContext("admin").firestore();
    const ref = doc(admin, "itemRequests/review");
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(
      updateDoc(ref, {
        status: "approved",
        reviewedBy: "admin",
        reviewedAt: serverTimestamp(),
        approvedItemId: "sword",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, {
        reviewedBy: "outro-admin",
        reviewedAt: serverTimestamp(),
        approvedItemId: "sword",
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("permite ao dono controlar se o item está sendo levado", async () => {
    const alice = environment.authenticatedContext("alice").firestore();
    const ref = doc(alice, "characters/alice-character/inventory/entry");
    await assertSucceeds(
      updateDoc(ref, { carried: false, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      updateDoc(ref, {
        carried: true,
        equipped: true,
        equipmentSlot: "mainHand",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, { carried: false, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      updateDoc(ref, {
        carried: false,
        equipped: false,
        equipmentSlot: null,
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("nega valor inválido de carried e mantém quantity bloqueada", async () => {
    const alice = environment.authenticatedContext("alice").firestore();
    const ref = doc(alice, "characters/alice-character/inventory/entry");
    await assertFails(updateDoc(ref, { carried: "não" }));
    await assertFails(updateDoc(ref, { quantity: 2 }));
  });
  it("mantém /items bloqueado para player", async () => {
    const alice = environment.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, "items/forged"), { name: "Forjado" }));
  });
});
