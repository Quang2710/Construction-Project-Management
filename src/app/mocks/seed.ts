import { faker } from '@faker-js/faker/locale/vi';
import { DEMO_ACCOUNTS } from '../core/config/demo-accounts';
import { UserRole } from '../shared/models/user.model';
import { createProjectRecord, PROJECT_BLUEPRINTS } from './factories/project.factory';
import { createCostSeed } from './factories/cost.factory';
import { createMaterialSeed, MATERIAL_CATALOG } from './factories/material.factory';
import { createQualitySeed } from './factories/quality.factory';
import { createProjectDiaries } from './factories/site-diary.factory';
import { assignKanbanOrder, createProjectTasks, createTaskComments } from './factories/task.factory';
import { createUser } from './factories/user.factory';
import { DbSchema, ProjectRecord, TaskRecord, UserRecord, WbsRecord } from './models/mock-records';
import { actualProgress } from './utils/project-metrics';

/** Seed cố định để mỗi lần reset đều ra cùng bộ dữ liệu demo. */
const SEED = 20_241_018;
const EXTRA_USER_COUNT = 24;
/** Phân bổ role cho user sinh thêm: nhiều kỹ sư hơn quản lý và chủ đầu tư. */
const EXTRA_ROLE_CYCLE: readonly UserRole[] = ['SITE_ENGINEER', 'SITE_ENGINEER', 'PROJECT_MANAGER', 'CLIENT'];
const DEMO_PM_ID = 'usr-pm';
const DEMO_ENGINEER_ID = 'usr-engineer';

function createDemoUsers(): UserRecord[] {
  return DEMO_ACCOUNTS.map((account) => ({
    ...account,
    active: true,
    createdAt: '2024-01-15T08:00:00.000Z',
  }));
}

function roundToMillion(value: number): number {
  return Math.round(value / 1_000_000) * 1_000_000;
}

export function createSeedData(today: Date = new Date()): DbSchema {
  faker.seed(SEED);
  const extraUsers = Array.from({ length: EXTRA_USER_COUNT }, (_, index) =>
    createUser(index + 1, { role: EXTRA_ROLE_CYCLE[index % EXTRA_ROLE_CYCLE.length] }),
  );
  const users = [...createDemoUsers(), ...extraUsers];
  const activeUsers = extraUsers.filter((user) => user.active);
  const managers = activeUsers.filter((user) => user.role === 'PROJECT_MANAGER').map((user) => user.id);
  const engineers = activeUsers.filter((user) => user.role === 'SITE_ENGINEER').map((user) => user.id);

  const projects: ProjectRecord[] = [];
  const wbs: WbsRecord[] = [];
  let tasks: TaskRecord[] = [];

  for (const blueprint of PROJECT_BLUEPRINTS) {
    const managerId = blueprint.demoManager ? DEMO_PM_ID : faker.helpers.arrayElement(managers);
    const memberIds = [
      ...(blueprint.demoEngineer ? [DEMO_ENGINEER_ID] : []),
      ...faker.helpers.arrayElements(engineers, { min: 2, max: 3 }),
    ];
    const record = createProjectRecord(blueprint, today, managerId, memberIds);
    const { tasks: projectTasks, wbs: projectWbs } = createProjectTasks(record, blueprint, [managerId, ...memberIds], today);
    wbs.push(...projectWbs);
    const progress = actualProgress(projectTasks);
    const actualCost =
      record.status === 'COMPLETED'
        ? roundToMillion(record.budget * blueprint.costFactor)
        : roundToMillion((record.budget * progress * blueprint.costFactor) / 100);

    projects.push({ ...record, actualCost });
    tasks = [...tasks, ...projectTasks];
  }

  tasks = assignKanbanOrder(tasks);
  const taskComments = tasks.flatMap((task) => {
    const project = projects.find((item) => item.id === task.projectId);
    const authors = project ? [project.managerId, ...project.memberIds].filter((id): id is string => id !== null) : [];
    return createTaskComments(task, authors, today);
  });

  const siteDiaries = projects.flatMap((project) => {
    const floors = PROJECT_BLUEPRINTS.find((blueprint) => blueprint.id === project.id)?.floors ?? 0;
    return createProjectDiaries(project, floors, today);
  });

  const materialSeed = createMaterialSeed(projects, today);
  const { budgets, ...costSeed } = createCostSeed(projects, wbs, tasks, today);
  // Phát sinh đã chấp thuận làm tăng ngân sách dự án.
  const finalProjects = projects.map((project) => ({ ...project, budget: budgets.get(project.id) ?? project.budget }));
  // Sinh sau cùng để không làm đổi chuỗi ngẫu nhiên của các seed phía trên.
  const floorsOf = (projectId: string): number => PROJECT_BLUEPRINTS.find((blueprint) => blueprint.id === projectId)?.floors ?? 0;
  const qualitySeed = createQualitySeed(finalProjects, wbs, floorsOf, today);

  return {
    users,
    projects: finalProjects,
    wbs,
    tasks,
    taskComments,
    siteDiaries,
    materials: [...MATERIAL_CATALOG],
    ...materialSeed,
    ...costSeed,
    ...qualitySeed,
  };
}
