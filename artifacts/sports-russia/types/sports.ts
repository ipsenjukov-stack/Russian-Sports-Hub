export type SportType = "football" | "hockey" | "basketball" | "volleyball";

export type MatchStatus = "live" | "finished" | "upcoming";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo: string;
}

export interface Match {
  id: string;
  sport: SportType;
  status: MatchStatus;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  minute?: number;
  period?: string;
  startTime: string;
  date: string;
  league: string;
  leagueLogo?: string;
  venue?: string;
}

export interface LeagueSection {
  name: string;
  sport: SportType;
  matches: Match[];
}
