import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Filter,
  ScanFace,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Navigate, useParams } from "react-router-dom";
import { EQUIPMENT_SLOTS, slotLabel } from "../config/equipmentSlots";
import { ENCUMBRANCE_CONFIG } from "../config/encumbrance";
import { ITEM_CATEGORIES } from "../config/itemCategories";
import { ITEM_RARITIES, rarityConfig } from "../config/itemRarities";
import { InventoryCard } from "../components/InventoryCard";
import { Modal, Empty, ErrorState, Loading, Panel } from "../components/Ui";
import {
  SystemNotification,
  type Notice,
} from "../components/SystemNotification";
import { useAuth } from "../features/auth/AuthContext";
import { useInventory } from "../hooks/useInventory";
import { useItems } from "../hooks/useItems";
import { subscribeCharacter } from "../services/characterService";
import { equipItem, unequipItem } from "../services/inventoryService";
import type { Character, EquipmentSlot, HydratedInventoryItem } from "../types";
import {
  calculateEncumbrancePercentage,
  calculateInventoryWeight,
  calculateStackWeight,
  formatWeight,
  getEncumbranceStatus,
} from "../utils/inventory";
type Sort = "name" | "weight" | "quantity" | "rarity";
export function SystemPage() {
  const { characterId } = useParams(),
    { user, profile } = useAuth(),
    { items, loading: itemsLoading, error: itemsError } = useItems();
  const [character, setCharacter] = useState<Character | null>(),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<HydratedInventoryItem | null>(null),
    [notice, setNotice] = useState<Notice | null>(null),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [rarity, setRarity] = useState("all"),
    [equipped, setEquipped] = useState("all"),
    [sort, setSort] = useState<Sort>("name");
  const {
    raw,
    inventory,
    loading,
    error: inventoryError,
  } = useInventory(characterId, items);
  useEffect(() => {
    if (!characterId) return;
    return subscribeCharacter(characterId, setCharacter, () => {
      setCharacter(null);
      setError(
        "Personagem inexistente, acesso negado ou falha de sincronização.",
      );
    });
  }, [characterId]);
  const visible = useMemo(
    () =>
      inventory
        .filter((x) => {
          const i = x.definition;
          return (
            (i.name.toLowerCase().includes(search.toLowerCase()) ||
              i.tags.some((t) =>
                t.toLowerCase().includes(search.toLowerCase()),
              )) &&
            (category === "all" || i.category === category) &&
            (rarity === "all" || i.rarity === rarity) &&
            (equipped === "all" || String(x.equipped) === equipped)
          );
        })
        .sort((a, b) =>
          sort === "name"
            ? a.definition.name.localeCompare(b.definition.name)
            : sort === "weight"
              ? b.definition.weight - a.definition.weight
              : sort === "quantity"
                ? b.quantity - a.quantity
                : rarityConfig(b.definition.rarity).priority -
                  rarityConfig(a.definition.rarity).priority,
        ),
    [inventory, search, category, rarity, equipped, sort],
  );
  if (itemsLoading) return <Loading label="Sincronizando catálogo..." />;
  if (itemsError)
    return (
      <main className="page">
        <ErrorState text={itemsError} />
      </main>
    );
  if (character === undefined) return <Loading />;
  if (!character)
    return (
      <main className="page">
        <ErrorState text={error || "Personagem não encontrado."} />
      </main>
    );
  if (loading) return <Loading />;
  if (profile?.role !== "admin" && character.ownerId !== user?.uid)
    return <Navigate to="/characters" replace />;
  const total = calculateInventoryWeight(inventory),
    pct = calculateEncumbrancePercentage(total, character.carryingCapacity),
    status = getEncumbranceStatus(pct),
    statusCfg = ENCUMBRANCE_CONFIG.find((x) => x.status === status)!;
  async function toggle() {
    if (!selected || !characterId) return;
    try {
      await unequipItem(characterId, selected.id);
      setNotice({ title: "EQUIPAMENTO REMOVIDO", message: "Slot liberado." });
      setSelected(null);
    } catch (e) {
      setNotice({
        title: "ALERTA",
        message: e instanceof Error ? e.message : "Operação bloqueada.",
        kind: "warning",
      });
    }
  }
  async function doEquip(slot: EquipmentSlot) {
    if (!selected || !characterId) return;
    try {
      await equipItem(characterId, selected, selected.definition, slot, raw);
      setNotice({
        title: "EQUIPAMENTO REGISTRADO",
        message: `${selected.definition.name} equipada.`,
      });
      setSelected(null);
    } catch (e) {
      setNotice({
        title: "ALERTA",
        message: e instanceof Error ? e.message : "Operação bloqueada.",
        kind: "warning",
      });
    }
  }
  return (
    <main className="page hud-page">
      <div className="hud-head">
        <div>
          <p className="eyebrow">INTERFACE DE CAMPO // ONLINE</p>
          <h1>{character.name}</h1>
          <span>{character.nickname || "SEM CODINOME"}</span>
        </div>
        <div className={`load-summary status-${status}`}>
          <span>
            {statusCfg.icon} {statusCfg.label}
          </span>
          <b>
            {formatWeight(total)}{" "}
            <i>/ {formatWeight(character.carryingCapacity)}</i>
          </b>
          <div className="progress">
            <span style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <small>{Math.round(pct)}% DA CAPACIDADE</small>
        </div>
      </div>
      {(error || inventoryError) && (
        <ErrorState text={error || inventoryError} />
      )}
      <div className="hud-grid">
        <aside>
          <Panel title="Identidade">
            <div className="profile-card">
              {character.avatarUrl ? (
                <img
                  src={character.avatarUrl}
                  alt={`Avatar de ${character.name}`}
                />
              ) : (
                <div className="portrait">
                  <ScanFace />
                </div>
              )}
              <p>
                {character.description ||
                  "Nenhum registro adicional disponível."}
              </p>
              <span>
                <ShieldCheck /> AUTORIZAÇÃO VALIDADA
              </span>
            </div>
          </Panel>
          <Panel title="Equipamento">
            <div className="equipment-list">
              {EQUIPMENT_SLOTS.map((slot) => {
                const found = inventory.find(
                  (x) => x.equipped && x.equipmentSlot === slot.value,
                );
                return (
                  <button
                    key={slot.value}
                    onClick={() => found && setSelected(found)}
                  >
                    <span>{slot.label}</span>
                    <b>{found?.definition.name || "— VAZIO —"}</b>
                  </button>
                );
              })}
            </div>
          </Panel>
        </aside>
        <section className="inventory-area">
          <Panel title={`Inventário // ${inventory.length} registros`}>
            <div className="filters">
              <label className="search">
                <Search />
                <input
                  aria-label="Pesquisar inventário"
                  placeholder="Pesquisar item ou tag..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                <Filter />
                <select
                  aria-label="Categoria"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">Todas categorias</option>
                  {ITEM_CATEGORIES.map((x) => (
                    <option value={x.value} key={x.value}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </label>
              <select
                aria-label="Raridade"
                value={rarity}
                onChange={(e) => setRarity(e.target.value)}
              >
                <option value="all">Todas raridades</option>
                {ITEM_RARITIES.map((x) => (
                  <option value={x.value} key={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Equipado"
                value={equipped}
                onChange={(e) => setEquipped(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="true">Equipados</option>
                <option value="false">Guardados</option>
              </select>
              <label>
                <ChevronDown />
                <select
                  aria-label="Ordenar"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                >
                  <option value="name">Nome</option>
                  <option value="weight">Peso</option>
                  <option value="quantity">Quantidade</option>
                  <option value="rarity">Raridade</option>
                </select>
              </label>
            </div>
            {visible.length ? (
              <div className="inventory-grid">
                {visible.map((x) => (
                  <InventoryCard
                    key={x.id}
                    entry={x}
                    onClick={() => setSelected(x)}
                  />
                ))}
              </div>
            ) : (
              <Empty text="NENHUM ITEM REGISTRADO" />
            )}
          </Panel>
        </section>
      </div>
      {selected && (
        <Modal title="Registro de item" onClose={() => setSelected(null)}>
          <div className="item-detail">
            <div className="detail-image">
              {selected.definition.imageUrl ? (
                <img src={selected.definition.imageUrl} alt="" />
              ) : (
                <ScanFace />
              )}
            </div>
            <p className="eyebrow">
              {rarityConfig(selected.definition.rarity).label} //{" "}
              {selected.definition.category}
            </p>
            <h2>{selected.customName || selected.definition.name}</h2>
            <p>
              {selected.definition.description || "Sem descrição registrada."}
            </p>
            <dl>
              <div>
                <dt>Quantidade</dt>
                <dd>×{selected.quantity}</dd>
              </div>
              <div>
                <dt>Peso unitário</dt>
                <dd>{formatWeight(selected.definition.weight)}</dd>
              </div>
              <div>
                <dt>Peso da pilha</dt>
                <dd>
                  {formatWeight(
                    calculateStackWeight(
                      selected.definition.weight,
                      selected.quantity,
                    ),
                  )}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {selected.equipped
                    ? `Equipado // ${slotLabel(selected.equipmentSlot!)}`
                    : "Guardado"}
                </dd>
              </div>
            </dl>
            <div className="tags">
              {selected.definition.tags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </div>
            {selected.equipped ? (
              <button className="danger" onClick={() => void toggle()}>
                DESEQUIPAR
              </button>
            ) : selected.definition.equippable ? (
              <div className="slot-actions">
                <span>SELECIONE O SLOT</span>
                {selected.definition.allowedEquipmentSlots.map((s) => (
                  <button
                    className="primary"
                    key={s}
                    onClick={() => void doEquip(s)}
                  >
                    {slotLabel(s)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="locked">
                <AlertTriangle /> ITEM NÃO EQUIPÁVEL
              </p>
            )}
          </div>
        </Modal>
      )}
      {notice && (
        <SystemNotification notice={notice} onClose={() => setNotice(null)} />
      )}
    </main>
  );
}
