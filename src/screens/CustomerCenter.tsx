import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerCenter'>;

// ▽ 추가 여백(“조금”만 내리고 싶을 때). 너무 내려간다면 0 유지.
const EXTRA_TOP = 0;
// ▽ 상단 안전영역을 살짝 깎아서 덜 내려오게. 4~8 권장.
const SAFE_TRIM = 6;

const FAQS = [
  '위치 접근 권한을 허용해야 하나요?',
  '사진 없이도 신고할 수 있나요?',
  '이메일 주소를 변경할 수 있나요?',
  '신고 처리에는 얼마나 걸리나요?',
  '처리 결과에 대해 의견을 남길 수 있나요?',
  '고객센터 운영 시간은 어떻게 되나요?',
  '신고 실수를 했어요. 취소할 수 있나요?',
];
const GUIDES = ['앱 설치 방법', '신고 절차 안내', '이메일 변경 방법'];

export default function CustomerCenter({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'faq' | 'guide'>('faq');
  const listData = tab === 'faq' ? FAQS : GUIDES;

  // ✅ 헤더 상단 여백을 “너무 내려가지 않게” 안전영역에서 약간 깎아 사용
  const headerTop = Platform.select({
    ios: Math.max(insets.top - SAFE_TRIM, 0) + EXTRA_TOP,
    android: 2 + EXTRA_TOP, // 안드로이드는 살짝만
    default: Math.max(insets.top - SAFE_TRIM, 0) + EXTRA_TOP,
  });

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
      {/* 본문 */}
      <View style={styles.body}>
        <View style={styles.searchWrapper}>
          <Icon name="search-outline" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="무엇을 도와드릴까요?"
            placeholderTextColor="#888"
          />
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'faq' && styles.tabButtonActive]}
            onPress={() => setTab('faq')}
          >
            <Text
              style={[styles.tabText, tab === 'faq' && styles.tabTextActive]}
            >
              자주 묻는 질문
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              tab === 'guide' && styles.tabButtonActive,
            ]}
            onPress={() => setTab('guide')}
          >
            <Text
              style={[styles.tabText, tab === 'guide' && styles.tabTextActive]}
            >
              앱 사용 가이드
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {listData.map((text, idx) => (
            <TouchableOpacity key={idx} style={styles.item} onPress={() => {}}>
              <Text style={styles.itemText}>{text}</Text>
              <Icon name="chevron-forward" size={20} color="#888" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 하단 고정 버튼 */}
      <TouchableOpacity
        style={[styles.footerButton, { marginBottom: insets.bottom + 20 }]}
        onPress={() => navigation.navigate('Inquiry')}
        activeOpacity={0.9}
      >
        <Text style={styles.footerButtonText}>1:1 문의하기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  body: {
    flex: 1,
  },

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 15,
    height: 40,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#000',
  },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    marginRight: 8,
  },
  tabButtonActive: {
    backgroundColor: '#FEBA15',
  },
  tabText: {
    fontSize: 14,
    color: '#555',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },

  content: {
    flex: 1,
    marginHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemText: {
    fontSize: 16,
    color: '#333',
  },

  footerButton: {
    marginHorizontal: 16,
    backgroundColor: '#FEBA15',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});
