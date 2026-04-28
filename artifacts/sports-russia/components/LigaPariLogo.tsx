import React from "react";
import Svg, { G, Polygon, Text, TSpan, Path } from "react-native-svg";

interface Props {
  size?: number;
}

/**
 * Vector SVG logo for Лига PARI (FNL).
 * Reproduces the teal hexagon badge with "1" and "ЛИГА PARI" wordmark.
 */
export function LigaPariLogo({ size = 32 }: Props) {
  const W = 100;
  const H = 92;
  const scale = size / Math.max(W, H);

  // Flat-top hexagon centered at (50, 42), radius 38
  const cx = 50;
  const cy = 40;
  const r = 37;
  const hexPoints = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

  // Inner hexagon (border inset)
  const ri = 30;
  const innerPoints = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + ri * Math.cos(angle)).toFixed(2)},${(cy + ri * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");

  const teal = "#00B4A8";
  const dark = "#009990";

  return (
    <Svg
      width={W * scale}
      height={H * scale}
      viewBox={`0 0 ${W} ${H}`}
    >
      <G>
        {/* Outer hexagon fill */}
        <Polygon points={hexPoints} fill={teal} />
        {/* Inner hexagon (slightly lighter border effect) */}
        <Polygon points={innerPoints} fill="none" stroke="white" strokeWidth={1.2} opacity={0.35} />

        {/* "1" numeral */}
        <Text
          x={cx}
          y={cy + 13}
          textAnchor="middle"
          fill="white"
          fontSize={32}
          fontWeight="bold"
          fontFamily="serif"
          letterSpacing={0}
        >
          1
        </Text>

        {/* Wordmark: ЛИГА */}
        <Text
          x={cx}
          y={H - 18}
          textAnchor="middle"
          fill={teal}
          fontSize={9}
          fontWeight="600"
          fontFamily="sans-serif"
          letterSpacing={2}
        >
          ЛИГА
        </Text>

        {/* Wordmark: PARI */}
        <Text
          x={cx}
          y={H - 7}
          textAnchor="middle"
          fill={teal}
          fontSize={13}
          fontWeight="bold"
          fontFamily="sans-serif"
          letterSpacing={1}
        >
          PARI
        </Text>
      </G>
    </Svg>
  );
}
