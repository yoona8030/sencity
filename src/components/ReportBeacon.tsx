import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text } from 'react-native';

type Props = { color?: string; label?: string };

export default function ReportBeacon({ color = '#DD0000', label }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.1] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 42, height: 42, borderRadius: 21,
          backgroundColor: color, opacity, transform: [{ scale }],
        }}
      />
      <View
        style={{
          width: 14, height: 14, borderRadius: 7,
          backgroundColor: '#fff', borderWidth: 3, borderColor: color,
          shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
        }}
      />
      {label ? (
        <View style={{
          marginTop: 4, paddingHorizontal: 6, paddingVertical: 2,
          borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.65)',
        }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}
