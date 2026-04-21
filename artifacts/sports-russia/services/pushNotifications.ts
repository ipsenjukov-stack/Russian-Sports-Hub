import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { FavoriteTeam } from "@/context/FavoritesContext";
import { Match } from "@/types/sports";

export interface NotifPrefs {
  hoursBefore: number;
  onMatchStart: boolean;
  onMatchEvent: boolean;
  onMatchEnd: boolean;
  sound: "default" | "silent";
  vibration: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  hoursBefore: 3,
  onMatchStart: true,
  onMatchEvent: true,
  onMatchEnd: true,
  sound: "default",
  vibration: true,
};

export function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return "";
}

let _currentPrefs: NotifPrefs = DEFAULT_NOTIF_PREFS;

export function setActivePrefs(prefs: NotifPrefs) {
  _currentPrefs = prefs;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: _currentPrefs.sound !== "silent",
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function registerWithBackend(
  token: string,
  favorites: FavoriteTeam[],
  prefs?: NotifPrefs
): Promise<void> {
  const base = getApiBase();
  if (!base) return;
  try {
    await fetch(`${base}/api/notifications/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        favorites: favorites.map((f) => f.name),
        notifPrefs: prefs ?? DEFAULT_NOTIF_PREFS,
      }),
    });
  } catch {}
}

const KHL_TEST_PAIRS = [
  { home: "ЦСКА", away: "Динамо Москва", homeScore: 2, awayScore: 1 },
  { home: "СКА", away: "Авангард", homeScore: 1, awayScore: 1 },
  { home: "Металлург Мг", away: "Ак Барс", homeScore: 3, awayScore: 2 },
  { home: "Локомотив", away: "Торпедо НН", homeScore: 0, awayScore: 1 },
  { home: "Динамо Москва", away: "Барыс", homeScore: 4, awayScore: 2 },
];

const BOLD_DIGITS: Record<string, string> = {
  "0": "𝟬", "1": "𝟭", "2": "𝟮", "3": "𝟯", "4": "𝟰",
  "5": "𝟱", "6": "𝟲", "7": "𝟳", "8": "𝟴", "9": "𝟵",
};
function boldNum(n: number): string {
  return String(n).split("").map((c) => BOLD_DIGITS[c] ?? c).join("");
}

export async function sendLocalTestNotification(): Promise<void> {
  const match = KHL_TEST_PAIRS[Math.floor(Math.random() * KHL_TEST_PAIRS.length)];
  const isHome = Math.random() < 0.5;
  const team = isHome ? match.home : match.away;
  const homeStr = isHome ? boldNum(match.homeScore) : `${match.homeScore}`;
  const awayStr = !isHome ? boldNum(match.awayScore) : `${match.awayScore}`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🏒 Гол! ${team}`,
      body: `${match.home} ${homeStr}:${awayStr} ${match.away} · КХЛ`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });
}

export async function unregisterFromBackend(token: string): Promise<void> {
  const base = getApiBase();
  if (!base) return;
  try {
    await fetch(`${base}/api/notifications/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {}
}

export async function scheduleMatchReminders(
  matches: Match[],
  favorites: FavoriteTeam[],
  prefs: NotifPrefs = DEFAULT_NOTIF_PREFS
): Promise<void> {
  if (Platform.OS === "web") return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const favNames = new Set(favorites.map((f) => f.name.toLowerCase()));
  const now = Date.now();

  for (const match of matches) {
    if (match.status !== "upcoming") continue;
    const homeIsFav = favNames.has(match.homeTeam.name.toLowerCase());
    const awayIsFav = favNames.has(match.awayTeam.name.toLowerCase());
    if (!homeIsFav && !awayIsFav) continue;

    const ts = match.startTimestamp;
    if (!ts || ts <= now) continue;

    const label = `${match.homeTeam.name} — ${match.awayTeam.name}`;

    const hourLabel =
      prefs.hoursBefore === 1 ? "1 час" :
      prefs.hoursBefore < 5 ? `${prefs.hoursBefore} часа` :
      `${prefs.hoursBefore} часов`;

    const reminderTime = ts - prefs.hoursBefore * 60 * 60 * 1000;
    const playSound = prefs.sound !== "silent";

    if (reminderTime > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Матч через ${hourLabel} ⏰`,
          body: label,
          sound: playSound,
          ...(Platform.OS === "android" && { channelId: "sports-russia" }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminderTime),
        },
      }).catch(() => {});
    }

    if (prefs.onMatchStart && ts > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Матч начинается! 🏁",
          body: label,
          sound: playSound,
          ...(Platform.OS === "android" && { channelId: "sports-russia" }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(ts),
        },
      }).catch(() => {});
    }
  }
}

export async function setupAndroidChannel(vibration = true): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("sports-russia", {
    name: "Спорт России",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: vibration ? [0, 250, 250, 250] : [],
    lightColor: "#CC0000",
    sound: "default",
  });
}
