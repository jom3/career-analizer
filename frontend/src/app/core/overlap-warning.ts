export interface OverlapExperience {
  startDate?: string | null;
  endDate?: string | null;
  current?: boolean;
}

export interface TemporalRange {
  start: Date | null;
  end: Date | null;
}

// Rango de una experiencia: `current` extiende el fin hasta hoy. Si falta el
// inicio o el fin, el rango es incomparable y no participa en solapamientos.
export function experienceRange(
  item: OverlapExperience,
  today: Date = new Date(),
): TemporalRange {
  const start = item.startDate ? new Date(item.startDate) : null;
  const end = item.current
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
    : item.endDate
      ? new Date(item.endDate)
      : null;
  return { start, end };
}

function rangesOverlap(a: TemporalRange, b: TemporalRange): boolean {
  if (!a.start || !a.end || !b.start || !b.end) return false;
  return a.start.getTime() <= b.end.getTime() && b.start.getTime() <= a.end.getTime();
}

// Devuelve los pares [i, j] (i < j) de experiencias cuyo rango temporal se
// solapa. Es un aviso suave, no bloquea el guardado del perfil.
export function overlappingExperiences(
  experiences: OverlapExperience[],
  today: Date = new Date(),
): Array<[number, number]> {
  const ranges = experiences.map((item) => experienceRange(item, today));
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (rangesOverlap(ranges[i], ranges[j])) {
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}
