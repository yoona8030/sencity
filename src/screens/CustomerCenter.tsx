import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerCenter'>;

const FAQS = [
  '위치 접근 권한을 허용해야 하나요?',
  '사진 없이도 신고할 수 있나요?',
  '이메일 주소를 변경할 수 있나요?',
  '신고 처리에는 얼마나 걸리나요?',
  '처리 결과에 대해 의견을 남길 수 있나요?',
  '고객센터 운영 시간은 어떻게 되나요?',
  '신고 실수를 했어요. 취소할 수 있나요?',
  // … 더 추가 예정
];
const GUIDES = [
  '앱 설치 방법',
  '신고 절차 안내',
  '이메일 변경 방법',
  // … 더 추가 예정
];

export default function CustomerCenter({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'faq' | 'guide'>('faq');
  const listData = tab === 'faq' ? FAQS : GUIDES;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.leftHeader}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.deerIconLarge}
          />
          <Text style={styles.headerTitle}>고객 센터</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} />
        </TouchableOpacity>
      </View>

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
          <Text style={[styles.tabText, tab === 'faq' && styles.tabTextActive]}>
            자주 묻는 질문
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'guide' && styles.tabButtonActive]}
          onPress={() => setTab('guide')}
        >
          <Text
            style={[styles.tabText, tab === 'guide' && styles.tabTextActive]}
          >
            앱 사용 가이드
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {listData.map((text, idx) => (
          <TouchableOpacity key={idx} style={styles.item} onPress={() => {}}>
            <Text style={styles.itemText}>{text}</Text>
            <Icon name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.footerButton, { marginBottom: insets.bottom + 8 }]}
        onPress={() => navigation.navigate('Inquiry')}
      >
        <Text style={styles.footerButtonText}>1:1 문의하기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    minHeight: 40,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deerIconLarge: {
    width: 50,
    height: 50,
    marginBottom: 3,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 24,
    height: 40,
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
