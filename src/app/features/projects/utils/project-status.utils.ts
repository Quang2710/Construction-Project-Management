import { ProjectStatus } from '../models/project.model';

/** Màu ghim bản đồ theo trạng thái (đủ tương phản trên nền tile sáng và tối). */
export const PROJECT_STATUS_COLORS: Readonly<Record<ProjectStatus, string>> = {
  PLANNING: '#7c3aed',
  IN_PROGRESS: '#ea580c',
  ON_HOLD: '#ca8a04',
  COMPLETED: '#16a34a',
  CANCELLED: '#64748b',
};
