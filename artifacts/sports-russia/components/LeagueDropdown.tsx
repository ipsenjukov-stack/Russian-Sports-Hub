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

const CDN = "https://media.api-sports.io/football/leagues";

export interface League {
  key: string;
  label: string;
  logo: string | number;
}

export const FOOTBALL_LEAGUES: League[] = [
  { key: "Российская Премьер-лига",            label: "Российская Премьер-лига",      logo: `${CDN}/235.png` },
  { key: "Кубок России",                       label: "Кубок России",                 logo: `${CDN}/237.png` },
  { key: "Суперкубок России",                  label: "Суперкубок России",            logo: `${CDN}/663.png` },
  { key: "Лига PARI",                           label: "Лига PARI",                    logo: 0 },
  { key: "ФНЛ-2. Группа 1",                   label: "ФНЛ-2. Группа 1",             logo: `${CDN}/651.png` },
  { key: "ФНЛ-2. Группа 2",                   label: "ФНЛ-2. Группа 2",             logo: `${CDN}/652.png` },
  { key: "ФНЛ-2. Группа 3",                   label: "ФНЛ-2. Группа 3",             logo: `${CDN}/650.png` },
  { key: "ФНЛ-2. Группа 4",                   label: "ФНЛ-2. Группа 4",             logo: `${CDN}/653.png` },
  { key: "Вторая Лига А. Дивизион А Золото",  label: "Вторая Лига А. Дивизион А Золото",  logo: 1 },
  { key: "Вторая Лига А. Дивизион А Серебро", label: "Вторая Лига А. Дивизион А Серебро", logo: 1 },
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

  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onSelect(selected.filter((k) => k !== key));
    } else {
      onSelect([...selected, key]);
    }
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
        ) : logo !== null ? (
          <Image source={typeof logo === "number" ? logo : { uri: logo as string }} style={styles.triggerLogo} resizeMode="contain" />
        ) : (
          <Text style={[styles.triggerBall, { color: colors.mutedForeground }]}>⚽</Text>
        )}
        <Text style={[styles.triggerText, { color: colors.foreground }]} numberOfLines={1}>
          {triggerLabel(selected)}
        </Text>
        {selected.length > 1 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{selected.length}</Text>
          </View>
        )}
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
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Выбор лиг</Text>
              {selected.length > 0 && (
                <TouchableOpacity onPress={() => onSelect([])} hitSlop={8}>
                  <Text style={[styles.clearBtn, { color: colors.primary }]}>Сбросить</Text>
                </TouchableOpacity>
              )}
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
                    onPress={() => toggle(item.key)}
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
                      ) : (
                        <Image
                          source={typeof item.logo === "number" ? item.logo : { uri: item.logo as string }}
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
                    <View style={[
                      styles.checkbox,
                      { borderColor: isChecked ? colors.primary : colors.border },
                      isChecked && { backgroundColor: colors.primary },
                    ]}>
                      {isChecked && (
                        <Text style={styles.checkmark}>✓</Text>
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
  badge: {
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    lineHeight: 13,
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
  clearBtn: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    lineHeight: 16,
  },
});
