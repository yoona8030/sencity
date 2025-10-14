import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Animated, Easing } from 'react-native';

type Payload = { title: string; body?: string; icon?: any; onPress?: () => void };

const Ctx = createContext<{ show: (p: Payload) => void }>({ show: () => {} });
export const useInAppNotice = () => useContext(Ctx);

export function InAppNoticeHost({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start(() => setPayload(null));
  }, [anim]);

  const show = useCallback((p: Payload) => {
    setPayload(p);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.delay(3500),
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
    ]).start(() => setPayload(null));
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] });
  const opacity = anim;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {payload && (
        <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
          <Pressable onPress={() => { payload.onPress?.(); hide(); }} style={styles.card}>
            {payload.icon && <Image source={payload.icon} style={styles.icon} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{payload.title}</Text>
              {payload.body ? <Text style={styles.body} numberOfLines={2}>{payload.body}</Text> : null}
            </View>
          </Pressable>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 18, left: 12, right: 12, zIndex: 9999 },
  card: {
    backgroundColor: '#6F6F6F', borderRadius: 20, padding: 14, flexDirection: 'row', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },
  icon: { width: 28, height: 28, borderRadius: 8 },
  title: { color: '#fff', fontWeight: '700', marginBottom: 2 },
  body: { color: '#ECECEC' },
});
