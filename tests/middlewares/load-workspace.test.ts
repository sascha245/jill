import yargs, { Argv } from 'yargs';
import { vi } from 'vitest';

import { ContextService } from '@/src/commons/context.service.js';
import { SpinnerService } from '@/src/commons/spinner.service.js';
import { CURRENT } from '@/src/constants.js';
import { container } from '@/src/inversify.config.js';
import { LoadWorkspace } from '@/src/middlewares/load-workspace.js';
import { applyMiddlewares } from '@/src/modules/middleware.js';
import { Workspace } from '@/src/project/workspace.js';
import { ExitException } from '@/src/utils/exit.js';

import { TestBed } from '@/tools/test-bed.js';

// Setup
let bed: TestBed;
let parser: Argv;
let context: ContextService;
let spinner: SpinnerService;

beforeAll(() => {
  container.snapshot();
});

beforeEach(() => {
  container.restore();
  container.snapshot();

  context = container.get(ContextService);
  spinner = container.get(SpinnerService);
  vi.spyOn(spinner, 'spin').mockReturnValue();
  vi.spyOn(spinner, 'stop').mockReturnValue();
  vi.spyOn(spinner, 'failed').mockReturnValue();

  bed = new TestBed();

  parser = applyMiddlewares(yargs(), [LoadWorkspace]);
});

// Tests
describe('LoadWorkspace', () => {
  it('should search for main workspace', async () => {
    context.reset({ project: bed.project });

    vi.spyOn(bed.project, 'workspace');
    vi.spyOn(bed.project, 'currentWorkspace');
    vi.spyOn(bed.project, 'mainWorkspace');

    await parser.parse(''); // <= no args

    expect(spinner.spin).toHaveBeenCalledWith('Loading "." workspace ...');
    expect(bed.project.workspace).not.toHaveBeenCalled();
    expect(bed.project.currentWorkspace).not.toHaveBeenCalled();
    expect(bed.project.mainWorkspace).toHaveBeenCalled();

    expect(context.workspace).toBe(bed.project.testMainWorkspace);

    expect(spinner.stop).toHaveBeenCalled();
  });

  it('should search for current workspace', async () => {
    const wks = bed.addWorkspace('test');
    context.reset({ project: bed.project });

    vi.spyOn(bed.project, 'workspace');
    vi.spyOn(bed.project, 'currentWorkspace');
    vi.spyOn(bed.project, 'mainWorkspace');

    const root = bed.project.root;
    vi.spyOn(bed.project, 'root', 'get').mockReturnValue(root);

    const cwd = wks.cwd;
    vi.spyOn(wks, 'cwd', 'get').mockReturnValue(cwd);
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);

    await parser.parse(''); // <= no args

    expect(spinner.spin).toHaveBeenCalledWith('Loading "." workspace ...');
    expect(bed.project.workspace).not.toHaveBeenCalled();
    expect(bed.project.currentWorkspace).toHaveBeenCalledWith();
    expect(bed.project.mainWorkspace).not.toHaveBeenCalled();

    expect(context.workspace).toBe(wks);

    expect(spinner.stop).toHaveBeenCalled();
  });

  it('should search for named workspace', async () => {
    const wks = bed.addWorkspace('test');
    context.reset({ project: bed.project });

    vi.spyOn(bed.project, 'workspace');
    vi.spyOn(bed.project, 'currentWorkspace');
    vi.spyOn(bed.project, 'mainWorkspace');

    await parser.parse('-w test');

    expect(spinner.spin).toHaveBeenCalledWith('Loading "test" workspace ...');
    expect(bed.project.workspace).toHaveBeenCalledWith('test');
    expect(bed.project.currentWorkspace).not.toHaveBeenCalled();
    expect(bed.project.mainWorkspace).not.toHaveBeenCalled();

    expect(context.workspace).toBe(wks);

    expect(spinner.stop).toHaveBeenCalled();
  });

  it('should print failed spinner if workspace is not found', async () => {
    context.reset({ project: bed.project });
    vi.spyOn(bed.project, 'workspace')
      .mockResolvedValue(null);

    await expect(parser.parse('-w test'))
      .rejects.toEqual(new ExitException(1, 'Workspace not found'));

    expect(spinner.spin).toHaveBeenCalledWith('Loading "test" workspace ...');
    expect(spinner.failed).toHaveBeenCalledWith('Workspace "test" not found');
  });

  it('should keep workspace from context if no args are provided', async () => {
    const wks = bed.addWorkspace('parent');
    context.reset({ project: bed.project, workspace: wks });

    vi.spyOn(bed.project, 'workspace')
      .mockResolvedValue(bed.addWorkspace('test'));

    await parser.parse(''); // <= no args

    expect(bed.project.workspace).not.toHaveBeenCalled();
    expect(context.workspace).toBe(wks);
  });

  it('should replace workspace in context if args are provided', async () => {
    const wks = bed.addWorkspace('test');

    context.reset({ project: bed.project, workspace: bed.addWorkspace('parent') });

    vi.spyOn(bed.project, 'workspace')
      .mockResolvedValue(wks);

    await parser.parse('-w test');

    expect(bed.project.workspace).toHaveBeenCalledWith('test');
    expect(context.workspace).toBe(wks);
  });
});

describe('Workspace CURRENT binding', () => {
  it('should return workspace from context', () => {
    // Set project in context
    const wks = bed.addWorkspace('root');
    context.reset({ workspace: wks });

    // Use binding
    expect(container.getNamed(Workspace, CURRENT)).toBe(wks);
  });

  it('should throw if project miss in context', () => {
    // Set project in context
    context.reset();

    // Use binding
    expect(() => container.getNamed(Workspace, CURRENT))
      .toThrow(new Error('Cannot inject current workspace, it not yet defined'));
  });
});
