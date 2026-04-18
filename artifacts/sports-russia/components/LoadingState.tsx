import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useColors } from "@/hooks/useColors";

function SkeletonCard() {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.muted,
          borderRadius: colors.radius,
          opacity: anim,
        },
      ]}
    />
  );
}

interface LoadingStateProps {
  count?: number;
}

export function LoadingState({ count = 4 }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    gap: 10,
  },
  card: {
    height: 96,
    marginHorizontal: 16,
  },
});
