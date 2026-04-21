export interface NotifPrefs {
  hoursBefore: number;
  onMatchStart: boolean;
  onMatchEvent: boolean;
  onMatchEnd: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  hoursBefore: 3,
  onMatchStart: true,
  onMatchEvent: true,
  onMatchEnd: true,
};

export interface TokenRegistration {
  token: string;
  favorites: string[];
  sport?: string;
  registeredAt: number;
  notifPrefs: NotifPrefs;
}

const store = new Map<string, TokenRegistration>();

export function registerToken(reg: Omit<TokenRegistration, "registeredAt">) {
  store.set(reg.token, { ...reg, registeredAt: Date.now() });
}

export function unregisterToken(token: string) {
  store.delete(token);
}

export function getAllRegistrations(): TokenRegistration[] {
  return Array.from(store.values());
}

export function getRegistrationsForTeams(teamNames: string[]): TokenRegistration[] {
  const set = new Set(teamNames.map((n) => n.toLowerCase()));
  const regs: TokenRegistration[] = [];
  for (const reg of store.values()) {
    if (reg.favorites.some((f) => set.has(f.toLowerCase()))) {
      regs.push(reg);
    }
  }
  return regs;
}

export function getTokensForTeams(teamNames: string[]): string[] {
  return getRegistrationsForTeams(teamNames).map((r) => r.token);
}
