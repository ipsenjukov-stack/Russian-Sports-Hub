import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { LigaPariLogo } from "@/components/LigaPariLogo";
import { VtorayaLigaALogo } from "@/components/VtorayaLigaALogo";
import { VtorayaLigaBLogo } from "@/components/VtorayaLigaBLogo";

const CDN = "https://media.api-sports.io/football/leagues";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}`;
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return "";
}

function proxyLeagueLogo(cdnUrl: string): string {
  const base = getApiBase();
  if (!base) return cdnUrl;
  return `${base}/api/sports/proxy-image?url=${encodeURIComponent(cdnUrl)}`;
}

export interface League {
  key: string;
  label: string;
  logo: string | number;
}

export const FOOTBALL_LEAGUES: League[] = [
  { key: "Российская Премьер-лига",            label: "Российская Премьер-лига",      logo: `${CDN}/235.png` },
  { key: "Кубок России",                       label: "Кубок России",                 logo: require("@/assets/images/kubok-rossii-nobg.png") },
  { key: "Суперкубок России",                  label: "Суперкубок России",            logo: `${CDN}/663.png` },
  { key: "Лига PARI",                           label: "Лига PARI",                    logo: 0 },
  { key: "Вторая лига Б. Группа 1",            label: "Вторая лига Б. Группа 1",      logo: `${CDN}/651.png` },
  { key: "Вторая лига Б. Группа 2",            label: "Вторая лига Б. Группа 2",      logo: `${CDN}/652.png` },
  { key: "Вторая лига Б. Группа 3",            label: "Вторая лига Б. Группа 3",      logo: `${CDN}/650.png` },
  { key: "Вторая лига Б. Группа 4",            label: "Вторая лига Б. Группа 4",      logo: `${CDN}/653.png` },
  { key: "Вторая Лига А. Группа Золото",  label: "Вторая Лига А. Группа Золото",  logo: 1 },
  { key: "Вторая Лига А. Группа Серебро", label: "Вторая Лига А. Группа Серебро", logo: 1 },
  { key: "Вторая Лига А. Плей-офф",           label: "Вторая Лига А. Плей-офф",           logo: 1 },
  { key: "Вторая Лига А. Весна Золото",        label: "Вторая Лига А. Весна Золото",        logo: 1 },
  { key: "Вторая Лига А. Весна Серебро",       label: "Вторая Лига А. Весна Серебро",       logo: 1 },
  { key: "Высший дивизион. Женщины",           label: "Высший дивизион. Женщины",     logo: `${CDN}/649.png` },
  { key: "Первенство молодёжных команд",       label: "Первенство молодёжных команд", logo: `${CDN}/238.png` },
];

interface LeagueDropdownProps {
  selected: string[];
  onSelect: (leagues: string[]) => void;
}

function triggerLabel(selected: string[]): string {
  if (selected.length === 0) return "Все лиги";
  if (selected.length === 1) return FOOTBALL_LEAGUES.find((l) => l.key === selected[0])?.label ?? selected[0];
  return `${selected.length} лиги`;
}

function triggerLogo(selected: string[]): string | number | null {
  if (selected.length === 1) return FOOTBALL_LEAGUES.find((l) => l.key === selected[0])?.logo ?? null;
  return null;
}

export function LeagueDropdown({ selected, onSelect }: LeagueDropdownProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  const pick = (key: string) => {
    onSelect([key]);
    setOpen(false);
  };

  const logo = triggerLogo(selected);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={[styles.trigger, { backgroundColor: colors.muted, borderColor: colors.border }]}
      >
        {selected.length === 1 && selected[0] === "Лига PARI" ? (
          <LigaPariLogo size={20} />
        ) : selected.length === 1 && selected[0].startsWith("Вторая Лига А") ? (
          <VtorayaLigaALogo size={20} />
        ) : selected.length === 1 && selected[0].startsWith("Вторая лига Б") ? (
          <VtorayaLigaBLogo size={20} />
        ) : logo !== null ? (
          <Image source={typeof logo === "number" ? logo : { uri: proxyLeagueLogo(logo as string) }} style={styles.triggerLogo} resizeMode="contain" />
        ) : (
          <Text style={[styles.triggerBall, { color: colors.mutedForeground }]}>⚽</Text>
        )}
        <Text style={[styles.triggerText, { color: colors.foreground }]} numberOfLines={1}>
          {triggerLabel(selected)}
        </Text>
        <Text style={[styles.chevron, { color: colors.mutedForeground }]}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card, shadowColor: colors.foreground }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Выбор лиги</Text>
            </View>

            <FlatList
              data={FOOTBALL_LEAGUES}
              keyExtractor={(item) => item.key}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Platform.OS === "ios" ? 32 : 16 }}
              renderItem={({ item }) => {
                const isChecked = selected.includes(item.key);
                return (
                  <TouchableOpacity
                    onPress={() => pick(item.key)}
                    activeOpacity={0.7}
                    style={[
                      styles.leagueItem,
                      { borderBottomColor: colors.border },
                      isChecked && { backgroundColor: colors.muted },
                    ]}
                  >
                    <View style={styles.logoWrap}>
                      {item.key === "Лига PARI" ? (
                        <LigaPariLogo size={36} />
                      ) : item.key.startsWith("Вторая Лига А") ? (
                        <VtorayaLigaALogo size={36} />
                      ) : item.key.startsWith("Вторая лига Б") ? (
                        <VtorayaLigaBLogo size={36} />
                      ) : (
                        <Image
                          source={typeof item.logo === "number" ? item.logo : { uri: proxyLeagueLogo(item.logo as string) }}
                          style={styles.leagueLogo}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                    <Text style={[
                      styles.leagueLabel,
                      { color: colors.foreground },
                      isChecked && { fontFamily: "Inter_600SemiBold" },
                    ]}>
                      {item.label}
                    </Text>
                    <View style={[styles.radio, { borderColor: isChecked ? colors.primary : colors.border }]}>
                      {isChecked && (
                        <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "85%",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 6,
  },
  triggerLogo: {
    width: 20,
    height: 20,
  },
  triggerBall: {
    fontSize: 16,
    lineHeight: 20,
  },
  triggerText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  chevron: {
    fontSize: 12,
    lineHeight: 18,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-start",
  },
  sheet: {
    maxHeight: "80%",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 32,
    paddingBottom: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  leagueItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  logoWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  leagueLogo: {
    width: 36,
    height: 36,
  },
  leagueLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
