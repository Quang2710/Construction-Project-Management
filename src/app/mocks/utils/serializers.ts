import { Project } from '../../features/projects/models/project.model';
import { Task, TaskComment } from '../../features/tasks/models/task.model';
import { UserSummary } from '../../shared/models/user.model';
import { toIsoDate } from '../../shared/utils/date.utils';
import { db } from '../db';
import { SiteDiary } from '../../features/site-diaries/models/site-diary.model';
import { ProjectRecord, SiteDiaryRecord, TaskCommentRecord, TaskRecord, UserRecord } from '../models/mock-records';
import {
  actualProgress,
  isProjectDelayed,
  isProjectOverBudget,
  plannedProgressAt,
  taskStats,
} from './project-metrics';

export function toUserSummary(user: UserRecord): UserSummary {
  return { id: user.id, fullName: user.fullName, jobTitle: user.jobTitle, role: user.role };
}

function findUserSummary(id: string | null): UserSummary | null {
  const user = id ? db.users.findById(id) : undefined;
  return user ? toUserSummary(user) : null;
}

/** ADMIN, PM, CLIENT xem mọi dự án; SITE_ENGINEER chỉ xem dự án được gán. */
export function canViewProject(user: UserRecord, project: ProjectRecord): boolean {
  if (user.role !== 'SITE_ENGINEER') {
    return true;
  }
  return project.managerId === user.id || project.memberIds.includes(user.id);
}

export function visibleProjects(user: UserRecord): ProjectRecord[] {
  return db.projects.filter((project) => canViewProject(user, project));
}

export function toProjectDto(record: ProjectRecord, tasks: readonly TaskRecord[], now: Date = new Date()): Project {
  const today = toIsoDate(now);
  const progress = actualProgress(tasks);
  const plannedProgress = record.status === 'COMPLETED' ? 100 : plannedProgressAt(record, now);
  return {
    ...record,
    manager: findUserSummary(record.managerId),
    progress,
    plannedProgress,
    isDelayed: isProjectDelayed(record, progress, plannedProgress, today),
    isOverBudget: isProjectOverBudget(record, progress),
    taskStats: taskStats(tasks, today),
  };
}

/** Gom task theo dự án một lần, tránh lọc lại cho từng dự án. */
export function groupTasksByProject(tasks: readonly TaskRecord[]): Map<string, TaskRecord[]> {
  const groups = new Map<string, TaskRecord[]>();
  for (const task of tasks) {
    groups.set(task.projectId, [...(groups.get(task.projectId) ?? []), task]);
  }
  return groups;
}

export function toTaskDto(record: TaskRecord): Task {
  const project = db.projects.findById(record.projectId);
  return {
    ...record,
    project: project
      ? { id: project.id, code: project.code, name: project.name }
      : { id: record.projectId, code: '—', name: 'Dự án đã xoá' },
    assignee: findUserSummary(record.assigneeId),
    commentCount: db.taskComments.filter((comment) => comment.taskId === record.id).length,
  };
}

export function toCommentDto(record: TaskCommentRecord): TaskComment {
  return {
    id: record.id,
    taskId: record.taskId,
    author: findUserSummary(record.authorId) ?? {
      id: record.authorId,
      fullName: 'Người dùng đã xoá',
      jobTitle: '',
      role: 'CLIENT',
    },
    content: record.content,
    createdAt: record.createdAt,
  };
}

const UNKNOWN_USER: UserSummary = { id: '', fullName: 'Người dùng đã xoá', jobTitle: '', role: 'CLIENT' };

export function toDiaryDto(record: SiteDiaryRecord): SiteDiary {
  const project = db.projects.findById(record.projectId);
  const { createdById, history, ...rest } = record;
  return {
    ...rest,
    project: project
      ? { id: project.id, code: project.code, name: project.name, lat: project.location.lat, lng: project.location.lng }
      : { id: record.projectId, code: '—', name: 'Dự án đã xoá', lat: 0, lng: 0 },
    createdBy: findUserSummary(createdById) ?? UNKNOWN_USER,
    totalWorkers: record.labor.reduce((sum, entry) => sum + entry.headcount, 0),
    history: history.map((entry) => ({
      action: entry.action,
      by: findUserSummary(entry.byId) ?? UNKNOWN_USER,
      at: entry.at,
      note: entry.note,
    })),
  };
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
