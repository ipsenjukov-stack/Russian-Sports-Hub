import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useColors } from "@/hooks/useColors";

interface LiveCounterProps {
  count: number;
}

export function LiveCounter({ count }: LiveCounterProps) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  if (count === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.liveBg, borderRadius: 10 }]}>
      <Animated.View style={[styles.dot, { backgroundColor: colors.live, opacity: pulse }]} />
      <Text style={[styles.text, { color: colors.live }]}>
        {count} {count === 1 ? "матч идёт" : count < 5 ? "матча идут" : "матчей идут"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 7,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
