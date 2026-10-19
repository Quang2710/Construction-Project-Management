import { addMonths } from 'date-fns';
import { ProjectLocation, ProjectStatus } from '../../features/projects/models/project.model';
import { toIsoDate } from '../../shared/utils/date.utils';
import { ProjectRecord } from '../models/mock-records';

/** Mô tả một dự án mẫu; ngày tính tương đối so với hôm nay để dữ liệu luôn "đang diễn ra". */
export interface ProjectBlueprint {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly clientName: string;
  readonly location: ProjectLocation;
  /** Tháng bắt đầu so với hiện tại (âm = đã bắt đầu). */
  readonly startOffsetMonths: number;
  readonly durationMonths: number;
  readonly budget: number;
  readonly status: ProjectStatus;
  /** Hiệu suất thi công so với kế hoạch: < 1 là chậm, > 1 là vượt. */
  readonly performance: number;
  /** Hệ số chi phí so với khối lượng hoàn thành: > 1 là đội chi phí. */
  readonly costFactor: number;
  /** Có gán quản lý dự án demo (pm@cpm.vn) không. */
  readonly demoManager: boolean;
  /** Có gán kỹ sư demo (kysu@cpm.vn) không. */
  readonly demoEngineer: boolean;
  /** Số tầng (dùng cho tên công việc), 0 với công trình không phải nhà cao tầng. */
  readonly floors: number;
}

const BILLION = 1_000_000_000;

export const PROJECT_BLUEPRINTS: readonly ProjectBlueprint[] = [
  {
    id: 'prj-gthm',
    code: 'HN-GTHM',
    name: 'Chung cư Green Tower Hoàng Mai',
    description: 'Tổ hợp chung cư cao 25 tầng, 2 tầng hầm, 620 căn hộ và khu thương mại tầng đế.',
    clientName: 'Công ty CP Đầu tư Xanh Việt',
    location: { address: 'Số 88 Tam Trinh, phường Hoàng Mai', province: 'TP. Hà Nội', lat: 20.9846, lng: 105.8649 },
    startOffsetMonths: -14,
    durationMonths: 24,
    budget: 450 * BILLION,
    status: 'IN_PROGRESS',
    performance: 1,
    costFactor: 1,
    demoManager: true,
    demoEngineer: true,
    floors: 25,
  },
  {
    id: 'prj-cvmd',
    code: 'HN-CVMD',
    name: 'Cầu vượt nút giao Mai Dịch',
    description: 'Cầu vượt thép 2 làn xe dài 480 m kết nối Vành đai 3 và đường Hồ Tùng Mậu.',
    clientName: 'Ban QLDA Đầu tư xây dựng công trình giao thông Hà Nội',
    location: { address: 'Nút giao Mai Dịch, phường Cầu Giấy', province: 'TP. Hà Nội', lat: 21.0388, lng: 105.7766 },
    startOffsetMonths: -10,
    durationMonths: 18,
    budget: 320 * BILLION,
    status: 'IN_PROGRESS',
    performance: 0.7,
    costFactor: 1.15,
    demoManager: true,
    demoEngineer: true,
    floors: 0,
  },
  {
    id: 'prj-nmqv',
    code: 'BN-NMQV',
    name: 'Nhà máy may Phương Đông Quế Võ',
    description: 'Nhà xưởng kết cấu thép 24.000 m², nhà văn phòng 3 tầng và hệ thống xử lý nước thải.',
    clientName: 'Công ty TNHH May mặc Phương Đông',
    location: { address: 'KCN Quế Võ, phường Quế Võ', province: 'Bắc Ninh', lat: 21.1517, lng: 106.1702 },
    startOffsetMonths: -6,
    durationMonths: 12,
    budget: 180 * BILLION,
    status: 'IN_PROGRESS',
    performance: 0.95,
    costFactor: 1.3,
    demoManager: false,
    demoEngineer: false,
    floors: 3,
  },
  {
    id: 'prj-thhx',
    code: 'DN-THHX',
    name: 'Trường THCS Hòa Xuân',
    description: 'Trường học 4 tầng, 36 phòng học, nhà đa năng và sân thể thao.',
    clientName: 'Ban QLDA Đầu tư xây dựng các công trình dân dụng Đà Nẵng',
    location: { address: 'Đường Nguyễn Phước Lan, phường Hòa Xuân', province: 'TP. Đà Nẵng', lat: 15.9985, lng: 108.2206 },
    startOffsetMonths: -16,
    durationMonths: 14,
    budget: 65 * BILLION,
    status: 'COMPLETED',
    performance: 1,
    costFactor: 0.97,
    demoManager: false,
    demoEngineer: false,
    floors: 4,
  },
  {
    id: 'prj-sgg',
    code: 'HCM-SGG',
    name: 'Tòa văn phòng Saigon Gateway',
    description: 'Cao ốc văn phòng hạng A cao 38 tầng, 4 tầng hầm, đạt chứng chỉ LEED Gold.',
    clientName: 'Tập đoàn Saigon Land',
    location: { address: '45 Tôn Đức Thắng, phường Sài Gòn', province: 'TP. Hồ Chí Minh', lat: 10.7795, lng: 106.7058 },
    startOffsetMonths: -20,
    durationMonths: 36,
    budget: 1_200 * BILLION,
    status: 'IN_PROGRESS',
    performance: 0.8,
    costFactor: 1.02,
    demoManager: true,
    demoEngineer: true,
    floors: 38,
  },
  {
    id: 'prj-bvct',
    code: 'CT-BVDK',
    name: 'Bệnh viện Đa khoa Cần Thơ (mở rộng)',
    description: 'Khối điều trị nội trú 12 tầng, 500 giường bệnh và trung tâm kỹ thuật cao.',
    clientName: 'Sở Y tế TP. Cần Thơ',
    location: { address: '4 Châu Văn Liêm, phường Ninh Kiều', province: 'TP. Cần Thơ', lat: 10.0339, lng: 105.7863 },
    startOffsetMonths: 2,
    durationMonths: 30,
    budget: 540 * BILLION,
    status: 'PLANNING',
    performance: 1,
    costFactor: 1,
    demoManager: true,
    demoEngineer: false,
    floors: 12,
  },
  {
    id: 'prj-ksbx',
    code: 'KH-KSBX',
    name: 'Khách sạn Biển Xanh Nha Trang',
    description: 'Khách sạn 5 sao 30 tầng, 350 phòng, hồ bơi vô cực và trung tâm hội nghị.',
    clientName: 'Công ty CP Du lịch Biển Xanh',
    location: { address: '72 Trần Phú, phường Nha Trang', province: 'Khánh Hòa', lat: 12.2431, lng: 109.1966 },
    startOffsetMonths: -8,
    durationMonths: 20,
    budget: 380 * BILLION,
    status: 'ON_HOLD',
    performance: 0.6,
    costFactor: 1.05,
    demoManager: false,
    demoEngineer: false,
    floors: 30,
  },
  {
    id: 'prj-lgdv',
    code: 'HP-LGDV',
    name: 'Trung tâm logistics Đình Vũ',
    description: 'Kho lạnh và kho ngoại quan 45.000 m², bãi container và đường nội bộ.',
    clientName: 'Công ty CP Logistics Cảng Hải Phòng',
    location: { address: 'KCN Đình Vũ, phường Đông Hải', province: 'TP. Hải Phòng', lat: 20.8414, lng: 106.7612 },
    startOffsetMonths: -4,
    durationMonths: 15,
    budget: 210 * BILLION,
    status: 'IN_PROGRESS',
    performance: 1.05,
    costFactor: 0.95,
    demoManager: true,
    demoEngineer: false,
    floors: 0,
  },
];

export function createProjectRecord(
  blueprint: ProjectBlueprint,
  today: Date,
  managerId: string | null,
  memberIds: readonly string[],
): ProjectRecord {
  const start = addMonths(today, blueprint.startOffsetMonths);
  const end = addMonths(start, blueprint.durationMonths);
  const createdAt = addMonths(start, -2).toISOString();
  return {
    id: blueprint.id,
    code: blueprint.code,
    name: blueprint.name,
    description: blueprint.description,
    clientName: blueprint.clientName,
    location: blueprint.location,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    budget: blueprint.budget,
    // Chi phí được tính lại sau khi sinh công việc (xem seed.ts).
    actualCost: 0,
    status: blueprint.status,
    managerId,
    memberIds,
    createdAt,
    updatedAt: createdAt,
  };
}
