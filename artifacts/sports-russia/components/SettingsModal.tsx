import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTheme, ThemePreference } from "@/context/ThemeContext";

const FAN_KEY = "@sports_russia_fan";
const NOTIF_KEY = "@sports_russia_notif";

interface FanProfile {
  name: string;
  email: string;
  team: string;
}

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useTheme();

  const slideAnim = useRef(new Animated.Value(600)).current;

  const [fan, setFan] = useState<FanProfile>({ name: "", email: "", team: "" });
  const [fanSaved, setFanSaved] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FAN_KEY).then((raw) => {
      if (raw) { try { setFan(JSON.parse(raw)); } catch {} }
    });
    AsyncStorage.getItem(NOTIF_KEY).then((val) => {
      setNotifEnabled(val === "true");
    });
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  function saveFan() {
    AsyncStorage.setItem(FAN_KEY, JSON.stringify(fan));
    setFanSaved(true);
    setTimeout(() => setFanSaved(false), 2000);
  }

  function toggleNotif(val: boolean) {
    setNotifEnabled(val);
    AsyncStorage.setItem(NOTIF_KEY, String(val));
  }

  const THEME_OPTIONS: { key: ThemePreference; label: string; icon: string }[] = [
    { key: "system", label: "Авто", icon: "phone-portrait-outline" },
    { key: "light", label: "Светлая", icon: "sunny-outline" },
    { key: "dark", label: "Тёмная", icon: "moon-outline" },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kvWrapper}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 24,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.muted }]} />

          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Настройки</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Тема ───────────────────────────────────────────────── */}
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ТЕМА</Text>
              <View style={styles.themeRow}>
                {THEME_OPTIONS.map(({ key, label, icon }) => {
                  const active = preference === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setPreference(key)}
                      style={[
                        styles.themePill,
                        {
                          backgroundColor: active ? colors.primary : colors.muted,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={icon as keyof typeof Ionicons.glyphMap}
                        size={16}
                        color={active ? "#fff" : colors.mutedForeground}
                      />
                      <Text style={[styles.themeLabel, { color: active ? "#fff" : colors.foreground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Регистрация болельщика ──────────────────────────────── */}
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>РЕГИСТРАЦИЯ БОЛЕЛЬЩИКА</Text>

              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="Ваше имя"
                placeholderTextColor={colors.mutedForeground}
                value={fan.name}
                onChangeText={(t) => setFan((f) => ({ ...f, name: t }))}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="Email"
                placeholderTextColor={colors.mutedForeground}
                value={fan.email}
                onChangeText={(t) => setFan((f) => ({ ...f, email: t }))}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="Любимая команда"
                placeholderTextColor={colors.mutedForeground}
                value={fan.team}
                onChangeText={(t) => setFan((f) => ({ ...f, team: t }))}
                returnKeyType="done"
                onSubmitEditing={saveFan}
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={saveFan}
                activeOpacity={0.85}
              >
                <Ionicons name={fanSaved ? "checkmark" : "save-outline"} size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{fanSaved ? "Сохранено!" : "Сохранить"}</Text>
              </TouchableOpacity>
            </View>

            {/* ── Пуш-уведомления ─────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>УВЕДОМЛЕНИЯ</Text>
              <View style={styles.notifRow}>
                <View style={styles.notifTextCol}>
                  <Text style={[styles.notifTitle, { color: colors.foreground }]}>Пуш-уведомления</Text>
                  <Text style={[styles.notifSub, { color: colors.mutedForeground }]}>
                    Старт матчей избранных команд
                  </Text>
                </View>
                <Switch
                  value={notifEnabled}
                  onValueChange={toggleNotif}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={notifEnabled ? "#fff" : "#fff"}
                  ios_backgroundColor={colors.border}
                />
              </View>
              {notifEnabled && (
                <View style={[styles.notifNote, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.notifNoteText, { color: colors.mutedForeground }]}>
                    Уведомления будут доступны в следующем обновлении приложения
                  </Text>
                </View>
              )}
            </View>

          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  kvWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  themeRow: {
    flexDirection: "row",
    gap: 10,
  },
  themePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  themeLabel: {
    fontSize: 13,
  },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 10,
    marginTop: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notifTextCol: {
    flex: 1,
    marginRight: 16,
  },
  notifTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  notifSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  notifNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
  },
  notifNoteText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
});
