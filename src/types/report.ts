export type ReportPoint = {
  id: number;
  animalId: number;
  animalName?: string | null;
  lat: number;
  lng: number;
  createdAt: string; // ISO
  status: 'checking' | 'accepted' | 'rejected' | 'confirmed';
};
