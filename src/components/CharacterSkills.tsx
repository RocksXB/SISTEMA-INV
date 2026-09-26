import { Clock3, Gauge, ScanFace, Sparkles, TimerReset, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { SKILL_TYPES, skillTypeLabel } from "../config/skillTypes";
import { useCharacterSkills } from "../hooks/useSkills";
import type { SkillDefinition } from "../types";
import { Empty, ErrorState, Modal, Panel } from "./Ui";

export function CharacterSkills({
  characterId,
  uid,
  isAdmin,
}: {
  characterId: string;
  uid: string;
  isAdmin: boolean;
}) {
  const { skills, loading, error } = useCharacterSkills(
    characterId,
    uid,
    isAdmin,
  );
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<SkillDefinition | null>(null);
  const visible = useMemo(
    () =>
      skills.filter(
        (skill) =>
          (type === "all" || skill.type === type) &&
          (skill.name.toLowerCase().includes(query.toLowerCase()) ||
            skill.tags.some((tag) =>
              tag.toLowerCase().includes(query.toLowerCase()),
            )),
      ),
    [skills, query, type],
  );

  return (
    <>
      <Panel
        title={`Habilidades & técnicas // ${skills.length} registros`}
        className="skills-panel"
      >
        <div className="skill-toolbar">
          <input
            aria-label="Pesquisar habilidade"
            placeholder="Pesquisar habilidade ou tag..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            aria-label="Filtrar tipo de habilidade"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">Todos os tipos</option>
            {SKILL_TYPES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        {error && <ErrorState text={error} />}
        {loading ? (
          <div className="request-loading">SINCRONIZANDO HABILIDADES...</div>
        ) : visible.length ? (
          <div className="skill-grid">
            {visible.map((skill) => (
              <button
                key={skill.id}
                className="skill-card"
                onClick={() => setSelected(skill)}
              >
                <div className="skill-card-image">
                  {skill.imageUrl ? (
                    <img src={skill.imageUrl} alt="" />
                  ) : (
                    <Sparkles />
                  )}
                </div>
                <div>
                  <small>{skillTypeLabel(skill.type)}</small>
                  <b>{skill.name}</b>
                  <span>
                    <Zap /> {skill.jetCost} JET
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty text="NENHUMA HABILIDADE REGISTRADA" />
        )}
      </Panel>
      {selected && (
        <Modal
          title="Registro de habilidade"
          className="skill-detail-modal"
          onClose={() => setSelected(null)}
        >
          <article className="skill-detail">
            <div className="skill-detail-hero">
              <div className="skill-detail-image">
                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt={selected.name} />
                ) : (
                  <ScanFace />
                )}
              </div>
              <div>
                <p className="eyebrow">
                  {skillTypeLabel(selected.type)} // {selected.id}
                </p>
                <h3>{selected.name}</h3>
                <p>{selected.description || "Sem descrição registrada."}</p>
              </div>
            </div>
            <dl className="skill-stats">
              <div>
                <dt><Zap /> Custo</dt>
                <dd>{selected.jetCost} JET</dd>
              </div>
              <div>
                <dt><Clock3 /> Cooldown</dt>
                <dd>{selected.cooldown || "—"}</dd>
              </div>
              <div>
                <dt><TimerReset /> Duração</dt>
                <dd>{selected.duration || "—"}</dd>
              </div>
              <div>
                <dt><Gauge /> Dano</dt>
                <dd>{selected.damage || "—"}</dd>
              </div>
            </dl>
            {selected.effect && (
              <section className="skill-copy">
                <h4>Efeito</h4>
                <p>{selected.effect}</p>
              </section>
            )}
            {selected.conditions && (
              <section className="skill-copy">
                <h4>Condições / limitações</h4>
                <p>{selected.conditions}</p>
              </section>
            )}
            <div className="tags">
              {selected.tags.length ? (
                selected.tags.map((tag) => <span key={tag}>#{tag}</span>)
              ) : (
                <small>NENHUMA TAG REGISTRADA</small>
              )}
            </div>
          </article>
        </Modal>
      )}
    </>
  );
}
