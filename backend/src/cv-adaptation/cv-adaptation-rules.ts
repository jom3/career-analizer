import {
  isWhitelistedSkill,
  type ProfileSkillItem,
} from '../job-match/profile-util';

// Skills del perfil que la oferta declara (intersección perfil ∩ whitelist).
// Solo sobre estos se prioriza: la IA nunca afirma un skill que el candidato no
// tenga, y la lista del CV sale siempre de skills reales del perfil.
export function matchedProfileSkillNames(
  profileSkills: ProfileSkillItem[],
  whitelist: Set<string>,
): string[] {
  return profileSkills
    .filter((skill) => isWhitelistedSkill(skill.name, whitelist))
    .map((skill) => skill.name);
}

// Skills del CV adaptado: los que matchean la oferta primero (orden relativo del
// perfil) y el resto después. Orden determinista, no decide la IA.
export function orderedSkills(
  profileSkills: ProfileSkillItem[],
  matchedNames: string[],
): string[] {
  const matched = new Set(matchedNames.map((name) => name.toLowerCase()));
  const matchedItems = profileSkills.filter((skill) =>
    matched.has(skill.name.toLowerCase()),
  );
  const rest = profileSkills.filter(
    (skill) => !matched.has(skill.name.toLowerCase()),
  );
  return [...matchedItems, ...rest].map((skill) => skill.name);
}

// Reordena items (experiencias/proyectos) poniendo primero los que citan un
// skill matcheado de la oferta, conservando su orden relativo. No descarta nada.
export function rankByRelevance<T>(
  items: T[],
  matchedNames: string[],
  extractText: (item: T) => string,
): T[] {
  const terms = matchedNames.map((name) => name.toLowerCase());
  const weighted = items.map((item, index) => {
    const text = extractText(item).toLowerCase();
    const hits = terms.filter(
      (term) => term.length > 0 && text.includes(term),
    ).length;
    return { item, index: index * -1, hits };
  });
  return [...weighted]
    .sort((a, b) => b.hits - a.hits || b.index - a.index)
    .map((entry) => entry.item);
}
