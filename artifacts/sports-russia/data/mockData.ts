import { Match, SportType } from "../types/sports";

const FOOTBALL_MATCHES: Match[] = [
  {
    id: "f1",
    sport: "football",
    status: "live",
    homeTeam: { id: "spartak", name: "Спартак Москва", shortName: "СПА", logo: "⚽" },
    awayTeam: { id: "cska", name: "ЦСКА Москва", shortName: "ЦСК", logo: "⚽" },
    homeScore: 1,
    awayScore: 1,
    minute: 67,
    startTime: "18:00",
    date: "Сегодня",
    league: "Российская Премьер-лига",
    venue: "Открытие Арена",
  },
  {
    id: "f2",
    sport: "football",
    status: "live",
    homeTeam: { id: "zenit", name: "Зенит", shortName: "ЗЕН", logo: "⚽" },
    awayTeam: { id: "lokomotiv", name: "Локомотив", shortName: "ЛОК", logo: "⚽" },
    homeScore: 2,
    awayScore: 0,
    minute: 45,
    period: "2 тайм",
    startTime: "20:00",
    date: "Сегодня",
    league: "Российская Премьер-лига",
    venue: "Газпром Арена",
  },
  {
    id: "f3",
    sport: "football",
    status: "finished",
    homeTeam: { id: "krasnodar", name: "Краснодар", shortName: "КРС", logo: "⚽" },
    awayTeam: { id: "dinamo", name: "Динамо Москва", shortName: "ДЦМ", logo: "⚽" },
    homeScore: 3,
    awayScore: 1,
    startTime: "15:00",
    date: "Вчера",
    league: "Российская Премьер-лига",
  },
  {
    id: "f4",
    sport: "football",
    status: "finished",
    homeTeam: { id: "rubin", name: "Рубин Казань", shortName: "РУБ", logo: "⚽" },
    awayTeam: { id: "ural", name: "Урал", shortName: "УРА", logo: "⚽" },
    homeScore: 0,
    awayScore: 0,
    startTime: "17:30",
    date: "Вчера",
    league: "Российская Премьер-лига",
  },
  {
    id: "f5",
    sport: "football",
    status: "upcoming",
    homeTeam: { id: "rostov", name: "Ростов", shortName: "РОС", logo: "⚽" },
    awayTeam: { id: "khimki", name: "Химки", shortName: "ХИМ", logo: "⚽" },
    homeScore: null,
    awayScore: null,
    startTime: "19:00",
    date: "Завтра",
    league: "Российская Премьер-лига",
  },
  {
    id: "f6",
    sport: "football",
    status: "upcoming",
    homeTeam: { id: "krylya", name: "Крылья Советов", shortName: "КРЫ", logo: "⚽" },
    awayTeam: { id: "spartak", name: "Спартак Москва", shortName: "СПА", logo: "⚽" },
    homeScore: null,
    awayScore: null,
    startTime: "16:00",
    date: "21 апреля",
    league: "Российская Премьер-лига",
  },
];

const HOCKEY_MATCHES: Match[] = [
  {
    id: "h1",
    sport: "hockey",
    status: "live",
    homeTeam: { id: "ska", name: "СКА Санкт-Петербург", shortName: "СКА", logo: "🏒" },
    awayTeam: { id: "cskahockey", name: "ЦСКА Хоккей", shortName: "ЦСК", logo: "🏒" },
    homeScore: 2,
    awayScore: 3,
    minute: 38,
    period: "2 период",
    startTime: "19:30",
    date: "Сегодня",
    league: "КХЛ - Плей-офф",
    venue: "СКА Арена",
  },
  {
    id: "h2",
    sport: "hockey",
    status: "finished",
    homeTeam: { id: "ak_bars", name: "Ак Барс Казань", shortName: "АКБ", logo: "🏒" },
    awayTeam: { id: "metallurg", name: "Металлург Магнитогорск", shortName: "МАГ", logo: "🏒" },
    homeScore: 4,
    awayScore: 2,
    startTime: "17:00",
    date: "Вчера",
    league: "КХЛ - Плей-офф",
  },
  {
    id: "h3",
    sport: "hockey",
    status: "finished",
    homeTeam: { id: "dinamo_minsk", name: "Динамо Минск", shortName: "МНС", logo: "🏒" },
    awayTeam: { id: "avangard", name: "Авангард Омск", shortName: "АВА", logo: "🏒" },
    homeScore: 1,
    awayScore: 3,
    startTime: "20:00",
    date: "Вчера",
    league: "КХЛ - Плей-офф",
  },
  {
    id: "h4",
    sport: "hockey",
    status: "upcoming",
    homeTeam: { id: "lokomotiv_yar", name: "Локомотив Ярославль", shortName: "ЛОЯ", logo: "🏒" },
    awayTeam: { id: "ska", name: "СКА Санкт-Петербург", shortName: "СКА", logo: "🏒" },
    homeScore: null,
    awayScore: null,
    startTime: "17:00",
    date: "Завтра",
    league: "КХЛ - Плей-офф",
  },
];

const BASKETBALL_MATCHES: Match[] = [
  {
    id: "b1",
    sport: "basketball",
    status: "live",
    homeTeam: { id: "cska_bball", name: "ЦСКА Баскет", shortName: "ЦСК", logo: "🏀" },
    awayTeam: { id: "unics", name: "УНИКС Казань", shortName: "УНИ", logo: "🏀" },
    homeScore: 68,
    awayScore: 71,
    minute: 34,
    period: "4 четверть",
    startTime: "18:00",
    date: "Сегодня",
    league: "Единая Лига ВТБ",
  },
  {
    id: "b2",
    sport: "basketball",
    status: "finished",
    homeTeam: { id: "zenit_bball", name: "Зенит Баскет", shortName: "ЗЕН", logo: "🏀" },
    awayTeam: { id: "lokomotiv_kub", name: "Локомотив Кубань", shortName: "ЛОК", logo: "🏀" },
    homeScore: 89,
    awayScore: 76,
    startTime: "15:00",
    date: "Вчера",
    league: "Единая Лига ВТБ",
  },
  {
    id: "b3",
    sport: "basketball",
    status: "upcoming",
    homeTeam: { id: "khimki_bball", name: "Химки Баскет", shortName: "ХИМ", logo: "🏀" },
    awayTeam: { id: "cska_bball", name: "ЦСКА Баскет", shortName: "ЦСК", logo: "🏀" },
    homeScore: null,
    awayScore: null,
    startTime: "20:00",
    date: "Завтра",
    league: "Единая Лига ВТБ",
  },
];

const VOLLEYBALL_MATCHES: Match[] = [
  {
    id: "v1",
    sport: "volleyball",
    status: "live",
    homeTeam: { id: "zenit_kaz_vball", name: "Зенит-Казань", shortName: "ЗКА", logo: "🏐" },
    awayTeam: { id: "kuzbassvball", name: "Кузбасс Кемерово", shortName: "КУЗ", logo: "🏐" },
    homeScore: 2,
    awayScore: 1,
    period: "4 партия",
    startTime: "18:30",
    date: "Сегодня",
    league: "Суперлига Мужчины",
  },
  {
    id: "v2",
    sport: "volleyball",
    status: "finished",
    homeTeam: { id: "dinamo_moscow_vball", name: "Динамо Москва В", shortName: "ДМВ", logo: "🏐" },
    awayTeam: { id: "lokomotiv_nov", name: "Локомотив Новосибирск", shortName: "ЛОН", logo: "🏐" },
    homeScore: 3,
    awayScore: 0,
    startTime: "14:00",
    date: "Вчера",
    league: "Суперлига Женщины",
  },
  {
    id: "v3",
    sport: "volleyball",
    status: "upcoming",
    homeTeam: { id: "belogorie", name: "Белогорье Белгород", shortName: "БЕЛ", logo: "🏐" },
    awayTeam: { id: "zenit_kaz_vball", name: "Зенит-Казань", shortName: "ЗКА", logo: "🏐" },
    homeScore: null,
    awayScore: null,
    startTime: "15:00",
    date: "Завтра",
    league: "Суперлига Мужчины",
  },
];

export const ALL_MATCHES: Match[] = [
  ...FOOTBALL_MATCHES,
  ...HOCKEY_MATCHES,
  ...BASKETBALL_MATCHES,
  ...VOLLEYBALL_MATCHES,
];

export const getMatchesBySport = (sport: SportType) =>
  ALL_MATCHES.filter((m) => m.sport === sport);

export const getLiveMatches = (sport?: SportType) =>
  ALL_MATCHES.filter((m) => m.status === "live" && (!sport || m.sport === sport));

export const getFinishedMatches = (sport?: SportType) =>
  ALL_MATCHES.filter((m) => m.status === "finished" && (!sport || m.sport === sport));

export const getUpcomingMatches = (sport?: SportType) =>
  ALL_MATCHES.filter((m) => m.status === "upcoming" && (!sport || m.sport === sport));

export const SPORT_LABELS: Record<SportType, string> = {
  football: "Футбол",
  hockey: "Хоккей",
  basketball: "Баскетбол",
  volleyball: "Волейбол",
};

export const SPORT_ICONS: Record<SportType, string> = {
  football: "⚽",
  hockey: "🏒",
  basketball: "🏀",
  volleyball: "🏐",
};
