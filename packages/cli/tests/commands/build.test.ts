import { EventListener, Project, TaskManager, TaskManagerEventMap, Workspace } from '@jujulego/jill-core';
import chalk from 'chalk';

import { buildCommand, logger, OraLogger } from '../../src';

import { MockTask } from '../../mocks/task';
import '../logger';

// Setup
jest.mock('../../src/logger');

chalk.level = 1;

let project: Project;

beforeEach(() => {
  project = new Project('.');

  // Mocks
  jest.restoreAllMocks();
});

// Tests
describe('jill build', () => {
  it('should exit 1 if workspace doesn\'t exists', async () => {
    jest.spyOn(project, 'workspace').mockResolvedValue(null);

    // Call
    await expect(buildCommand(project, { workspace: 'does-not-exists' }))
      .resolves.toBe(1);

    // Checks
    expect(logger.spin).toHaveBeenCalledWith('Loading project');
    expect(project.workspace).toHaveBeenCalledWith('does-not-exists');
    expect(logger.fail).toHaveBeenCalledWith('Workspace does-not-exists not found');
  });

  it('should exit 1 if current workspace not found', async () => {
    jest.spyOn(project, 'workspace');
    jest.spyOn(project, 'currentWorkspace').mockResolvedValue(null);

    // Call
    await expect(buildCommand(project, { workspace: undefined }))
      .resolves.toBe(1);

    // Checks
    expect(logger.spin).toHaveBeenCalledWith('Loading project');
    expect(project.workspace).not.toHaveBeenCalled();
    expect(project.currentWorkspace).toHaveBeenCalled();
    expect(logger.fail).toHaveBeenCalledWith('Workspace . not found');
  });

  it('should print tasks status', async () => {
    const wks = new Workspace('./wks', { name: 'wks', version: '1.0.0' }, project);
    const tsk1 = new MockTask('test', ['1'], { context: { workspace: wks }});
    const tsk2 = new MockTask('test', ['2'], { context: { workspace: wks }});
    const tsk3 = new MockTask('test', ['3'], { context: { workspace: wks }});
    const handlers: { [K in keyof TaskManagerEventMap]?: EventListener<TaskManagerEventMap, K> } = {};

    jest.spyOn(project, 'workspace').mockResolvedValue(wks);
    jest.spyOn(wks, 'build').mockResolvedValue(tsk1);

    jest.spyOn(TaskManager.prototype, 'add').mockImplementation();
    jest.spyOn(TaskManager.prototype, 'start').mockImplementation();
    jest.spyOn(TaskManager.prototype, 'on')
      .mockImplementation(function (event, handler) {
        handlers[event] = handler;
        return this;
      });

    // Call
    await expect(buildCommand(project, { workspace: 'wks' }))
      .resolves.toBeUndefined();

    // Checks
    expect(logger.spin).toHaveBeenCalledWith('Loading project');
    expect(project.workspace).toHaveBeenCalledWith('wks');
    expect(wks.build).toHaveBeenCalled();
    expect(TaskManager.prototype.add).toHaveBeenCalledWith(tsk1);
    expect(TaskManager.prototype.start).toHaveBeenCalled();
    expect(TaskManager.prototype.on).toHaveBeenCalledWith('started', expect.any(Function));
    expect(TaskManager.prototype.on).toHaveBeenCalledWith('completed', expect.any(Function));

    // Activate task 1
    (logger.spin as jest.MockedFunction<typeof OraLogger.prototype.spin>).mockClear();

    handlers.started!(tsk1);
    expect(logger.spin).toHaveBeenCalledWith('Building wks ...');

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

  it('should use current workspace', async () => {
    const wks = new Workspace('./wks', { name: 'wks', version: '1.0.0' }, project);
    const tsk = new MockTask('test', [], { context: { workspace: wks }});

    jest.spyOn(project, 'workspace').mockResolvedValue(null);
    jest.spyOn(project, 'currentWorkspace').mockResolvedValue(wks);
    jest.spyOn(wks, 'build').mockResolvedValue(tsk);

    jest.spyOn(TaskManager.prototype, 'add').mockImplementation();
    jest.spyOn(TaskManager.prototype, 'start').mockImplementation();
    jest.spyOn(TaskManager.prototype, 'on').mockReturnThis();

    // Call
    await expect(buildCommand(project, { workspace: undefined }))
      .resolves.toBeUndefined();

    // Checks
    expect(logger.spin).toHaveBeenCalledWith('Loading project');
    expect(project.workspace).not.toHaveBeenCalled();
    expect(project.currentWorkspace).toHaveBeenCalled();
    expect(wks.build).toHaveBeenCalled();
    expect(TaskManager.prototype.add).toHaveBeenCalledWith(tsk);
    expect(TaskManager.prototype.start).toHaveBeenCalled();
  });
});
