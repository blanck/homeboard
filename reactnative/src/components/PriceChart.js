import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Svg, {
  Path,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import {energyColor} from '../utils/colors';

const PriceChart = ({data, currentPrice, width = 400, height = 200}) => {
  if (!data || data.length === 0) {
    return null;
  }

  const padding = {top: 20, right: 40, bottom: 30, left: 50};
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values) * 0.9;
  const maxVal = Math.max(...values) * 1.1;
  const range = maxVal - minVal || 1;

  const xStep = chartW / (data.length - 1 || 1);

  const points = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartH - ((d.value - minVal) / range) * chartH,
  }));

  // Build smooth curve path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    pathD += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // X-axis labels (every 3rd)
  const xLabels = data.filter((_, i) => i % 3 === 0).map((d, i) => ({
    label: String(d.name).padStart(2, '0'),
    x: padding.left + (data.indexOf(d) >= 0 ? data.indexOf(d) : i * 3) * xStep,
  }));

  // Y-axis labels
  const ySteps = 4;
  const yLabels = [];
  for (let i = 0; i <= ySteps; i++) {
    const val = minVal + (range * i) / ySteps;
    yLabels.push({
      label: (Math.round(val * 100) / 100).toFixed(2),
      y: padding.top + chartH - (i / ySteps) * chartH,
    });
  }

  // Current price marker
  let markerY = null;
  if (currentPrice) {
    markerY =
      padding.top + chartH - ((currentPrice.value - minVal) / range) * chartH;
  }

  // Current hour vertical line
  const currentHour = String(new Date().getHours());
  const currentIdx = data.findIndex((d) => d.name === currentHour);
  const currentX = currentIdx >= 0 ? padding.left + currentIdx * xStep : null;

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#f94144" stopOpacity="1" />
            <Stop offset="50%" stopColor="#ffe74c" stopOpacity="1" />
            <Stop offset="100%" stopColor="#42b983" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Chart line */}
        <Path
          d={pathD}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth={3}
        />

        {/* X-axis labels */}
        {xLabels.map((item, idx) => (
          <SvgText
            key={'x' + idx}
            x={item.x}
            y={height - 5}
            fill="#666677"
            fontSize="11"
            textAnchor="middle">
            {item.label}
          </SvgText>
        ))}

        {/* Y-axis labels */}
        {yLabels.map((item, idx) => (
          <SvgText
            key={'y' + idx}
            x={padding.left - 8}
            y={item.y + 4}
            fill="#666677"
            fontSize="11"
            textAnchor="end">
            {item.label}
          </SvgText>
        ))}

        {/* Current time vertical line */}
        {currentX != null ? (
          <Line
            x1={currentX}
            y1={padding.top}
            x2={currentX}
            y2={padding.top + chartH}
            stroke="#0B77EF"
            strokeWidth={2}
          />
        ) : null}

        {/* Current price marker */}
        {markerY != null && currentPrice ? (
          <>
            <Line
              x1={padding.left}
              y1={markerY}
              x2={width - padding.right}
              y2={markerY}
              stroke="rgba(11, 119, 239, 0.5)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <SvgText
              x={width - padding.right + 4}
              y={markerY + 4}
              fill="rgba(11, 119, 239, 0.7)"
              fontSize="10">
              {currentPrice.label}
            </SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});

export default PriceChart;
