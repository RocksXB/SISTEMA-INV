import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Boxes,
  Edit3,
  MessageSquareText,
  PackagePlus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ITEM_CATEGORIES } from "../config/itemCategories";
import { EQUIPMENT_SLOTS } from "../config/equipmentSlots";
import { ITEM_RARITIES } from "../config/itemRarities";
import { skillTypeLabel } from "../config/skillTypes";
import { Modal, Empty, ErrorState, Loading, Panel } from "../components/Ui";
import { useItems } from "../hooks/useItems";
import {
  getCharacters,
  saveCharacter,
  deleteCharacter,
} from "../services/characterService";
import { deleteItem, saveItem } from "../services/itemService";
import { deleteSkill, saveSkill } from "../services/skillService";
import {
  deliverItem,
  removeInventoryItem,
  setQuantity,
} from "../services/inventoryService";
import { useInventory } from "../hooks/useInventory";
import { useAllItemRequests } from "../hooks/useItemRequests";
import { useAllSkillRequests } from "../hooks/useSkillRequests";
import { useAllSkills } from "../hooks/useSkills";
import { AdminItemRequests } from "../components/AdminItemRequests";
import { AdminSkillRequests } from "../components/AdminSkillRequests";
import { EMPTY_SKILL_REQUEST, SkillForm } from "../components/SkillForm";
import type {
  Character,
  EquipmentSlot,
  ItemCategory,
  ItemDefinition,
  ItemRarity,
  SkillDefinition,
  SkillRequestDraft,
} from "../types";
const blankItem: Omit<ItemDefinition, "id"> = {
  name: "",
  description: "",
  category: "miscellaneous",
  weight: 0,
  imageUrl: "",
  rarity: "common",
  stackable: false,
  maxStack: 1,
  equippable: false,
  allowedEquipmentSlots: [],
  tags: [],
};
const blankCharacter: Omit<Character, "id"> = {
  ownerId: "",
  name: "",
  nickname: "",
  avatarUrl: "",
  description: "",
  carryingCapacity: 70,
};
const skillToDraft = (skill: SkillDefinition): SkillRequestDraft => ({
  name: skill.name,
  type: skill.type,
  description: skill.description,
  jetCost: skill.jetCost,
  cooldown: skill.cooldown,
  duration: skill.duration,
  damage: skill.damage,
  effect: skill.effect,
  conditions: skill.conditions,
  imageUrl: skill.imageUrl ?? "",
  tags: skill.tags,
});
export function AdminPage() {
  const { items, loading, error } = useItems();
  const requestState = useAllItemRequests();
  const skillState = useAllSkills();
  const skillRequestState = useAllSkillRequests();
  const [characters, setCharacters] = useState<Character[]>([]),
    [tab, setTab] = useState<"items" | "characters" | "skills" | "requests">("items"),
    [query, setQuery] = useState(""),
    [itemEdit, setItemEdit] = useState<ItemDefinition | true | null>(null),
    [charEdit, setCharEdit] = useState<Character | true | null>(null),
    [skillEdit, setSkillEdit] = useState<SkillDefinition | true | null>(null),
    [delivery, setDelivery] = useState<Character | null>(null),
    [message, setMessage] = useState("");
  const refresh = useCallback(() => {
    void getCharacters("", true)
      .then(setCharacters)
      .catch(() => setMessage("Falha ao carregar personagens."));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  if (loading)
    return <Loading label="Inicializando controle administrativo..." />;
  const shownItems = items.filter((x) =>
      x.name.toLowerCase().includes(query.toLowerCase()),
    ),
    shownChars = characters.filter((x) =>
      (x.name + x.nickname + x.ownerId)
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
    shownSkills = skillState.skills.filter((skill) =>
      (
        skill.name +
        skill.type +
        (characters.find((entry) => entry.id === skill.characterId)?.name ?? "")
      )
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const pendingRequests =
    requestState.requests.filter((request) => request.status === "pending").length +
    skillRequestState.requests.filter((request) => request.status === "pending").length;
  async function removeItem(i: ItemDefinition) {
    if (
      confirm(
        `Excluir ${i.name}? A operação será bloqueada se o item estiver em algum inventário.`,
      )
    )
      try {
        await deleteItem(i.id);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível excluir o item.",
        );
      }
  }
  async function removeChar(c: Character) {
    if (
      confirm(
        `Excluir ${c.name} e todo o seu inventário? Esta ação não pode ser desfeita.`,
      )
    )
      try {
        await deleteCharacter(c.id);
        refresh();
      } catch {
        setMessage("Não foi possível excluir o personagem.");
      }
  }
  async function removeSkillRecord(skill: SkillDefinition) {
    if (!confirm(`Excluir a habilidade ${skill.name}?`)) return;
    try {
      await deleteSkill(skill.id);
    } catch {
      setMessage("Não foi possível excluir a habilidade.");
    }
  }
  return (
    <main className="page admin-page">
      <div className="page-heading">
        <p className="eyebrow">ACESSO GM // PRIVILÉGIO ELEVADO</p>
        <h1>Controle do Sistema</h1>
        <p>Gerencie identidades, catálogo e distribuição de recursos.</p>
      </div>
      {(error || message) && <ErrorState text={error || message} />}
      <div className="admin-tabs">
        <button
          className={tab === "items" ? "active" : ""}
          onClick={() => setTab("items")}
        >
          <Boxes /> Catálogo
        </button>
        <button
          className={tab === "characters" ? "active" : ""}
          onClick={() => setTab("characters")}
        >
          <Users /> Personagens
        </button>
        <button
          className={tab === "skills" ? "active" : ""}
          onClick={() => setTab("skills")}
        >
          <Sparkles /> Habilidades
        </button>
        <button
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          <MessageSquareText /> Solicitações
          {pendingRequests > 0 && <strong>{pendingRequests}</strong>}
        </button>
      </div>
      <Panel>
        {tab !== "requests" && (
          <div className="admin-tools">
            <label className="search">
              <Search />
              <input
                placeholder="Pesquisar registros..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              className="primary"
              onClick={() =>
                tab === "items"
                  ? setItemEdit(true)
                  : tab === "characters"
                    ? setCharEdit(true)
                    : setSkillEdit(true)
              }
            >
              + NOVO REGISTRO
            </button>
          </div>
        )}
        {tab === "items" ? (
          <div className="data-list">
            {!shownItems.length ? (
              <Empty text="CATÁLOGO VAZIO" />
            ) : (
              shownItems.map((i) => (
                <article key={i.id}>
                  <div>
                    <b>{i.name}</b>
                    <span>
                      {i.category} // {i.rarity} // {i.weight} kg
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() => setItemEdit(i)}
                      aria-label={`Editar ${i.name}`}
                    >
                      <Edit3 />
                    </button>
                    <button
                      className="danger-icon"
                      onClick={() => void removeItem(i)}
                      aria-label={`Excluir ${i.name}`}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : tab === "characters" ? (
          <div className="data-list">
            {!shownChars.length ? (
              <Empty text="NENHUM PERSONAGEM" />
            ) : (
              shownChars.map((c) => (
                <article key={c.id}>
                  <div>
                    <b>{c.name}</b>
                    <span>
                      {c.ownerId} // {c.carryingCapacity} kg
                    </span>
                  </div>
                  <div>
                    <Link
                      className="icon-button"
                      to={`/system/${c.id}`}
                      aria-label={`Ver ${c.name}`}
                    >
                      <Search />
                    </Link>
                    <button
                      onClick={() => setDelivery(c)}
                      aria-label={`Entregar item a ${c.name}`}
                    >
                      <PackagePlus />
                    </button>
                    <button
                      onClick={() => setCharEdit(c)}
                      aria-label={`Editar ${c.name}`}
                    >
                      <Edit3 />
                    </button>
                    <button
                      className="danger-icon"
                      onClick={() => void removeChar(c)}
                      aria-label={`Excluir ${c.name}`}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : tab === "skills" ? (
          <div className="data-list">
            {skillState.error ? (
              <ErrorState text={skillState.error} />
            ) : skillState.loading ? (
              <div className="request-loading">SINCRONIZANDO HABILIDADES...</div>
            ) : !shownSkills.length ? (
              <Empty text="NENHUMA HABILIDADE REGISTRADA" />
            ) : (
              shownSkills.map((skill) => (
                <article key={skill.id}>
                  <div>
                    <b>{skill.name}</b>
                    <span>
                      {characters.find((entry) => entry.id === skill.characterId)?.name ??
                        "PERSONAGEM INDISPONÍVEL"}{" // "}
                      {skillTypeLabel(skill.type)}{" // "}
                      {skill.jetCost} JET
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() => setSkillEdit(skill)}
                      aria-label={`Editar ${skill.name}`}
                    >
                      <Edit3 />
                    </button>
                    <button
                      className="danger-icon"
                      onClick={() => void removeSkillRecord(skill)}
                      aria-label={`Excluir ${skill.name}`}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="request-groups">
            <section>
              <h3 className="request-group-title">Solicitações de itens</h3>
              <AdminItemRequests
                items={items}
                characters={characters}
                requests={requestState.requests}
                loading={requestState.loading}
                error={requestState.error}
              />
            </section>
            <section>
              <h3 className="request-group-title">Solicitações de habilidades</h3>
              <AdminSkillRequests
                characters={characters}
                requests={skillRequestState.requests}
                loading={skillRequestState.loading}
                error={skillRequestState.error}
              />
            </section>
          </div>
        )}
      </Panel>
      {itemEdit && (
        <ItemForm
          initial={itemEdit === true ? blankItem : itemEdit}
          onClose={() => setItemEdit(null)}
          onSaved={() => setItemEdit(null)}
        />
      )}{" "}
      {skillEdit && (
        <SkillAdminForm
          initial={skillEdit}
          characters={characters}
          onClose={() => setSkillEdit(null)}
          onSaved={() => setSkillEdit(null)}
        />
      )}
      {charEdit && (
        <CharacterForm
          initial={charEdit === true ? blankCharacter : charEdit}
          onClose={() => setCharEdit(null)}
          onSaved={() => {
            setCharEdit(null);
            refresh();
          }}
        />
      )}
      {delivery && (
        <DeliveryForm
          character={delivery}
          items={items}
          onClose={() => setDelivery(null)}
          onSaved={() => {
            setMessage("Item entregue com sucesso.");
            setDelivery(null);
          }}
        />
      )}
    </main>
  );
}
function ItemForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Omit<ItemDefinition, "id"> | ItemDefinition;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const id = "id" in initial ? initial.id : undefined;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveItem(v, id);
      onSaved();
    } catch {
      setError("Falha ao salvar. Verifique os dados e permissões.");
      setBusy(false);
    }
  }
  function slot(s: EquipmentSlot) {
    setV({
      ...v,
      allowedEquipmentSlots: v.allowedEquipmentSlots.includes(s)
        ? v.allowedEquipmentSlots.filter((x) => x !== s)
        : [...v.allowedEquipmentSlots, s],
    });
  }
  return (
    <Modal title={id ? "Editar item" : "Novo item"} onClose={onClose}>
      <form className="admin-form" onSubmit={submit}>
        <label>
          Nome
          <input
            required
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label>
          Descrição
          <textarea
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </label>
        <label>
          URL da imagem
          <input
            type="url"
            value={v.imageUrl}
            onChange={(e) => setV({ ...v, imageUrl: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Categoria
            <select
              value={v.category}
              onChange={(e) =>
                setV({ ...v, category: e.target.value as ItemCategory })
              }
            >
              {ITEM_CATEGORIES.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Raridade
            <select
              value={v.rarity}
              onChange={(e) =>
                setV({ ...v, rarity: e.target.value as ItemRarity })
              }
            >
              {ITEM_RARITIES.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Peso (kg)
            <input
              required
              min="0"
              step="0.001"
              type="number"
              value={v.weight}
              onChange={(e) => setV({ ...v, weight: Number(e.target.value) })}
            />
          </label>
          <label>
            Máximo por pilha
            <input
              required
              min="1"
              type="number"
              disabled={!v.stackable}
              value={v.maxStack}
              onChange={(e) => setV({ ...v, maxStack: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={v.stackable}
              onChange={(e) =>
                setV({
                  ...v,
                  stackable: e.target.checked,
                  maxStack: e.target.checked ? v.maxStack : 1,
                })
              }
            />{" "}
            Empilhável
          </label>
          <label>
            <input
              type="checkbox"
              checked={v.equippable}
              onChange={(e) =>
                setV({
                  ...v,
                  equippable: e.target.checked,
                  allowedEquipmentSlots: e.target.checked
                    ? v.allowedEquipmentSlots
                    : [],
                })
              }
            />{" "}
            Equipável
          </label>
        </div>
        {v.equippable && (
          <fieldset>
            <legend>Slots permitidos</legend>
            {EQUIPMENT_SLOTS.map((x) => (
              <label key={x.value}>
                <input
                  type="checkbox"
                  checked={v.allowedEquipmentSlots.includes(x.value)}
                  onChange={() => slot(x.value)}
                />
                {x.label}
              </label>
            ))}
          </fieldset>
        )}
        <label>
          Tags (separadas por vírgula)
          <input
            value={v.tags.join(", ")}
            onChange={(e) =>
              setV({
                ...v,
                tags: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? "SALVANDO..." : "SALVAR ITEM"}
        </button>
      </form>
    </Modal>
  );
}
function SkillAdminForm({
  initial,
  characters,
  onClose,
  onSaved,
}: {
  initial: SkillDefinition | true;
  characters: Character[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = initial === true ? null : initial;
  const [characterId, setCharacterId] = useState(
    existing?.characterId ?? characters[0]?.id ?? "",
  );
  const [error, setError] = useState("");
  const initialDraft = existing ? skillToDraft(existing) : EMPTY_SKILL_REQUEST;

  async function submit(draft: SkillRequestDraft) {
    const character = characters.find((entry) => entry.id === characterId);
    if (!character) {
      const failure = new Error("Selecione um personagem válido.");
      setError(failure.message);
      throw failure;
    }
    try {
      await saveSkill(
        {
          ...draft,
          characterId,
          ownerId: character.ownerId,
        },
        existing?.id,
      );
      onSaved();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Falha ao salvar habilidade.";
      setError(message);
      throw caught;
    }
  }

  return (
    <Modal
      title={existing ? "Editar habilidade" : "Nova habilidade"}
      onClose={onClose}
    >
      <div className="skill-admin-editor">
        <label className="request-existing">
          Personagem
          <select
            required
            value={characterId}
            onChange={(event) => setCharacterId(event.target.value)}
          >
            <option value="">Selecione</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        </label>
        {error && <div className="form-error">{error}</div>}
        <SkillForm
          initial={initialDraft}
          submitLabel="SALVAR HABILIDADE"
          onSubmit={submit}
        />
      </div>
    </Modal>
  );
}

function CharacterForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Omit<Character, "id"> | Character;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState(initial),
    [error, setError] = useState("");
  const id = "id" in initial ? initial.id : undefined;
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await saveCharacter(v, id);
      onSaved();
    } catch {
      setError("Falha ao salvar personagem.");
    }
  }
  return (
    <Modal
      title={id ? "Editar personagem" : "Novo personagem"}
      onClose={onClose}
    >
      <form className="admin-form" onSubmit={submit}>
        <label>
          Nome
          <input
            required
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label>
          Codinome
          <input
            value={v.nickname}
            onChange={(e) => setV({ ...v, nickname: e.target.value })}
          />
        </label>
        <label>
          UID do proprietário
          <input
            required
            value={v.ownerId}
            onChange={(e) => setV({ ...v, ownerId: e.target.value.trim() })}
          />
        </label>
        <label>
          Capacidade (kg)
          <input
            required
            min="0.001"
            step="0.001"
            type="number"
            value={v.carryingCapacity}
            onChange={(e) =>
              setV({ ...v, carryingCapacity: Number(e.target.value) })
            }
          />
        </label>
        <label>
          URL do avatar
          <input
            type="url"
            value={v.avatarUrl}
            onChange={(e) => setV({ ...v, avatarUrl: e.target.value })}
          />
        </label>
        <label>
          Descrição
          <textarea
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary">SALVAR PERSONAGEM</button>
      </form>
    </Modal>
  );
}
function DeliveryForm({
  character,
  items,
  onClose,
  onSaved,
}: {
  character: Character;
  items: ItemDefinition[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [itemId, setItemId] = useState(items[0]?.id || ""),
    [qty, setQty] = useState(1),
    [error, setError] = useState("");
  const { inventory, loading } = useInventory(character.id, items);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const item = items.find((x) => x.id === itemId);
    if (!item) return setError("Selecione um item.");
    try {
      await deliverItem(character.id, item, qty);
      setError("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na entrega.");
    }
  }
  async function change(id: string, delta: number) {
    const entry = inventory.find((x) => x.id === id);
    if (!entry) return;
    try {
      await setQuantity(
        character.id,
        entry,
        entry.definition,
        entry.quantity + delta,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Alteração bloqueada.");
    }
  }
  async function remove(id: string, name: string) {
    if (confirm(`Remover ${name} completamente do inventário?`))
      try {
        await removeInventoryItem(character.id, id);
      } catch {
        setError("Falha ao remover item.");
      }
  }
  return (
    <Modal title={`Inventário // ${character.name}`} onClose={onClose}>
      <form className="admin-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Adicionar item
            <select
              required
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">Selecione</option>
              {items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantidade
            <input
              type="number"
              min="1"
              required
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="primary">CONFIRMAR ENTREGA</button>
      </form>
      <div className="inventory-admin">
        <h3>ITENS REGISTRADOS</h3>
        {loading ? (
          <span>Sincronizando...</span>
        ) : !inventory.length ? (
          <Empty text="INVENTÁRIO VAZIO" />
        ) : (
          inventory.map((entry) => (
            <article key={entry.id}>
              <div>
                <b>{entry.definition.name}</b>
                <small>
                  ×{entry.quantity} {entry.equipped ? "// EQUIPADO" : ""}
                </small>
              </div>
              <div>
                <button
                  aria-label="Diminuir quantidade"
                  onClick={() => void change(entry.id, -1)}
                >
                  −
                </button>
                <button
                  aria-label="Aumentar quantidade"
                  onClick={() => void change(entry.id, 1)}
                >
                  +
                </button>
                <button
                  className="danger-icon"
                  aria-label="Remover item"
                  onClick={() => void remove(entry.id, entry.definition.name)}
                >
                  <Trash2 />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </Modal>
  );
}
