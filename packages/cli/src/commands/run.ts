import { TaskManager } from '@jujulego/jill-core';

import { CommandHandler } from '../wrapper';
import { logger } from '../logger';
import { TaskLogger } from '../task-logger';

// Types
export interface RunArgs {
  workspace: string;
  script: string;
  '--'?: (string | number)[];
}

// Command
export const runCommand: CommandHandler<RunArgs> = async (prj, argv) => {
  // Get workspace
  logger.spin('Loading project');
  const wks = await prj.workspace(argv.workspace);

  if (!wks) {
    logger.fail(`Workspace ${argv.workspace} not found`);
    return 1;
  }

  // Run build task
  const manager = new TaskManager();
  const task = await wks.run(argv.script, argv['--']?.map(arg => arg.toString()));
  manager.add(task);

  const tlogger = new TaskLogger();
  tlogger.on('spin-simple', (tsk) => tsk === task ? `Running ${argv.script} in ${argv.workspace} ...` : `Building ${tsk.workspace?.name || tsk.cwd} ...`);
  tlogger.on('fail', (tsk) => tsk === task ? `${argv.script} failed` : `Failed to build ${tsk.workspace?.name || tsk.cwd}`);
  tlogger.on('succeed', (tsk) => tsk === task ? `${argv.workspace} ${argv.script} done` : `${tsk.workspace?.name || tsk.cwd} built`);
  tlogger.connect(manager);

  manager.start();
};
