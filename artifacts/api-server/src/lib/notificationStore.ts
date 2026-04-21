export interface TokenRegistration {
  token: string;
  favorites: string[];
  sport?: string;
  registeredAt: number;
}

const store = new Map<string, TokenRegistration>();

export function registerToken(reg: TokenRegistration) {
  store.set(reg.token, { ...reg, registeredAt: Date.now() });
}

export function unregisterToken(token: string) {
  store.delete(token);
}

export function getAllRegistrations(): TokenRegistration[] {
  return Array.from(store.values());
}

export function getTokensForTeams(teamNames: string[]): string[] {
  const set = new Set(teamNames.map((n) => n.toLowerCase()));
  const tokens: string[] = [];
  for (const reg of store.values()) {
    if (reg.favorites.some((f) => set.has(f.toLowerCase()))) {
      tokens.push(reg.token);
    }
  }
  return tokens;
}
