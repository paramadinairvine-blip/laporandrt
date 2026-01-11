export const LOCATIONS = [
  { value: 'asrama_kampus_1', label: 'Asrama Kampus 1' },
  { value: 'asrama_kampus_2', label: 'Asrama Kampus 2' },
  { value: 'asrama_kampus_3', label: 'Asrama Kampus 3' },
] as const;

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Belum Ditangani', color: 'bg-warning' },
  { value: 'in_progress', label: 'Sedang Diproses', color: 'bg-accent' },
  { value: 'completed', label: 'Selesai', color: 'bg-success' },
] as const;

export type LocationType = typeof LOCATIONS[number]['value'];
export type StatusType = typeof STATUS_OPTIONS[number]['value'];