// src/screens/CheckboxGallery.tsx
import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import Checkbox from '../components/Checkbox';

// Row에 들어오는 item들은 checked/onChange를 제외한 나머지 옵션만 받게 함
type RowItem = {
  label: string;
  props: Omit<React.ComponentProps<typeof Checkbox>, 'checked' | 'onChange'>;
};

type RowProps = {
  title: string;
  items: RowItem[];
};

function Row({ title, items }: RowProps) {
  const [values, setValues] = useState<boolean[]>(items.map(() => false));
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((it, idx) => (
        <View key={`${title}-${idx}`} style={styles.itemRow}>
          <Checkbox
            {...it.props}
            checked={values[idx]}
            onChange={n =>
              setValues(prev => prev.map((v, i) => (i === idx ? n : v)))
            }
          />
          <Text style={styles.itemLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function CheckboxGallery() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Checkbox Gallery</Text>

      <Row
        title="기본 사이즈/색"
        items={[
          {
            label: 'size=16, sharp',
            props: { size: 16, corner: 'sharp', color: '#C62828' },
          },
          {
            label: 'size=18, round',
            props: { size: 18, corner: 'round', color: '#C62828' },
          },
          {
            label: 'size=22, sharp',
            props: { size: 22, corner: 'sharp', color: '#C62828' },
          },
        ]}
      />

      <Row
        title="끝부분(overshoot)"
        items={[
          {
            label: 'overshoot=0.16',
            props: { size: 18, overshoot: 0.16, corner: 'sharp' },
          },
          {
            label: 'overshoot=0.22',
            props: { size: 18, overshoot: 0.22, corner: 'sharp' },
          },
          {
            label: 'overshoot=0.28',
            props: { size: 18, overshoot: 0.28, corner: 'sharp' },
          },
        ]}
      />

      <Row
        title="바닥에서 띄우기(tickLift)"
        items={[
          {
            label: 'tickLift=0.08',
            props: { size: 18, tickLift: 0.08, corner: 'sharp' },
          },
          {
            label: 'tickLift=0.14',
            props: { size: 18, tickLift: 0.14, corner: 'sharp' },
          },
          {
            label: 'tickLift=0.20',
            props: { size: 18, tickLift: 0.2, corner: 'sharp' },
          },
        ]}
      />

      <Row
        title="두께(tickWidth)"
        items={[
          {
            label: 'tickWidth=4.5',
            props: { size: 18, tickWidth: 4.5, corner: 'sharp' },
          },
          {
            label: 'tickWidth=6.0',
            props: { size: 18, tickWidth: 6.0, corner: 'sharp' },
          },
          {
            label: 'tickWidth=7.0',
            props: { size: 18, tickWidth: 7.0, corner: 'sharp' },
          },
        ]}
      />

      <Row
        title="테두리/모서리"
        items={[
          {
            label: 'radius=4, sharp',
            props: { size: 18, radius: 4, corner: 'sharp' },
          },
          {
            label: 'radius=8, sharp',
            props: { size: 18, radius: 8, corner: 'sharp' },
          },
          {
            label: 'radius=8, round tick',
            props: { size: 18, radius: 8, corner: 'round' },
          },
        ]}
      />

      <Row
        title="컬러 & 비활성"
        items={[
          { label: 'red', props: { size: 18, color: '#C62828' } },
          { label: 'amber', props: { size: 18, color: '#F59E0B' } },
          {
            label: 'disabled',
            props: { size: 18, color: '#10B981', disabled: true },
          },
        ]}
      />

      <Row
        title="테두리 회색/굵기"
        items={[
          {
            label: 'uncheckedColor=#D2D2D2',
            props: { size: 18, uncheckedColor: '#D2D2D2' },
          },
          { label: 'borderWidth=3', props: { size: 18, borderWidth: 3 } },
          {
            label: 'borderWidth=3 + round',
            props: { size: 18, borderWidth: 3, corner: 'round' },
          },
        ]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 10, color: '#000' },
  section: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#111',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  itemLabel: { marginLeft: 10, color: '#111' },
});
