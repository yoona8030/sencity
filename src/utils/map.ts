import type { Region } from 'react-native-maps';
import type { ReportPoint } from '../types/report';

// 동/구 단위 여부(줌아웃) – 체감 기준값
export const isNeighborhoodView = (r: Region) => r.latitudeDelta >= 0.02;

// 색상: 그룹/동물에 맞게 커스텀
export const pickColor = (p: ReportPoint) => {
  // 예시: animalId로 분기
  if (p.animalId === 15 || p.animalId === 13) return '#F97316'; // 고라니/노루
  if (p.animalId === 30 || p.animalId === 14) return '#22C55E'; // 청설모/다람쥐
  return '#DD0000'; // 기타
};

// 반경 동적 스케일(선택)
export const radiusByZoom = (latitudeDelta: number) => {
  const r = (0.04 / Math.max(latitudeDelta, 0.005)) * 40;
  return Math.max(40, Math.min(90, r)); // 40~90m
};
