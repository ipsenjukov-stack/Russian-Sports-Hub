import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTheme, ThemePreference } from "@/context/ThemeContext";
import { useFavorites } from "@/context/FavoritesContext";
import {
  requestPermissions,
  getExpoPushToken,
  registerWithBackend,
  unregisterFromBackend,
  setActivePrefs,
  setupAndroidChannel,
  getApiBase,
  NotifPrefs,
  DEFAULT_NOTIF_PREFS,
} from "@/services/pushNotifications";

const FAN_KEY = "@sports_russia_fan";
const NOTIF_KEY = "@sports_russia_notif";
const TOKEN_KEY = "@sports_russia_push_token";
const NOTIF_PREFS_KEY = "@sports_russia_notif_prefs";

interface FanProfile {
  name: string;
  email: string;
  team: string;
}

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6];

function hoursLabel(h: number): string {
  if (h === 1) return "1 ч";
  if (h < 5) return `${h} ч`;
  return `${h} ч`;
}

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { preference, setPreference } = useTheme();
  const { favorites } = useFavorites();

  const slideAnim = useRef(new Animated.Value(600)).current;

  const [fan, setFan] = useState<FanProfile>({ name: "", email: "", team: "" });
  const [fanSaved, setFanSaved] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifStatus, setNotifStatus] = useState<"idle" | "denied" | "active">("idle");
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(FAN_KEY).then((raw) => {
      if (raw) { try { setFan(JSON.parse(raw)); } catch {} }
    });
    AsyncStorage.getItem(NOTIF_KEY).then((val) => {
      setNotifEnabled(val === "true");
      if (val === "true") setNotifStatus("active");
    });
    AsyncStorage.getItem(NOTIF_PREFS_KEY).then((raw) => {
      if (raw) {
        try {
          const loaded = { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
          setPrefs(loaded);
          setActivePrefs(loaded);
        } catch {}
      }
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

  function updatePref<K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
    setActivePrefs(updated);
    if (key === "vibration") {
      setupAndroidChannel(updated.vibration).catch(() => {});
    }
  }

  const toggleNotif = useCallback(async (val: boolean) => {
    if (Platform.OS === "web") {
      Alert.alert("Уведомления", "Пуш-уведомления доступны только в мобильном приложении.");
      return;
    }
    if (val) {
      setNotifLoading(true);
      try {
        const granted = await requestPermissions();
        if (!granted) {
          setNotifStatus("denied");
          setNotifLoading(false);
          Alert.alert(
            "Нет разрешения",
            "Разрешите уведомления в настройках телефона, чтобы получать уведомления о матчах."
          );
          return;
        }
        const token = await getExpoPushToken();
        if (token) {
          await AsyncStorage.setItem(TOKEN_KEY, token);
          await registerWithBackend(token, favorites, prefs);
        }
        setNotifEnabled(true);
        setNotifStatus("active");
        AsyncStorage.setItem(NOTIF_KEY, "true");
      } finally {
        setNotifLoading(false);
      }
    } else {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) await unregisterFromBackend(token);
      setNotifEnabled(false);
      setNotifStatus("idle");
      AsyncStorage.setItem(NOTIF_KEY, "false");
    }
  }, [favorites, prefs]);

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
          <View style={[styles.handle, { backgroundColor: colors.muted }]} />

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
            <View style={[styles.section, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>УВЕДОМЛЕНИЯ</Text>

              {/* Master toggle */}
              <View style={styles.notifRow}>
                <View style={styles.notifTextCol}>
                  <Text style={[styles.notifTitle, { color: colors.foreground }]}>Пуш-уведомления</Text>
                  <Text style={[styles.notifSub, { color: colors.mutedForeground }]}>
                    {notifStatus === "active"
                      ? `Активно · ${favorites.length > 0 ? `${favorites.length} команд` : "добавьте избранные"}`
                      : notifStatus === "denied"
                      ? "Разрешение отклонено"
                      : "Включите для избранных команд"}
                  </Text>
                </View>
                <Switch
                  value={notifEnabled}
                  onValueChange={toggleNotif}
                  disabled={notifLoading}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                  ios_backgroundColor={colors.border}
                />
              </View>

              {/* Notification preferences — visible when enabled */}
              {notifStatus === "active" && (
                <View style={[styles.prefsCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>

                  {/* Hours before */}
                  <View style={styles.prefRow}>
                    <View style={styles.prefTextCol}>
                      <Text style={[styles.prefLabel, { color: colors.foreground }]}>Напомнить до матча</Text>
                      <Text style={[styles.prefSub, { color: colors.mutedForeground }]}>
                        За {hoursLabel(prefs.hoursBefore)}
                      </Text>
                    </View>
                  </View>

                  {/* Step selector */}
                  <View style={styles.hoursRow}>
                    {HOUR_OPTIONS.map((h) => {
                      const active = prefs.hoursBefore === h;
                      return (
                        <TouchableOpacity
                          key={h}
                          onPress={() => updatePref("hoursBefore", h)}
                          style={[
                            styles.hourPill,
                            {
                              backgroundColor: active ? colors.primary : colors.background,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                          activeOpacity={0.75}
                        >
                          <Text style={[
                            styles.hourPillText,
                            { color: active ? "#fff" : colors.mutedForeground, fontFamily: active ? "Inter_700Bold" : "Inter_400Regular" }
                          ]}>
                            {h}ч
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

                  {/* Match start */}
                  <View style={styles.prefRow}>
                    <View style={styles.prefTextCol}>
                      <Text style={[styles.prefLabel, { color: colors.foreground }]}>Начало матча</Text>
                      <Text style={[styles.prefSub, { color: colors.mutedForeground }]}>
                        Уведомление при старте
                      </Text>
                    </View>
                    <Switch
                      value={prefs.onMatchStart}
                      onValueChange={(v) => updatePref("onMatchStart", v)}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#fff"
                      ios_backgroundColor={colors.border}
                    />
                  </View>

                  <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

                  {/* In-match events */}
                  <View style={styles.prefRow}>
                    <View style={styles.prefTextCol}>
                      <Text style={[styles.prefLabel, { color: colors.foreground }]}>События в матче</Text>
                      <Text style={[styles.prefSub, { color: colors.mutedForeground }]}>
                        Гол, партия, четверть
                      </Text>
                    </View>
                    <Switch
                      value={prefs.onMatchEvent}
                      onValueChange={(v) => updatePref("onMatchEvent", v)}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#fff"
                      ios_backgroundColor={colors.border}
                    />
                  </View>

                  <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

                  {/* Match end */}
                  <View style={styles.prefRow}>
                    <View style={styles.prefTextCol}>
                      <Text style={[styles.prefLabel, { color: colors.foreground }]}>Завершение матча</Text>
                      <Text style={[styles.prefSub, { color: colors.mutedForeground }]}>
                        Итоговый счёт
                      </Text>
                    </View>
                    <Switch
                      value={prefs.onMatchEnd}
                      onValueChange={(v) => updatePref("onMatchEnd", v)}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#fff"
                      ios_backgroundColor={colors.border}
                    />
                  </View>

                  <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

                  {/* Sound */}
                  <View style={styles.prefRow}>
                    <View style={styles.prefTextCol}>
                      <Text style={[styles.prefLabel, { color: colors.foreground }]}>Звук</Text>
                      <Text style={[styles.prefSub, { color: colors.mutedForeground }]}>
                        {prefs.sound === "default" ? "Стандартный системный" : "Беззвучно"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.soundRow}>
                    {(["default", "silent"] as const).map((opt) => {
                      const active = prefs.sound === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => updatePref("sound", opt)}
                          style={[
                            styles.soundPill,
                            {
                              backgroundColor: active ? colors.primary : colors.background,
                              borderColor: active ? colors.primary : colors.border,
                            },
                          ]}
                          activeOpacity={0.75}
                        >
                          <Ionicons
                            name={opt === "default" ? "volume-high-outline" : "volume-mute-outline"}
                            size={15}
                            color={active ? "#fff" : colors.mutedForeground}
                          />
                          <Text style={[
                            styles.soundPillText,
                            { color: active ? "#fff" : colors.mutedForeground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }
                          ]}>
                            {opt === "default" ? "Стандартный" : "Без звука"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />

                  {/* Vibration */}
                  <View style={styles.prefRow}>
                    <View style={styles.prefTextCol}>
                      <Text style={[styles.prefLabel, { color: colors.foreground }]}>Вибрация</Text>
                      <Text style={[styles.prefSub, { color: colors.mutedForeground }]}>
                        {Platform.OS === "ios" ? "Управляется системой iOS" : prefs.vibration ? "Включена" : "Выключена"}
                      </Text>
                    </View>
                    <Switch
                      value={prefs.vibration}
                      onValueChange={(v) => updatePref("vibration", v)}
                      disabled={Platform.OS === "ios"}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#fff"
                      ios_backgroundColor={colors.border}
                    />
                  </View>

                </View>
              )}

              {notifStatus === "active" && (
                <TouchableOpacity
                  style={[styles.testBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  activeOpacity={0.75}
                  onPress={async () => {
                    try {
                      const base = getApiBase();
                      const token = await AsyncStorage.getItem("@sports_russia_push_token");
                      const resp = await fetch(`${base}/api/notifications/test-goal`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(token ? { token } : {}),
                      });
                      const data = await resp.json();
                      if (data.ok) {
                        Alert.alert("Тест отправлен ✅", `${data.title}\n${data.body}`);
                      } else {
                        Alert.alert("Ошибка", data.error ?? "Не удалось отправить");
                      }
                    } catch (e) {
                      Alert.alert("Ошибка", String(e));
                    }
                  }}
                >
                  <Ionicons name="paper-plane-outline" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.testBtnText, { color: colors.mutedForeground }]}>Тестовое уведомление о голе</Text>
                </TouchableOpacity>
              )}

              {notifStatus === "denied" && (
                <View style={[styles.notifNote, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                  <Ionicons name="alert-circle-outline" size={14} color="#F59E0B" />
                  <Text style={[styles.notifNoteText, { color: colors.mutedForeground }]}>
                    Разрешите уведомления в настройках телефона и попробуйте снова
                  </Text>
                </View>
              )}

              {Platform.OS === "web" && (
                <View style={[styles.notifNote, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                  <Ionicons name="phone-portrait-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.notifNoteText, { color: colors.mutedForeground }]}>
                    Пуш-уведомления доступны только в мобильном приложении
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
    maxHeight: "90%",
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
  prefsCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  prefTextCol: {
    flex: 1,
    marginRight: 12,
  },
  prefLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  prefSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  prefDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  hoursRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  hourPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  hourPillText: {
    fontSize: 13,
  },
  soundRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  soundPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  soundPillText: {
    fontSize: 13,
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  testBtnText: {
    fontSize: 13,
  },
});
