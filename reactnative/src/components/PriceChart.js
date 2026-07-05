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

  const padding = {top: 24, right: 20, bottom: 34, left: 56};
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Round y-axis to a "nice" step (0.05 / 0.10 / 0.25 / ...) like the
  // legacy chart, instead of arbitrary fractions of the data range
  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 0.5;
  const stepCandidates = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2];
  const step =
    stepCandidates.find((s) => span / s <= 4.5) ||
    stepCandidates[stepCandidates.length - 1];
  const minVal = Math.floor((rawMin - span * 0.06) / step) * step;
  const maxVal = Math.ceil((rawMax + span * 0.06) / step) * step;
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

  // X-axis labels: hourly like the legacy chart when there is room
  const labelEvery = chartW / (data.length || 1) >= 26 ? 1 : 3;
  const xLabels = data
    .map((d, i) => ({
      label: String(d.name).padStart(2, '0'),
      x: padding.left + i * xStep,
      idx: i,
    }))
    .filter((item) => item.idx % labelEvery === 0);

  // Y-axis labels at each nice step
  const yLabels = [];
  for (let val = minVal; val <= maxVal + step / 2; val += step) {
    yLabels.push({
      label: val.toFixed(2),
      y: padding.top + chartH - ((val - minVal) / range) * chartH,
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

        {/* Axis lines */}
        <Line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartH}
          stroke="rgba(70, 70, 90, 0.4)"
          strokeWidth={1}
        />
        <Line
          x1={padding.left}
          y1={padding.top + chartH}
          x2={width - padding.right}
          y2={padding.top + chartH}
          stroke="rgba(70, 70, 90, 0.4)"
          strokeWidth={1}
        />

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
            strokeOpacity={0.35}
            strokeWidth={2}
          />
        ) : null}

        {/* Current price marker: red dashed line + "HH:00: X.XX kr" label */}
        {markerY != null && currentPrice ? (
          <>
            <Line
              x1={padding.left}
              y1={markerY}
              x2={width - padding.right}
              y2={markerY}
              stroke="#e0433d"
              strokeOpacity={0.85}
              strokeWidth={1}
              strokeDasharray="5,4"
            />
            <SvgText
              x={width - padding.right - 4}
              y={markerY - 6}
              fill="#e0433d"
              fontSize="11"
              fontWeight="600"
              textAnchor="end">
              {`${currentHour.padStart(2, '0')}:00: ${currentPrice.value.toFixed(2)} kr`}
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
