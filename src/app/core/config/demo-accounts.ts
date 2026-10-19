import { UserRole } from '../../shared/models/user.model';

export interface DemoAccount {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly role: UserRole;
  readonly jobTitle: string;
  readonly phone: string;
}

/**
 * Tài khoản demo cho fake BE (mỗi role một tài khoản).
 * Chỉ hiển thị gợi ý trên trang đăng nhập khi environment.useMocks = true.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: 'usr-admin',
    email: 'admin@cpm.vn',
    password: 'Demo@123',
    fullName: 'Nguyễn Văn An',
    role: 'ADMIN',
    jobTitle: 'Quản trị hệ thống',
    phone: '0901 234 567',
  },
  {
    id: 'usr-pm',
    email: 'pm@cpm.vn',
    password: 'Demo@123',
    fullName: 'Trần Thị Bình',
    role: 'PROJECT_MANAGER',
    jobTitle: 'Giám đốc dự án',
    phone: '0912 345 678',
  },
  {
    id: 'usr-engineer',
    email: 'kysu@cpm.vn',
    password: 'Demo@123',
    fullName: 'Lê Hoàng Cường',
    role: 'SITE_ENGINEER',
    jobTitle: 'Chỉ huy trưởng công trường',
    phone: '0983 456 789',
  },
  {
    id: 'usr-client',
    email: 'chudautu@cpm.vn',
    password: 'Demo@123',
    fullName: 'Phạm Minh Dũng',
    role: 'CLIENT',
    jobTitle: 'Đại diện chủ đầu tư',
    phone: '0934 567 890',
  },
];
