import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import { useColors } from "@/hooks/useColors";

export const ALL_LEAGUES = "all";

export interface League {
  key: string;
  label: string;
  short: string;
}

export const FOOTBALL_LEAGUES: League[] = [
  { key: ALL_LEAGUES,                          label: "Все лиги",                       short: "Все" },
  { key: "Российская Премьер-лига",            label: "Российская Премьер-лига",        short: "РПЛ" },
  { key: "Футбольная национальная лига",        label: "Футбольная национальная лига",   short: "ФНЛ" },
  { key: "ФНЛ-2. Группа 1",                   label: "ФНЛ-2. Группа 1",               short: "ФНЛ-2/1" },
  { key: "ФНЛ-2. Группа 2",                   label: "ФНЛ-2. Группа 2",               short: "ФНЛ-2/2" },
  { key: "ФНЛ-2. Группа 3",                   label: "ФНЛ-2. Группа 3",               short: "ФНЛ-2/3" },
  { key: "ФНЛ-2. Группа 4",                   label: "ФНЛ-2. Группа 4",               short: "ФНЛ-2/4" },
  { key: "ФНЛ-2А. Дивизион А Золото",         label: "ФНЛ-2А. Дивизион А Золото",     short: "ФНЛ-2А" },
  { key: "ФНЛ-2А. Дивизион А Серебро",        label: "ФНЛ-2А. Дивизион А Серебро",    short: "ФНЛ-2С" },
  { key: "ФНЛ-2А. Плей-офф",                  label: "ФНЛ-2А. Плей-офф",              short: "ФНЛ-2А ПО" },
  { key: "ФНЛ-2А. Весна Золото",              label: "ФНЛ-2А. Весна Золото",          short: "ФНЛ Весна" },
  { key: "ФНЛ-2А. Весна Серебро",             label: "ФНЛ-2А. Весна Серебро",         short: "ФНЛ Вес.С" },
  { key: "Кубок России",                       label: "Кубок России",                   short: "Кубок" },
  { key: "Суперкубок России",                  label: "Суперкубок России",              short: "Суперкубок" },
  { key: "Высший дивизион. Женщины",           label: "Высший дивизион. Женщины",       short: "Женщины" },
  { key: "Первенство молодёжных команд",       label: "Первенство молодёжных команд",   short: "Молодёжь" },
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
            <View style={[styles.sheetHandle, { backgroundColor: colors.mutedForeground }]} />
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
                    <Text style={[
                      styles.leagueShort,
                      { color: isActive ? colors.primary : colors.mutedForeground },
                    ]}>
                      {item.short}
                    </Text>
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
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 6,
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
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
    opacity: 0.4,
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  leagueShort: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    width: 56,
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
