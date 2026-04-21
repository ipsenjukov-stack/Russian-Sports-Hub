import { readFileSync, writeFileSync, existsSync } from "fs";

export interface NotifPrefs {
  hoursBefore: number;
  onMatchStart: boolean;
  onMatchEvent: boolean;
  onMatchEnd: boolean;
  sound?: "default" | "silent";
  vibration?: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  hoursBefore: 3,
  onMatchStart: true,
  onMatchEvent: true,
  onMatchEnd: true,
  sound: "default",
  vibration: true,
};

export interface TokenRegistration {
  token: string;
  favorites: string[];
  sport?: string;
  registeredAt: number;
  notifPrefs: NotifPrefs;
}

const STORE_PATH = "/tmp/push_tokens.json";

const store = new Map<string, TokenRegistration>();

// Load persisted tokens on startup
function loadFromDisk() {
  try {
    if (existsSync(STORE_PATH)) {
      const data = JSON.parse(readFileSync(STORE_PATH, "utf-8")) as TokenRegistration[];
      for (const reg of data) {
        store.set(reg.token, reg);
      }
    }
  } catch {}
}

function saveToDisk() {
  try {
    writeFileSync(STORE_PATH, JSON.stringify(Array.from(store.values()), null, 2));
  } catch {}
}

loadFromDisk();

export function registerToken(reg: Omit<TokenRegistration, "registeredAt">) {
  store.set(reg.token, { ...reg, registeredAt: Date.now() });
  saveToDisk();
}

export function unregisterToken(token: string) {
  store.delete(token);
  saveToDisk();
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
