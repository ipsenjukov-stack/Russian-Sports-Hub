import React from "react";
import Svg, { G, Polygon, Text } from "react-native-svg";

interface Props {
  size?: number;
}

/**
 * Vector SVG logo for Вторая Лига А (LEON).
 * Pentagon shield shape: dark red, "2" + "LEON" + "ЛИГА А" wordmark.
 */
export function VtorayaLigaALogo({ size = 32 }: Props) {
  const W = 100;
  const H = 96;
  const scale = size / Math.max(W, H);

  // Pentagon points (flat bottom, pointed top), centered around (50, 44)
  // Top point, then clockwise: top-right, bottom-right, bottom-left, top-left
  const pentagon = "50,6 94,38 76,90 24,90 6,38";

  const red = "#9B1C1C";
  const darkRed = "#7A1515";

  return (
    <Svg width={W * scale} height={H * scale} viewBox={`0 0 ${W} ${H}`}>
      <G>
        {/* Pentagon body */}
        <Polygon points={pentagon} fill={red} />
        {/* Subtle inner border */}
        <Polygon points={pentagon} fill="none" stroke="white" strokeWidth={1.5} opacity={0.2} />

        {/* "2" numeral */}
        <Text
          x={50}
          y={46}
          textAnchor="middle"
          fill="white"
          fontSize={34}
          fontWeight="bold"
          fontFamily="sans-serif"
        >
          2
        </Text>

        {/* "LEON" sponsor */}
        <Text
          x={50}
          y={61}
          textAnchor="middle"
          fill="white"
          fontSize={10}
          fontWeight="bold"
          fontFamily="sans-serif"
          letterSpacing={2}
          opacity={0.9}
        >
          LEON
        </Text>

        {/* "ЛИГА А" */}
        <Text
          x={50}
          y={78}
          textAnchor="middle"
          fill="white"
          fontSize={9}
          fontWeight="600"
          fontFamily="sans-serif"
          letterSpacing={1.5}
          opacity={0.85}
        >
          ЛИГА А
        </Text>
      </G>
    </Svg>
  );
}
