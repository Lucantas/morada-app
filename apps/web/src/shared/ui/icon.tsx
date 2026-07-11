import type { CSSProperties } from 'react';

const PATHS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  residents:
    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13A4 4 0 0116 11',
  receipt: 'M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2zM8 8h8M8 12h8M8 16h5',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
  message: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4-4',
  userPlus: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M19 8v6M22 11h-6',
  plus: 'M5 12h14M12 5v14',
  chevronRight: 'M9 18l6-6-6-6',
  chevronLeft: 'M15 18l-6-6 6-6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
  water: 'M12 2s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z',
  bolt: 'M13 2L3 14h7l-1 8 10-12h-7z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  check: 'M20 6L9 17l-5-5',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  card: 'M2 5h20v14H2zM2 10h20',
  building: 'M3 21h18M6 21V6l6-3 6 3v15M10 9h.01M10 13h.01M14 9h.01M14 13h.01',
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a6 6 0 0116 0v1',
  wrench: 'M14 7a4 4 0 01-5 5l-6 6 2 2 6-6a4 4 0 005-5l-2 2-2-2 2-2z',
  building2: 'M12 20v-6M6 20v-4M18 20v-9M4 8l8-5 8 5',
  bank: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01',
} as const;

export type IconName = keyof typeof PATHS;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
};

export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
