// src/components/ConfirmDialog.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  cancelText?: string; // 없거나 빈 문자열이면 취소 버튼 숨김
  confirmText?: string;
  onCancel: () => void;
  onConfirm: () => void;
  cancelTextColor?: string; // 기본: #000000
  confirmTextColor?: string; // 기본: #DD0000
};

export default function ConfirmDialog({
  visible,
  title = '알림',
  message = '',
  cancelText = '취소',
  confirmText = '확인',
  onCancel,
  onConfirm,
  cancelTextColor = '#000000',
  confirmTextColor = '#DD0000',
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop} />
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.actions}>
            {!!cancelText && (
              <TouchableOpacity
                style={[styles.btn, styles.cancel]}
                onPress={onCancel}
              >
                <Text style={[styles.btnText, { color: cancelTextColor }]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btn, styles.confirm]}
              onPress={onConfirm}
            >
              <Text style={[styles.btnText, { color: confirmTextColor }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#000',
  },
  message: {
    fontSize: 15,
    color: '#222',
    textAlign: 'center',
    marginBottom: 14,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: {
    minWidth: 90,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '800' },
  cancel: { borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FFF' },
  confirm: { backgroundColor: 'transparent' },
});
