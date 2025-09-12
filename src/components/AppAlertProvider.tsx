// src/components/AppAlertProvider.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { Alert } from 'react-native';

type AppAlertContext = {
  notify: (opts: { title?: string; message: string }) => Promise<void>;
  confirm: (opts: {
    title?: string;
    message: string;
    okText?: string;
    cancelText?: string;
  }) => Promise<boolean>;
};

const Ctx = createContext<AppAlertContext | null>(null);

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<AppAlertContext>(
    () => ({
      notify: async ({ title = '알림', message }) =>
        new Promise<void>(resolve => {
          Alert.alert(
            title,
            message,
            [{ text: '확인', onPress: () => resolve() }],
            { cancelable: true },
          );
        }),
      confirm: async ({
        title = '알림',
        message,
        okText = '확인',
        cancelText = '취소',
      }) =>
        new Promise<boolean>(resolve => {
          Alert.alert(title, message, [
            {
              text: cancelText,
              style: 'cancel',
              onPress: () => resolve(false),
            },
            { text: okText, style: 'default', onPress: () => resolve(true) },
          ]);
        }),
    }),
    [],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppAlert() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppAlert must be used within AppAlertProvider');
  return ctx;
}
