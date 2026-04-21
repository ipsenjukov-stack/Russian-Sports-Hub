import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SportType } from "@/types/sports";
import { registerWithBackend } from "@/services/pushNotifications";

const NOTIF_KEY = "@sports_russia_notif";
const TOKEN_KEY = "@sports_russia_push_token";

const STORAGE_KEY = "@sports_russia_favorites_v2";

export interface FavoriteTeam {
  name: string;
  sport: SportType;
}

function makeKey(name: string, sport: SportType) {
  return `${sport}::${name}`;
}

interface FavoritesContextValue {
  favorites: FavoriteTeam[];
  toggleFavorite: (name: string, sport: SportType) => void;
  isFavorite: (name: string, sport: SportType) => boolean;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favorites: [],
  toggleFavorite: () => {},
  isFavorite: () => false,
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>([]);
  const isInitialMount = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const arr = JSON.parse(raw) as FavoriteTeam[];
          setFavorites(arr);
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    (async () => {
      const notifEnabled = await AsyncStorage.getItem(NOTIF_KEY);
      if (notifEnabled !== "true") return;
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) return;
      await registerWithBackend(token, favorites).catch(() => {});
    })();
  }, [favorites]);

  const toggleFavorite = useCallback((name: string, sport: SportType) => {
    setFavorites((prev) => {
      const key = makeKey(name, sport);
      const exists = prev.some((f) => makeKey(f.name, f.sport) === key);
      const next = exists
        ? prev.filter((f) => makeKey(f.name, f.sport) !== key)
        : [...prev, { name, sport }];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (name: string, sport: SportType) =>
      favorites.some((f) => makeKey(f.name, f.sport) === makeKey(name, sport)),
    [favorites]
  );

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
