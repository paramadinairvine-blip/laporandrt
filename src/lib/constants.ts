export const LOCATIONS = [
  { value: 'asrama_kampus_1', label: 'Asrama Kampus 1' },
  { value: 'asrama_kampus_2', label: 'Asrama Kampus 2' },
  { value: 'asrama_kampus_3', label: 'Asrama Kampus 3' },
] as const;

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Belum Tertangani', color: 'bg-yellow-500' },
  { value: 'completed', label: 'Sudah Tertangani', color: 'bg-green-500' },
] as const;

export const DAMAGE_TYPES = [
  { value: 'rehab', label: 'Rehab' },
  { value: 'listrik', label: 'Listrik' },
  { value: 'air', label: 'Air' },
  { value: 'taman', label: 'Taman' },
  { value: 'lainnya', label: 'Lainnya' },
] as const;

export type LocationType = typeof LOCATIONS[number]['value'];
export type StatusType = typeof STATUS_OPTIONS[number]['value'];
export type DamageType = typeof DAMAGE_TYPES[number]['value'];