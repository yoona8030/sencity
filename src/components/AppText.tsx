// src/components/AppText.tsx
import React from 'react';
import { Text, TextProps } from 'react-native';
import { usePreferences } from '../state/preferences';

export default function AppText({ style, ...rest }: TextProps) {
  const { prefs } = usePreferences();
  const base = Array.isArray(style)
    ? Object.assign({}, ...style)
    : (style as any) || {};
  const size = base.fontSize ?? 16;
  return (
    <Text
      {...rest}
      style={[style, { fontSize: size * (prefs.fontScale ?? 1) }]}
    />
  );
}
