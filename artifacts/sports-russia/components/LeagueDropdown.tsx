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
  { key: ALL_LEAGUES,               label: "Все лиги",                    short: "Все" },
  { key: "Российская Премьер-лига", label: "Российская Премьер-лига",     short: "РПЛ" },
  { key: "Футбольная национальная лига", label: "Футбольная национальная лига", short: "ФНЛ" },
  { key: "Кубок России",            label: "Кубок России",                 short: "Кубок" },
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
        <Text style={[styles.triggerText, { color: colors.foreground }]}>{current.label}</Text>
        <Text style={[styles.chevron, { color: colors.mutedForeground }]}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card, shadowColor: colors.foreground }]}>
            <Text style={[styles.sheetTitle, { color: colors.mutedForeground }]}>Выбор лиги</Text>
            <FlatList
              data={FOOTBALL_LEAGUES}
              keyExtractor={(item) => item.key}
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
                      { color: isActive ? colors.foreground : colors.foreground },
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  leagueItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  leagueShort: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    width: 44,
  },
  leagueLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  check: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
