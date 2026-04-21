import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { FavoriteTeam } from "@/context/FavoritesContext";
import { Match } from "@/types/sports";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return "";
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
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

export async function registerWithBackend(token: string, favorites: FavoriteTeam[]): Promise<void> {
  const base = getApiBase();
  if (!base) return;
  try {
    await fetch(`${base}/api/notifications/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, favorites: favorites.map((f) => f.name) }),
    });
  } catch {}
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

export async function scheduleMatchReminders(matches: Match[], favorites: FavoriteTeam[]): Promise<void> {
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

    // 3 hours before
    const threeHoursBefore = ts - 3 * 60 * 60 * 1000;
    if (threeHoursBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Матч через 3 часа ⏰",
          body: label,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(threeHoursBefore),
        },
      }).catch(() => {});
    }

    // At kickoff
    if (ts > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Матч начинается! 🏁",
          body: label,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(ts),
        },
      }).catch(() => {});
    }
  }
}

export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("sports-russia", {
    name: "Спорт России",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#CC0000",
  });
}
