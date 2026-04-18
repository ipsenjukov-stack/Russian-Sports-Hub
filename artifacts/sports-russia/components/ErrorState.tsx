import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface ErrorStateProps {
  onRetry?: () => void;
  message?: string;
}

export function ErrorState({ onRetry, message = "Не удалось загрузить данные" }: ErrorStateProps) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
      <Text style={[styles.text, { color: colors.mutedForeground }]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.8}
          style={[styles.btn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={styles.btnText}>Повторить</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  text: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 4,
  },
  btnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
