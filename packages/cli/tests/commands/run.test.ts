import { Project, TaskEvent, TaskEventListener, TaskManager, Workspace } from '@jujulego/jill-core';
import chalk from 'chalk';

import { logger, OraLogger } from '../../src/logger';
import { commandHandler } from '../../src/wrapper';

import { MockTask } from '../../mocks/task';
import { defaultOptions } from './defaults';
import '../logger';

// Setup
jest.mock('../../src/logger');
jest.mock('../../src/wrapper');

chalk.level = 1;

let project: Project;

beforeEach(() => {
  project = new Project('.');

  // Mocks
  jest.restoreAllMocks();

  (commandHandler as jest.MockedFunction<typeof commandHandler>)
    .mockImplementation((handler) => (args) => handler(project, args));

  jest.spyOn(process, 'exit').mockImplementation();
});

// Tests
describe('jill run', () => {
  it('should exit 1 if workspace doesn\'t exists', async () => {
    jest.spyOn(project, 'workspace').mockResolvedValue(null);

    // Call
    const { handler } = await import('../../src/commands/run');
    await expect(handler({ workspace: 'does-not-exists', script: 'test', ...defaultOptions }))
      .resolves.toBeUndefined();

    // Checks
    expect(logger.spin).toHaveBeenCalledWith('Loading project');
    expect(project.workspace).toHaveBeenCalledWith('does-not-exists');
    expect(logger.fail).toHaveBeenCalledWith('Workspace does-not-exists not found');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should print tasks status', async () => {
    const wks = new Workspace('./wks', { name: 'wks', version: '1.0.0' }, project);
    const tsk1 = new MockTask('test', ['1'], { workspace: wks });
    const tsk2 = new MockTask('test', ['2'], { workspace: wks });
    const tsk3 = new MockTask('test', ['3'], { workspace: wks });
    const handlers: Partial<Record<TaskEvent, TaskEventListener>> = {};

    jest.spyOn(project, 'workspace').mockResolvedValue(wks);
    jest.spyOn(wks, 'run').mockResolvedValue(tsk1);

    jest.spyOn(TaskManager.prototype, 'add').mockImplementation();
    jest.spyOn(TaskManager.prototype, 'start').mockImplementation();
    jest.spyOn(TaskManager.prototype, 'on')
      .mockImplementation(function (event, handler) {
        handlers[event] = handler;
        return this;
      });

    // Call
    const { handler } = await import('../../src/commands/run');
    await expect(handler({ ...defaultOptions, workspace: 'wks', script: 'test', '--': ['--arg', 1] }))
      .resolves.toBeUndefined();

    // Checks
    expect(logger.spin).toHaveBeenCalledWith('Loading project');
    expect(project.workspace).toHaveBeenCalledWith('wks');
    expect(wks.run).toHaveBeenCalledWith('test', ['--arg', '1']);
    expect(TaskManager.prototype.add).toHaveBeenCalledWith(tsk1);
    expect(TaskManager.prototype.start).toHaveBeenCalled();
    expect(TaskManager.prototype.on).toHaveBeenCalledWith('started', expect.any(Function));
    expect(TaskManager.prototype.on).toHaveBeenCalledWith('completed', expect.any(Function));

    // Activate task 1
    (logger.spin as jest.MockedFunction<typeof OraLogger.prototype.spin>).mockClear();

    handlers.started!(tsk1);
    expect(logger.spin).toHaveBeenCalledWith('Running test in wks ...');

    // Activate task 2 & 3
    (logger.spin as jest.MockedFunction<typeof OraLogger.prototype.spin>).mockClear();

    handlers.started!(tsk2);
    handlers.started!(tsk3);
    expect(logger.spin).toHaveBeenCalledWith('Building 2 packages ...');
    expect(logger.spin).toHaveBeenCalledWith('Building 3 packages ...');

    // Complete task 3
    (logger.spin as jest.MockedFunction<typeof OraLogger.prototype.spin>).mockClear();
    (logger.succeed as jest.MockedFunction<typeof OraLogger.prototype.succeed>).mockClear();
    (logger.fail as jest.MockedFunction<typeof OraLogger.prototype.succeed>).mockClear();

    handlers.completed!(tsk2.setStatus('failed'));
    expect(logger.fail).toHaveBeenCalledWith('Failed to build wks');
    expect(logger.spin).toHaveBeenCalledWith('Building 2 packages ...');

    // Complete task 1 & 2
    (logger.succeed as jest.MockedFunction<typeof OraLogger.prototype.succeed>).mockClear();

    handlers.completed!(tsk2.setStatus('done'));
    handlers.completed!(tsk1.setStatus('done'));
    expect(logger.succeed).toHaveBeenCalledWith('wks built');
  });
});
