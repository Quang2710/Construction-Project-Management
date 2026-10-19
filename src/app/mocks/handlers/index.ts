import { authHandlers } from './auth.handlers';
import { costHandlers } from './cost.handlers';
import { dashboardHandlers } from './dashboard.handlers';
import { demoHandlers } from './demo.handlers';
import { filesHandlers } from './files.handlers';
import { materialsHandlers } from './materials.handlers';
import { projectsHandlers } from './projects.handlers';
import { siteDiariesHandlers } from './site-diaries.handlers';
import { tasksHandlers } from './tasks.handlers';
import { usersHandlers } from './users.handlers';
import { wbsHandlers } from './wbs.handlers';

export const handlers = [
  ...authHandlers,
  ...usersHandlers,
  ...projectsHandlers,
  ...wbsHandlers,
  ...tasksHandlers,
  ...siteDiariesHandlers,
  ...materialsHandlers,
  ...costHandlers,
  ...filesHandlers,
  ...dashboardHandlers,
  ...demoHandlers,
];
