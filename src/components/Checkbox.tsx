import React from 'react';
import { Pressable, Text, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

type CornerStyle = 'round' | 'sharp';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  size?: number;
  radius?: number;
  color?: string;
  uncheckedColor?: string;
  borderWidth?: number;
  tickWidth?: number;
  /** 체크 끝이 네모 밖으로 나가는 정도 (0~0.4 권장) */
  overshoot?: number;
  /** 체크를 박스 바닥에서 얼마나 띄울지 (size 비율, 0~0.3 권장) */
  tickLift?: number;
  /** 체크 선의 모서리 스타일 */
  corner?: CornerStyle;
  style?: ViewStyle;
  disabled?: boolean;
};

const AView = Animated.createAnimatedComponent(View);

export default function Checkbox({
  checked,
  onChange,
  label,
  size = 18,
  radius = 4, // ◀ 모서리 4
  color = '#C62828',
  uncheckedColor = '#D2D2D2',
  borderWidth = 2.2,
  tickWidth = 4.5, // ◀ 두께 4.5
  overshoot = 0.26, // ◀ 끝부분 더 바깥으로
  tickLift = 0.16, // ◀ 바닥에서 띄우기
  corner = 'sharp', // ◀ 각진 체크 기본
  style,
  disabled = false,
}: Props) {
  const p = useSharedValue(checked ? 1 : 0);

  React.useEffect(() => {
    p.value = withTiming(checked ? 1 : 0, { duration: 140 });
  }, [checked]);

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: checked ? color : uncheckedColor,
    backgroundColor: 'transparent', // 바깥 영역은 그대로 투명
  }));

  const tickAnim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.92 + 0.08 * p.value }],
  }));

  // 100x100 가상 좌표계(체크를 비율로 그리기)
  const px = size + tickWidth;
  const scale = px / 100;

  // 바닥에서 띄우는 양(가상좌표 기준)
  const lift = tickLift * 100;

  // 체크 각도/길이(끝을 조금 위로, 더 길게)
  const endX = 84 + overshoot * 12;
  const endY = 26 - overshoot * 10;

  // 시작/중간 포인트(바닥에서 들어 올림)
  const startX = 22;
  const startY = 58 - lift;
  const midX = 40;
  const midY = 78 - lift;

  const cap = corner === 'sharp' ? 'butt' : 'round';
  const join = corner === 'sharp' ? 'miter' : 'round';

  return (
    <Pressable
      onPress={() => !disabled && onChange(!checked)}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={[styles.row, style]}
    >
      <AView
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible', // 체크가 박스 밖으로 나가도 보이게
          },
          boxStyle,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.tickWrap, { width: px, height: px }, tickAnim]}
        >
          <Svg width={px} height={px} viewBox="-6 -6 112 112">
            <Path
              d={`M${startX} ${startY} L${midX} ${midY} L ${endX} ${endY}`}
              stroke={color}
              strokeWidth={tickWidth / scale}
              strokeLinecap={cap}
              strokeLinejoin={join}
              fill="none"
            />
          </Svg>
        </Animated.View>
      </AView>

      {label ? (
        <Text style={[styles.label, disabled && { opacity: 0.5 }]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { marginLeft: 6, fontSize: 14, color: '#000', fontWeight: '500' },
  tickWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
