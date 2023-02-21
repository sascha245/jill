import { ParallelGroup, SpawnTask, type TaskManager } from '@jujulego/tasks';
import { cleanup, render } from 'ink-testing-library';
import symbols from 'log-symbols';
import yargs, { type CommandModule } from 'yargs';

import { GroupCommand } from '@/src/commands/group';
import { INK_APP } from '@/src/ink.config';
import { container } from '@/src/inversify.config';
import { type Workspace } from '@/src/project/workspace';
import { TaskExprService } from '@/src/tasks/task-expr.service';
import { TASK_MANAGER } from '@/src/tasks/task-manager.config';
import Layout from '@/src/ui/layout';

import { TestBed } from '@/tools/test-bed';
import { flushPromises, spyLogger, wrapInkTestApp } from '@/tools/utils';

// Setup
let app: ReturnType<typeof render>;
let command: CommandModule;
let manager: TaskManager;
let taskExpr: TaskExprService;

let bed: TestBed;
let wks: Workspace;
let task: ParallelGroup;

beforeEach(async () => {
  container.snapshot();

  bed = new TestBed();
  wks = bed.addWorkspace('wks');

  task = new ParallelGroup('Test group', {}, { logger: spyLogger });
  task.add(new SpawnTask('test1', [], { workspace: wks, script: 'test1' }, { logger: spyLogger }));
  task.add(new SpawnTask('test2', [], { workspace: wks, script: 'test2' }, { logger: spyLogger }));

  app = render(<Layout />);
  container.rebind(INK_APP).toConstantValue(wrapInkTestApp(app));

  command = await bed.prepareCommand(GroupCommand, wks);
  manager = container.get(TASK_MANAGER);
  taskExpr = container.get(TaskExprService);

  // Mocks
  jest.resetAllMocks();
  jest.restoreAllMocks();

  jest.spyOn(taskExpr, 'buildTask').mockResolvedValue(task);

  jest.spyOn(manager, 'add').mockImplementation();
  jest.spyOn(manager, 'tasks', 'get').mockReturnValue([task]);
});

afterEach(() => {
  container.restore();
  cleanup();
});

// Tests
describe('jill group', () => {
  it('should run all tasks in current workspace', async () => {
    // Run command
    const prom = yargs.command(command)
      .parse('group -w wks test1 // test2');

    await flushPromises();

    expect(taskExpr.buildTask).toHaveBeenCalledWith(
      {
        operator: '//',
        tasks: [
          { script: 'test1' },
          { script: 'test2' }
        ]
      },
      wks,
      { buildDeps: 'all' }
    );

    // Complete tasks
    jest.spyOn(task, 'status', 'get').mockReturnValue('done');

    for (const child of task.tasks) {
      jest.spyOn(child, 'status', 'get').mockReturnValue('done');

      child.emit('status.done', { status: 'done', previous: 'running' });
      child.emit('completed', { status: 'done', duration: 100 });
    }

    task.emit('status.done', { status: 'done', previous: 'running' });
    task.emit('completed', { status: 'done', duration: 100 });

    await prom;

    // Should print all tasks
    expect(app.lastFrame()).toEqualLines([
      expect.ignoreColor(`${symbols.success} Test group (took 100ms)`),
      expect.ignoreColor(`  ${symbols.success} Running test1 in wks (took 100ms)`),
      expect.ignoreColor(`  ${symbols.success} Running test2 in wks (took 100ms)`),
    ]);
  });

  it('should use given dependency mode', async () => {
    // Run command
    const prom = yargs.command(command)
      .parse('group -w wks --deps-mode prod test1 // test2');

    await flushPromises();

    expect(taskExpr.buildTask).toHaveBeenCalledWith(
      {
        operator: '//',
        tasks: [
          { script: 'test1' },
          { script: 'test2' }
        ]
      },
      wks,
      { buildDeps: 'prod' }
    );

    // Complete tasks
    jest.spyOn(task, 'status', 'get').mockReturnValue('done');

    for (const child of task.tasks) {
      jest.spyOn(child, 'status', 'get').mockReturnValue('done');

      child.emit('status.done', { status: 'done', previous: 'running' });
      child.emit('completed', { status: 'done', duration: 100 });
    }

    task.emit('status.done', { status: 'done', previous: 'running' });
    task.emit('completed', { status: 'done', duration: 100 });

    await prom;
  });
});
