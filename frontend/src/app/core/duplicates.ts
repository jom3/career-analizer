// Normaliza un valor para comparar duplicados: minúsculas, sin acentos,
// espacios colapsados.
export function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// Clave de comparación de un skill: nombre normalizado. Vacía si no hay nombre.
export function skillDuplicateKey(skill: { name: string }): string {
  const name = (skill.name ?? '').trim();
  return name.length > 0 ? normalizeForComparison(name) : '';
}

// Clave de comparación de una experiencia: empresa+posición+periodo
// normalizados. Vacía si no hay ni empresa ni puesto.
export function experienceDuplicateKey(experience: {
  company: string | null;
  position: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): string {
  const company = (experience.company ?? '').trim();
  const position = (experience.position ?? '').trim();
  if (company.length === 0 && position.length === 0) return '';
  return normalizeForComparison(
    [
      company,
      position,
      experience.startDate ?? '',
      experience.endDate ?? '',
    ].join('|'),
  );
}

export interface DuplicateGroup<T> {
  key: string;
  items: T[];
}

export interface DuplicatesInput {
  skills: Array<{ name: string }>;
  experiences: Array<{
    company: string | null;
    position: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
}

export interface DuplicatesResult {
  skills: DuplicateGroup<{ name: string }>[];
  experiences: DuplicateGroup<DuplicatesInput['experiences'][number]>[];
}

function groupDuplicates<T>(
  items: T[],
  keyOf: (item: T) => string,
): DuplicateGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({ key: keyOf(group[0]), items: group }));
}

// Devuelve los grupos de skills y experiencias duplicados de un perfil.
// Solo skills y experiencias: el dedupe de otras colecciones está fuera de
// este spec.
export function findDuplicates(profile: DuplicatesInput): DuplicatesResult {
  return {
    skills: groupDuplicates(profile.skills, skillDuplicateKey),
    experiences: groupDuplicates(profile.experiences, experienceDuplicateKey),
  };
}
