import { TaskManager } from '@jujulego/tasks';
import { type interfaces as int } from 'inversify';

import { Logger } from '@/src/commons/logger.service';
import { CONFIG } from '@/src/config/config-loader';
import { container } from '@/src/inversify.config';

// Symbols
export const TASK_MANAGER: int.ServiceIdentifier<TaskManager> = Symbol('jujulego:jill:TaskManager');

// Service
container.bind(TASK_MANAGER)
  .toDynamicValue(({ container }) => {
    const config = container.get(CONFIG);
    const logger = container.get(Logger);

    return new TaskManager({ jobs: config.jobs, logger });
  })
  .inSingletonScope();