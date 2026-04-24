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

export const ALL_LEAGUES = "all";

const CDN = "https://media.api-sports.io/football/leagues";

export interface League {
  key: string;
  label: string;
  logo: string | null;
}

export const FOOTBALL_LEAGUES: League[] = [
  { key: ALL_LEAGUES,                          label: "Все лиги",                     logo: null },
  { key: "Российская Премьер-лига",            label: "Российская Премьер-лига",      logo: `${CDN}/235.png` },
  { key: "Футбольная национальная лига",        label: "Футбольная национальная лига", logo: `${CDN}/236.png` },
  { key: "ФНЛ-2. Группа 1",                   label: "ФНЛ-2. Группа 1",             logo: `${CDN}/651.png` },
  { key: "ФНЛ-2. Группа 2",                   label: "ФНЛ-2. Группа 2",             logo: `${CDN}/652.png` },
  { key: "ФНЛ-2. Группа 3",                   label: "ФНЛ-2. Группа 3",             logo: `${CDN}/650.png` },
  { key: "ФНЛ-2. Группа 4",                   label: "ФНЛ-2. Группа 4",             logo: `${CDN}/653.png` },
  { key: "ФНЛ-2А. Дивизион А Золото",         label: "ФНЛ-2А. Дивизион А Золото",   logo: `${CDN}/1025.png` },
  { key: "ФНЛ-2А. Дивизион А Серебро",        label: "ФНЛ-2А. Дивизион А Серебро",  logo: `${CDN}/1026.png` },
  { key: "ФНЛ-2А. Плей-офф",                  label: "ФНЛ-2А. Плей-офф",            logo: `${CDN}/1121.png` },
  { key: "ФНЛ-2А. Весна Золото",              label: "ФНЛ-2А. Весна Золото",        logo: `${CDN}/1061.png` },
  { key: "ФНЛ-2А. Весна Серебро",             label: "ФНЛ-2А. Весна Серебро",       logo: `${CDN}/1064.png` },
  { key: "Кубок России",                       label: "Кубок России",                 logo: `${CDN}/237.png` },
  { key: "Суперкубок России",                  label: "Суперкубок России",            logo: `${CDN}/663.png` },
  { key: "Высший дивизион. Женщины",           label: "Высший дивизион. Женщины",     logo: `${CDN}/649.png` },
  { key: "Первенство молодёжных команд",       label: "Первенство молодёжных команд", logo: `${CDN}/238.png` },
];

interface LeagueDropdownProps {
  selected: string;
  onSelect: (league: string) => void;
}

export function LeagueDropdown({ selected, onSelect }: LeagueDropdownProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  const current = FOOTBALL_LEAGUES.find((l) => l.key === selected) ?? FOOTBALL_LEAGUES[0];

  const handleSelect = (key: string) => {
    onSelect(key);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={[styles.trigger, { backgroundColor: colors.muted, borderColor: colors.border }]}
      >
        {current.logo ? (
          <Image source={{ uri: current.logo }} style={styles.triggerLogo} resizeMode="contain" />
        ) : (
          <Text style={[styles.triggerBall, { color: colors.mutedForeground }]}>⚽</Text>
        )}
        <Text style={[styles.triggerText, { color: colors.foreground }]} numberOfLines={1}>
          {current.label}
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
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Выбор лиги</Text>

            <FlatList
              data={FOOTBALL_LEAGUES}
              keyExtractor={(item) => item.key}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Platform.OS === "ios" ? 32 : 16 }}
              renderItem={({ item }) => {
                const isActive = item.key === selected;
                return (
                  <TouchableOpacity
                    onPress={() => handleSelect(item.key)}
                    activeOpacity={0.7}
                    style={[
                      styles.leagueItem,
                      { borderBottomColor: colors.border },
                      isActive && { backgroundColor: colors.muted },
                    ]}
                  >
                    <View style={styles.logoWrap}>
                      {item.logo ? (
                        <Image
                          source={{ uri: item.logo }}
                          style={styles.leagueLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.allBall}>⚽</Text>
                      )}
                    </View>
                    <Text style={[
                      styles.leagueLabel,
                      { color: colors.foreground },
                      isActive && { fontFamily: "Inter_600SemiBold" },
                    ]}>
                      {item.label}
                    </Text>
                    {isActive && (
                      <Text style={[styles.check, { color: colors.primary }]}>✓</Text>
                    )}
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
    maxWidth: "80%",
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
  sheetTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 20,
    paddingBottom: 8,
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
  allBall: {
    fontSize: 24,
    lineHeight: 36,
    textAlign: "center",
  },
  leagueLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  check: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
