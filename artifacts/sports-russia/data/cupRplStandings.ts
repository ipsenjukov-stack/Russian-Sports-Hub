export interface GroupEntry {
  rank: number;
  team: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  badge?: string;
}

export interface CupGroup {
  name: string;
  entries: GroupEntry[];
}

function e(
  rank: number, team: string,
  gp: number, w: number, d: number, l: number,
  gf: number, ga: number, pts: number,
): GroupEntry {
  return { rank, team, gp, w, d, l, gf, ga, gd: gf - ga, pts };
}

// Zone rules: top-2 advance, 3rd = playoff, 4th = eliminated
export const CUP_RPL_ZONES = [
  { from: 1, to: 2, color: "#22c55e", label: "Плей-офф" },
  { from: 3, to: 3, color: "#F5C518", label: "Квалификационные Плей-офф" },
] as const;

export const CUP_RPL_GROUPS: CupGroup[] = [
  {
    name: "Группа А",
    entries: [
      e(1, "Зенит",    6, 6, 0, 0, 19,  5, 18),
      e(2, "Оренбург", 6, 2, 1, 3,  6, 14,  8),
      e(3, "Рубин",    6, 1, 2, 3,  5,  9,  6),
      e(4, "Ахмат",    6, 1, 1, 4,  8, 10,  4),
    ],
  },
  {
    name: "Группа B",
    entries: [
      e(1, "Краснодар",        6, 4, 1, 1, 14,  5, 14),
      e(2, "Динамо",           6, 3, 2, 1, 11,  6, 11),
      e(3, "Крылья Советов",   6, 1, 3, 2,  7, 11,  8),
      e(4, "Сочи",             6, 0, 2, 4,  8, 18,  3),
    ],
  },
  {
    name: "Группа C",
    entries: [
      e(1, "Спартак",           6, 4, 1, 1, 13,  5, 13),
      e(2, "Динамо Махачкала",  6, 3, 2, 1,  9,  7, 13),
      e(3, "Ростов",            6, 2, 1, 3,  8,  9,  7),
      e(4, "Нижний Новгород",   6, 1, 0, 5,  4, 13,  3),
    ],
  },
  {
    name: "Группа D",
    entries: [
      e(1, "ЦСКА",       6, 3, 3, 0,  9,  5, 13),
      e(2, "Локомотив",  6, 4, 1, 1, 10,  4, 13),
      e(3, "Балтика",    6, 1, 1, 4,  6,  9,  5),
      e(4, "Акрон",      6, 1, 1, 4,  6, 13,  5),
    ],
  },
];

// API name → data file name (for badge lookup)
export const CUP_RPL_BADGE_ALIASES: Record<string, string> = {
  "Нижний Новгород": "Нижний Новгород",
  "Пари НН":         "Нижний Новгород",
};
