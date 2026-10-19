import { Provider } from '@angular/core';
import {
  GANTT_GLOBAL_CONFIG,
  GANTT_I18N_LOCALE_TOKEN,
  GanttConfigService,
  GanttGlobalConfig,
  GanttI18nLocaleConfig,
  GanttLinkLineType,
  GanttLinkType,
  GanttViewType,
} from '@worktile/gantt';
import { vi } from 'date-fns/locale';

const VI_LOCALE_ID = 'vi-vn';

const viLocale: GanttI18nLocaleConfig = {
  id: VI_LOCALE_ID,
  dateLocale: vi,
  views: {
    [GanttViewType.hour]: { label: 'Giờ', tickFormats: { period: 'dd/MM', unit: 'HH:mm' } },
    [GanttViewType.day]: { label: 'Ngày', tickFormats: { period: "'Tháng' M/yyyy", unit: 'd' } },
    [GanttViewType.week]: { label: 'Tuần', tickFormats: { period: 'yyyy', unit: "'Tuần' w" } },
    [GanttViewType.month]: { label: 'Tháng', tickFormats: { period: "'Quý' Q/yyyy", unit: "'Th' M" } },
    [GanttViewType.quarter]: { label: 'Quý', tickFormats: { period: 'yyyy', unit: "'Quý' Q/yyyy" } },
    [GanttViewType.year]: { label: 'Năm', tickFormats: { unit: 'yyyy' } },
  },
};

const ganttConfig: GanttGlobalConfig = {
  locale: VI_LOCALE_ID,
  dateOptions: { weekStartsOn: 1 },
  linkOptions: { dependencyTypes: [GanttLinkType.fs], showArrow: true, lineType: GanttLinkLineType.curve },
  styleOptions: {
    primaryColor: '#2a78d6',
    rowHeight: 40,
    barHeight: 20,
    themes: {
      default: {
        primary: '#2a78d6',
        danger: '#d03b3b',
        highlight: '#eb6834',
        background: '#ffffff',
        text: { main: '#1c1b1f', muted: '#52514e', light: '#898781', inverse: '#ffffff' },
        gray: { 100: '#fafafa', 200: '#f5f5f4', 300: '#efeeec', 400: '#e7e5e4', 500: '#d6d3d1', 600: '#a8a29e' },
      },
      dark: {
        primary: '#3987e5',
        danger: '#e66767',
        highlight: '#d95926',
        background: '#1a1a19',
        text: { main: '#f0efec', muted: '#c3c2b7', light: '#898781', inverse: '#ffffff' },
        gray: { 100: '#222220', 200: '#262624', 300: '#2c2c2a', 400: '#33332f', 500: '#3d3d39', 600: '#55554f' },
      },
    },
  },
};

/**
 * GanttConfigService mặc định providedIn: 'root' nên chỉ đọc token ở root. Cung cấp lại service
 * cùng cấu hình ở route lazy để thư viện gantt không bị kéo vào bundle khởi động.
 */
export function provideGanttConfig(): Provider[] {
  return [
    GanttConfigService,
    { provide: GANTT_GLOBAL_CONFIG, useValue: ganttConfig },
    { provide: GANTT_I18N_LOCALE_TOKEN, useValue: viLocale, multi: true },
  ];
}
