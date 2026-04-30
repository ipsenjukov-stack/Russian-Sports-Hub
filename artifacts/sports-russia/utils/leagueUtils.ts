export const LIGA_A_KEY = "Вторая Лига А";
export const LIGA_A_PREFIX = "Вторая Лига А.";

export const LIGA_A_PHASE1 = ["Вторая Лига А. Группа Золото", "Вторая Лига А. Группа Серебро"] as const;
export const LIGA_A_PHASE2 = ["Вторая Лига А. Весна Золото",  "Вторая Лига А. Весна Серебро"]  as const;

export function matchesLeagueFilter(league: string | undefined | null, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const lg = league ?? "";
  return selected.some((sel) => {
    if (sel === LIGA_A_KEY) return lg.startsWith(LIGA_A_PREFIX);
    return sel === lg;
  });
}
