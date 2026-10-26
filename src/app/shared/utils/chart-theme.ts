import { ThemeMode } from '../../core/theme/theme.service';

export interface ChartTheme {
  /** Series 1 (kế hoạch / ngân sách) và series 2 (thực tế / đã chi). */
  readonly series1: string;
  readonly series2: string;
  readonly series2Wash: string;
  readonly surface: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly grid: string;
  readonly axis: string;
}

/**
 * Bảng màu biểu đồ (đã kiểm tra CVD/tương phản cho cả nền sáng và tối của theme).
 * Màu chữ dùng token chữ, không dùng màu series.
 */
const THEMES: Readonly<Record<ThemeMode, ChartTheme>> = {
  light: {
    series1: '#2a78d6',
    series2: '#eb6834',
    series2Wash: 'rgba(235, 104, 52, 0.1)',
    surface: '#fff8f6',
    textSecondary: '#52514e',
    textMuted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
  },
  dark: {
    series1: '#3987e5',
    series2: '#d95926',
    series2Wash: 'rgba(217, 89, 38, 0.12)',
    surface: '#1a110f',
    textSecondary: '#c3c2b7',
    textMuted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
  },
};

export function chartTheme(mode: ThemeMode): ChartTheme {
  return THEMES[mode];
}
