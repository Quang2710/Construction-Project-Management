import { faker } from '@faker-js/faker/locale/vi';
import { UserRole } from '../../shared/models/user.model';
import { removeVietnameseTones } from '../../shared/utils/string.utils';
import { UserRecord } from '../models/mock-records';

const JOB_TITLES: Readonly<Record<UserRole, readonly string[]>> = {
  ADMIN: ['Quản trị hệ thống'],
  PROJECT_MANAGER: ['Giám đốc dự án', 'Phó giám đốc dự án', 'Quản lý dự án'],
  SITE_ENGINEER: [
    'Chỉ huy trưởng công trường',
    'Kỹ sư kết cấu',
    'Kỹ sư M&E',
    'Kỹ sư giám sát',
    'Kỹ sư QA/QC',
    'Kỹ sư dự toán',
  ],
  CLIENT: ['Đại diện chủ đầu tư', 'Ban quản lý dự án chủ đầu tư'],
};

function buildEmail(fullName: string, index: number): string {
  const parts = removeVietnameseTones(fullName).toLowerCase().split(/\s+/).filter(Boolean);
  const lastName = parts[parts.length - 1] ?? 'user';
  const initials = parts
    .slice(0, -1)
    .map((part) => part.charAt(0))
    .join('');
  return `${lastName}.${initials}${index}@cpm.vn`;
}

function buildPhone(): string {
  const prefix = faker.helpers.arrayElement(['090', '091', '093', '097', '098', '086', '088']);
  return `${prefix}${faker.string.numeric(1)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
}

export function createUser(index: number, overrides: Partial<UserRecord> = {}): UserRecord {
  const role = overrides.role ?? faker.helpers.arrayElement<UserRole>(['PROJECT_MANAGER', 'SITE_ENGINEER', 'CLIENT']);
  const fullName = overrides.fullName ?? faker.person.fullName();
  return {
    id: `usr-${faker.string.alphanumeric({ length: 8, casing: 'lower' })}`,
    email: buildEmail(fullName, index),
    password: 'Demo@123',
    fullName,
    role,
    jobTitle: faker.helpers.arrayElement(JOB_TITLES[role]),
    phone: buildPhone(),
    active: faker.datatype.boolean({ probability: 0.9 }),
    createdAt: faker.date.past({ years: 2 }).toISOString(),
    ...overrides,
  };
}
