import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

/* ================= Types ================= */
type AlertBase = {
  title?: string;
  message?: string;

  // Buttons
  confirmText?: string; // e.g. '확인'
  cancelText?: string; // e.g. '취소'
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;

  // Style
  confirmTint?: string; // default '#111' (or '#DD0000' when destructive)
  cancelTint?: string; // default '#000'
  destructive?: boolean;
  theme?: 'light' | 'dark';

  // Auto dismiss (when there are NO buttons)
  autoDismissMs?: number;
};

type AlertContextType = {
  notify: (payload: AlertBase) => Promise<void>;
  confirm: (payload: Omit<AlertBase, 'autoDismissMs'>) => Promise<boolean>;
};

// ↓ 기존 GENERIC_TITLES 확장
const GENERIC_TITLES = new Set([
  '오류',
  '에러',
  '경고',
  '알림',
  '로그아웃',
  'Error',
  'Warning',
  'Notice',
  'Alert',
  'Logout',
  'Log out',
  'Sign out',
]);

function normalizePayload<T extends { title?: string | undefined }>(p: T): T {
  const t = p.title?.trim();
  const title = t && GENERIC_TITLES.has(t) ? undefined : t;
  return { ...p, title } as T;
}

/* ================= Context ================= */
const AlertContext = createContext<AlertContextType | null>(null);

export const AppAlertProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<AlertBase | null>(null);

  // keep timer id safely
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 90,
      }),
    ]).start();
  }, [opacity, scale]);

  const animateOut = useCallback(
    (cb?: () => void) => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }),
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => cb?.());
    },
    [opacity, scale],
  );

  const clearTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const close = useCallback(() => {
    clearTimer();
    animateOut(() => {
      setVisible(false);
      setPayload(null);
      scale.setValue(0.85);
    });
  }, [animateOut, scale]);

  /* ================= API: notify ================= */
  const notify = useCallback(
    async (p: AlertBase) => {
      clearTimer();

      const hasButtons = !!(p.confirmText || p.cancelText);
      // if no buttons and no autoDismiss: default to '확인' only
      const nextRaw: AlertBase =
        !hasButtons && !p.autoDismissMs
          ? { ...p, confirmText: '확인' }
          : { ...p };

      // filter generic titles like '오류'
      const next = normalizePayload(nextRaw);

      // default handlers -> close()
      if (next.confirmText && !next.onConfirm) next.onConfirm = () => close();
      if (next.cancelText && !next.onCancel) next.onCancel = () => close();

      setPayload(next);
      setVisible(true);
      requestAnimationFrame(animateIn);

      // if really no buttons and has autoDismiss
      if (!next.confirmText && !next.cancelText && next.autoDismissMs) {
        hideTimer.current = setTimeout(() => close(), next.autoDismissMs);
      }
    },
    [animateIn, close],
  );

  /* ================= API: confirm (Promise<boolean>) ================= */
  const confirm = useCallback(
    (p: Omit<AlertBase, 'autoDismissMs'>) => {
      clearTimer();
      return new Promise<boolean>(resolve => {
        const withButtonsRaw: AlertBase = {
          ...p,
          cancelText: p.cancelText ?? '취소',
          confirmText: p.confirmText ?? '확인',
          onCancel: async () => {
            try {
              await p.onCancel?.();
            } finally {
              resolve(false);
              close();
            }
          },
          onConfirm: async () => {
            try {
              await p.onConfirm?.();
            } finally {
              resolve(true);
              close();
            }
          },
        };

        const withButtons = normalizePayload(withButtonsRaw);

        setPayload(withButtons);
        setVisible(true);
        requestAnimationFrame(animateIn);
      });
    },
    [animateIn, close],
  );

  const ctx = useMemo<AlertContextType>(
    () => ({ notify, confirm }),
    [notify, confirm],
  );

  const isDark = (payload?.theme ?? 'light') === 'dark';
  const confirmTint = payload?.confirmTint ?? '#DD0000';
  const cancelTint = payload?.cancelTint ?? '#000000';
  const hasBoth = !!(payload?.cancelText && payload?.confirmText);
  const hasTitle = !!payload?.title;

  return (
    <AlertContext.Provider value={ctx}>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity }]} />

        {/* Card */}
        <View style={styles.centerWrap}>
          <Animated.View
            pointerEvents="auto"
            style={[
              styles.card,
              isDark && styles.cardDark,
              { transform: [{ scale }] },
              { zIndex: 1 },
            ]}
          >
            {hasTitle && (
              <Text style={[styles.title, isDark && styles.titleDark]}>
                {payload!.title}
              </Text>
            )}

            {!!payload?.message && (
              <Text
                style={[
                  styles.message,
                  isDark && styles.messageDark,
                  !hasTitle && styles.messageNoTitle,
                ]}
              >
                {payload.message}
              </Text>
            )}

            {/* Buttons */}
            <View
              style={[
                styles.actions,
                hasBoth ? styles.actionsSplit : styles.actionsSingle,
              ]}
            >
              {!!payload?.cancelText && (
                <TouchableOpacity
                  style={[styles.btnBase, styles.btnLeft]}
                  onPress={() => payload?.onCancel?.()}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnText, { color: cancelTint }]}>
                    {payload.cancelText}
                  </Text>
                </TouchableOpacity>
              )}

              {!!payload?.confirmText && (
                <TouchableOpacity
                  style={[
                    styles.btnBase,
                    hasBoth ? styles.btnRight : styles.btnFull,
                  ]}
                  onPress={() => payload?.onConfirm?.()}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.btnTextBold, { color: confirmTint }]}>
                    {payload.confirmText}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

/* ================= Hook ================= */
export const useAppAlert = () => {
  const v = useContext(AlertContext);
  if (!v) throw new Error('useAppAlert must be used within AppAlertProvider');
  return v;
};

/* ================= Styles ================= */
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 0, // buttons draw top border, so no extra bottom padding
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  cardDark: { backgroundColor: '#171717' },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  titleDark: { color: '#fff' },

  message: {
    marginTop: 14,
    marginBottom: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    textAlign: 'center',
  },
  messageNoTitle: { marginTop: 4 }, // tighter top margin when no title
  messageDark: { color: '#eaeaea' },

  actions: {
    marginTop: 14,
    overflow: 'hidden',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  actionsSplit: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
  },
  actionsSingle: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnBase: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLeft: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#ECECEC',
    backgroundColor: '#FFF',
  },
  btnRight: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  btnFull: {
    minWidth: 100,
    paddingHorizontal: 22,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F6F6F6',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  btnTextBold: {
    fontSize: 15,
    fontWeight: '800',
  },
});
