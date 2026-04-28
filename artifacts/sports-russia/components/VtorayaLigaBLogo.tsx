import React from "react";
import Svg, { G, Polygon, Text } from "react-native-svg";

interface Props {
  size?: number;
}

/**
 * Vector SVG logo for Вторая Лига Б (LEON).
 * Pentagon shield shape: dark red, "2" + "LEON" + "ЛИГА Б" wordmark.
 */
export function VtorayaLigaBLogo({ size = 32 }: Props) {
  const W = 100;
  const H = 96;
  const scale = size / Math.max(W, H);

  const pentagon = "50,6 94,38 76,90 24,90 6,38";
  const red = "#9B1C1C";

  return (
    <Svg width={W * scale} height={H * scale} viewBox={`0 0 ${W} ${H}`}>
      <G>
        <Polygon points={pentagon} fill={red} />
        <Polygon points={pentagon} fill="none" stroke="white" strokeWidth={1.5} opacity={0.2} />

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
          ЛИГА Б
        </Text>
      </G>
    </Svg>
  );
}
