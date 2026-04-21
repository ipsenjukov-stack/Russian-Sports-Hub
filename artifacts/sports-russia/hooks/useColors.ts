import { useTheme } from "@/context/ThemeContext";
import colors from "@/constants/colors";

export function useColors() {
  const { effectiveScheme } = useTheme();
  const isDark = effectiveScheme === "dark";
  const palette = isDark ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
