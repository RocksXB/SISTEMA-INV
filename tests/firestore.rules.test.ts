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
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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

const skillRequest = (requestedBy: string, characterId: string) => ({
  requestedBy,
  characterId,
  status: "pending",
  name: "Railgun",
  type: "technique",
  description: "Disparo eletromagnético.",
  jetCost: 120,
  cooldown: "2 turnos",
  duration: "Instantânea",
  damage: "3d20 + PRE",
  effect: "Perfura a linha de tiro.",
  conditions: "",
  imageUrl: "",
  tags: ["elétrico", "distância"],
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


describe("skills Firestore Rules", () => {
  it("permite ao player solicitar habilidade para o próprio personagem", async () => {
    const db = environment.authenticatedContext("alice").firestore();
    await assertSucceeds(
      addDoc(
        collection(db, "skillRequests"),
        skillRequest("alice", "alice-character"),
      ),
    );
    await assertFails(
      addDoc(
        collection(db, "skillRequests"),
        skillRequest("alice", "bob-character"),
      ),
    );
    await assertFails(
      addDoc(collection(db, "skillRequests"), {
        ...skillRequest("alice", "alice-character"),
        status: "approved",
      }),
    );
  });

  it("impede player de gravar skills e isola leitura por ownerId", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const base = {
        name: "Técnica oficial",
        type: "technique",
        description: "",
        jetCost: 30,
        cooldown: "",
        duration: "",
        damage: "",
        effect: "",
        conditions: "",
        imageUrl: "",
        tags: [],
        createdBy: "admin",
      };
      await setDoc(doc(db, "skills/alice-skill"), {
        ...base,
        characterId: "alice-character",
        ownerId: "alice",
      });
      await setDoc(doc(db, "skills/bob-skill"), {
        ...base,
        characterId: "bob-character",
        ownerId: "bob",
      });
    });
    const alice = environment.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(alice, "skills/alice-skill")));
    await assertFails(getDoc(doc(alice, "skills/bob-skill")));
    await assertFails(
      setDoc(doc(alice, "skills/forged"), {
        characterId: "alice-character",
        ownerId: "alice",
        name: "Forjada",
      }),
    );
    const ownQuery = query(
      collection(alice, "skills"),
      where("ownerId", "==", "alice"),
    );
    await assertSucceeds(getDocs(ownQuery));
  });

  it("permite admin criar skill oficial e aprovar solicitação", async () => {
    await environment.withSecurityRulesDisabled((context) =>
      setDoc(
        doc(context.firestore(), "skillRequests/review"),
        skillRequest("alice", "alice-character"),
      ),
    );
    const admin = environment.authenticatedContext("admin").firestore();
    await assertSucceeds(
      setDoc(doc(admin, "skills/approved-skill"), {
        characterId: "alice-character",
        ownerId: "alice",
        name: "Railgun",
        type: "technique",
        description: "Disparo eletromagnético.",
        jetCost: 120,
        cooldown: "2 turnos",
        duration: "Instantânea",
        damage: "3d20 + PRE",
        effect: "Perfura a linha de tiro.",
        conditions: "",
        imageUrl: "",
        tags: ["elétrico"],
        createdBy: "alice",
        approvedBy: "admin",
        approvedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(admin, "skillRequests/review"), {
        status: "approved",
        reviewedBy: "admin",
        reviewedAt: serverTimestamp(),
        approvedSkillId: "approved-skill",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("permite cancelar própria skill pendente e bloqueia a de outro player", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(
        doc(db, "skillRequests/alice-pending"),
        skillRequest("alice", "alice-character"),
      );
      await setDoc(
        doc(db, "skillRequests/bob-pending"),
        skillRequest("bob", "bob-character"),
      );
    });
    const alice = environment.authenticatedContext("alice").firestore();
    await assertSucceeds(deleteDoc(doc(alice, "skillRequests/alice-pending")));
    await assertFails(getDoc(doc(alice, "skillRequests/bob-pending")));
    await assertFails(deleteDoc(doc(alice, "skillRequests/bob-pending")));
  });
});
