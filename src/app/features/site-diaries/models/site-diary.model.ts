import { ListParams } from '../../../shared/models/api.model';
import { UserSummary } from '../../../shared/models/user.model';

export const DIARY_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;
export type DiaryStatus = (typeof DIARY_STATUSES)[number];

export const DIARY_STATUS_LABELS: Readonly<Record<DiaryStatus, string>> = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị trả lại',
};

/** Chỉ sửa được khi còn nháp hoặc bị trả lại. */
export const EDITABLE_DIARY_STATUSES: readonly DiaryStatus[] = ['DRAFT', 'REJECTED'];

export const WEATHER_CONDITIONS = ['SUNNY', 'CLOUDY', 'LIGHT_RAIN', 'HEAVY_RAIN', 'STORM'] as const;
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export const WEATHER_LABELS: Readonly<Record<WeatherCondition, string>> = {
  SUNNY: 'Nắng',
  CLOUDY: 'Nhiều mây',
  LIGHT_RAIN: 'Mưa nhỏ',
  HEAVY_RAIN: 'Mưa to',
  STORM: 'Mưa giông',
};

export const WEATHER_ICONS: Readonly<Record<WeatherCondition, string>> = {
  SUNNY: 'sunny',
  CLOUDY: 'cloud',
  LIGHT_RAIN: 'rainy_light',
  HEAVY_RAIN: 'rainy_heavy',
  STORM: 'thunderstorm',
};

export const INCIDENT_TYPES = ['SAFETY', 'QUALITY', 'EQUIPMENT', 'ENVIRONMENT', 'OTHER'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_TYPE_LABELS: Readonly<Record<IncidentType, string>> = {
  SAFETY: 'An toàn lao động',
  QUALITY: 'Chất lượng',
  EQUIPMENT: 'Máy móc, thiết bị',
  ENVIRONMENT: 'Môi trường, thời tiết',
  OTHER: 'Khác',
};

export const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_SEVERITY_LABELS: Readonly<Record<IncidentSeverity, string>> = {
  LOW: 'Nhẹ',
  MEDIUM: 'Trung bình',
  HIGH: 'Nghiêm trọng',
};

/** Gợi ý nhập liệu nhanh tại công trường. */
export const CREW_SUGGESTIONS: readonly string[] = [
  'Tổ cốp pha',
  'Tổ cốt thép',
  'Tổ bê tông',
  'Tổ nề',
  'Tổ điện',
  'Tổ cấp thoát nước',
  'Tổ hoàn thiện',
  'Tổ cơ giới',
  'Tổ an toàn',
];

export const EQUIPMENT_SUGGESTIONS: readonly string[] = [
  'Cần trục tháp',
  'Vận thăng',
  'Máy đào',
  'Xe bơm bê tông',
  'Xe trộn bê tông',
  'Máy đầm dùi',
  'Máy phát điện',
  'Máy hàn',
  'Lu rung',
];

export const UNIT_SUGGESTIONS: readonly string[] = ['m³', 'm²', 'm', 'tấn', 'kg', 'cái', 'bộ', 'cọc', 'điểm'];

export interface DiaryWeather {
  readonly morning: WeatherCondition;
  readonly afternoon: WeatherCondition;
  /** °C */
  readonly minTemp: number | null;
  readonly maxTemp: number | null;
}

export interface LaborEntry {
  /** Tổ đội, ví dụ "Tổ cốt thép". */
  readonly crew: string;
  readonly headcount: number;
}

export interface EquipmentEntry {
  readonly name: string;
  readonly quantity: number;
  /** Số giờ hoạt động trong ngày. */
  readonly hours: number | null;
}

export interface WorkItemEntry {
  readonly description: string;
  readonly unit: string;
  readonly quantity: number;
}

export interface IncidentEntry {
  readonly type: IncidentType;
  readonly severity: IncidentSeverity;
  readonly description: string;
  readonly actionTaken: string;
}

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
  /** Sai số (m) do Geolocation API trả về. */
  readonly accuracy: number | null;
}

export interface DiaryPhoto {
  readonly id: string;
  /** URL tải ảnh (fake BE phục vụ từ IndexedDB). */
  readonly url: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly caption: string;
  readonly takenAt: string;
  readonly location: GeoPoint | null;
}

export type DiaryAction = 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export const DIARY_ACTION_LABELS: Readonly<Record<DiaryAction, string>> = {
  CREATED: 'Tạo nhật ký',
  UPDATED: 'Cập nhật',
  SUBMITTED: 'Gửi duyệt',
  APPROVED: 'Phê duyệt',
  REJECTED: 'Trả lại',
};

export interface DiaryHistoryEntry {
  readonly action: DiaryAction;
  readonly by: UserSummary;
  readonly at: string;
  readonly note: string;
}

export interface DiaryProjectRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

export interface SiteDiary {
  readonly id: string;
  readonly projectId: string;
  readonly project: DiaryProjectRef;
  /** yyyy-MM-dd */
  readonly date: string;
  readonly weather: DiaryWeather;
  readonly labor: readonly LaborEntry[];
  readonly equipment: readonly EquipmentEntry[];
  readonly workItems: readonly WorkItemEntry[];
  readonly incidents: readonly IncidentEntry[];
  readonly notes: string;
  readonly photos: readonly DiaryPhoto[];
  readonly status: DiaryStatus;
  readonly totalWorkers: number;
  readonly createdBy: UserSummary;
  readonly reviewNote: string;
  readonly history: readonly DiaryHistoryEntry[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Nội dung nhật ký (tạo/sửa). */
export interface DiaryContent {
  readonly weather: DiaryWeather;
  readonly labor: readonly LaborEntry[];
  readonly equipment: readonly EquipmentEntry[];
  readonly workItems: readonly WorkItemEntry[];
  readonly incidents: readonly IncidentEntry[];
  readonly notes: string;
  readonly photos: readonly DiaryPhoto[];
}

export interface DiaryCreateRequest extends DiaryContent {
  readonly projectId: string;
  readonly date: string;
}

export interface DiaryListParams extends ListParams {
  readonly projectId?: string | null;
  readonly status?: DiaryStatus | null;
  /** yyyy-MM-dd, bao gồm. */
  readonly from?: string | null;
  readonly to?: string | null;
}
