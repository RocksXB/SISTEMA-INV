import { useEffect, useState } from "react";
import {
  subscribeAllSkills,
  subscribeSkillsForCharacter,
} from "../services/skillService";
import type { SkillDefinition } from "../types";

export function useCharacterSkills(
  characterId: string | undefined,
  uid: string | undefined,
  isAdmin: boolean,
) {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!characterId || !uid) {
      setSkills([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeSkillsForCharacter(
      characterId,
      uid,
      isAdmin,
      (values) => {
        setSkills(values);
        setLoading(false);
      },
      () => {
        setError("Não foi possível sincronizar as habilidades.");
        setLoading(false);
      },
    );
  }, [characterId, uid, isAdmin]);

  return { skills, loading, error };
}

export function useAllSkills() {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(
    () =>
      subscribeAllSkills(
        (values) => {
          setSkills(values);
          setLoading(false);
        },
        () => {
          setError("Não foi possível sincronizar as habilidades.");
          setLoading(false);
        },
      ),
    [],
  );

  return { skills, loading, error };
}
