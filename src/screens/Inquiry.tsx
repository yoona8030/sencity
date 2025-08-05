import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { CheckBox } from 'react-native-elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Inquiry'>;

interface HistoryItem {
  id: string;
  title: string;
  summary: string;
  date: string;
  status: '처리중' | '답변완료';
}

const historyData: HistoryItem[] = [
  {
    id: '1',
    title: '앱 오류 문의',
    summary: '로그인 시 튕김 문제',
    date: '2025.05.27',
    status: '처리중',
  },
  {
    id: '2',
    title: '신고 내역 삭제 요청',
    summary: '오래된 신고 삭제 요청',
    date: '2025.05.12',
    status: '처리중',
  },
  {
    id: '3',
    title: '신고 사진 업로드 문제',
    summary: '사진 선택 후에도 계속 오류',
    date: '2025.04.05',
    status: '처리중',
  },
  {
    id: '4',
    title: '신고 수정',
    summary: '장소를 잘못 눌러서 다른 지역 신고',
    date: '2025.03.30',
    status: '답변완료',
  },
];

export default function Inquiry({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'write' | 'history'>('write');

  // 문의하기 폼 상태
  const categories = ['일반 문의', '계정 문의', '기타 문의'];
  const [category, setCategory] = useState(categories[0]);
  const [openCategory, setOpenCategory] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [agree, setAgree] = useState(false);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container]}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
        />
        <Text style={styles.headerTitle}>문의하기</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'write' && styles.tabButtonActive]}
          onPress={() => setTab('write')}
        >
          <Text
            style={[styles.tabText, tab === 'write' && styles.tabTextActive]}
          >
            문의하기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            tab === 'history' && styles.tabButtonActive,
          ]}
          onPress={() => setTab('history')}
        >
          <Text
            style={[styles.tabText, tab === 'history' && styles.tabTextActive]}
          >
            문의내역 확인
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'write' ? (
        <View style={styles.contentContainer}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* 1) 문의 분류 (커스텀 드롭다운) */}
            <Text style={styles.label}>문의 분류</Text>
            <View style={{ marginTop: 4 }}>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setOpenCategory(v => !v)}
              >
                <Text style={styles.dropdownText}>{category}</Text>
                <Icon
                  name={openCategory ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#555"
                />
              </TouchableOpacity>
              {openCategory && (
                <View style={styles.dropdownList}>
                  {categories.map(item => (
                    <TouchableOpacity
                      key={item}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setCategory(item);
                        setOpenCategory(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.label}>문의 제목</Text>
            <TextInput
              style={styles.input}
              placeholder="제목을 입력해주세요"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>문의 내용</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="내용을 입력해주세요"
              value={content}
              onChangeText={setContent}
              multiline
            />

            {/* 4) 파일 첨부 */}
            <Text style={styles.label}>파일 첨부</Text>
            <TouchableOpacity style={styles.attachButton}>
              <Icon name="attach-outline" size={20} />
              <Text style={styles.attachText}>파일 첨부</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* ─── 폼 Footer (하단 고정) ─── */}
          <View style={[styles.footer]}>
            <View style={styles.checkboxContainer}>
              <CheckBox
                checked={agree}
                onPress={() => setAgree(v => !v)}
                checkedColor="#DD0000"
                uncheckedColor="#D2D2D2"
                containerStyle={{
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                  padding: 0,
                  margin: 0,
                }}
              />
              <Text style={styles.checkboxLabel}>개인정보 수집 및 이용</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                !agree && styles.submitButtonDisabled,
              ]}
              disabled={!agree}
              onPress={() => {
                /* 실제 전송 로직 */
              }}
            >
              <Text style={styles.submitText}>문의 접수</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // ─── 문의내역 확인 ───
        <FlatList
          data={historyData}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.historyList}
          renderItem={({ item }) => (
            <View style={styles.historyItem}>
              <View style={styles.historyText}>
                <Text style={styles.historyTitle}>[문의제목] {item.title}</Text>
                <Text style={styles.historySummary}>
                  [내용 요약] {item.summary}
                </Text>
                <Text style={styles.historyDate}>
                  [날짜] {item.date}{' '}
                  <Text style={styles.detailButton}>[자세히 보기]</Text>
                </Text>
              </View>
              <Text
                style={[
                  styles.historyStatus,
                  item.status === '답변완료' && styles.statusDone,
                ]}
              >
                {item.status}
              </Text>
            </View>
          )}
        />
      )}
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
    paddingVertical: 8,
  },
  logo: { width: 53, height: 49, resizeMode: 'contain' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomColor: '#000000',
  },
  tabText: { fontSize: 16, color: '#555' },
  tabTextActive: { color: '#000', fontWeight: 'bold' },

  contentContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  label: {
    marginTop: 12,
    fontSize: 14,
    color: '#333',
  },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 0,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  dropdownText: { fontSize: 14, color: '#000' },
  dropdownList: {
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: '#ccc',
    borderTopWidth: 0,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemText: { fontSize: 14, color: '#333' },

  input: {
    marginTop: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    height: 40,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 8,
  },

  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    height: 40,
  },
  attachText: { marginLeft: 8, fontSize: 14, color: '#000' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
  },

  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkBox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 4,
  },
  checkBoxChecked: {
    width: 20,
    height: 20,
    backgroundColor: '#E74C3C',
    borderRadius: 4,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },

  submitButton: {
    marginTop: 12,
    backgroundColor: '#FEBA15',
    borderRadius: 4,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#F0C470',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  historyList: { paddingVertical: 8 },
  historyItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyText: { flex: 1, paddingRight: 8 },
  historyTitle: { fontSize: 16, fontWeight: 'bold' },
  historySummary: { fontSize: 14, color: '#555', marginTop: 4 },
  historyDate: { fontSize: 12, color: '#888', marginTop: 4 },
  detailButton: { color: '#00000' },
  historyStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FEBA15',
    textAlign: 'right',
  },
  statusDone: { color: '#E74C3C' },
});
