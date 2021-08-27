import path from 'path';
import { Logger } from 'winston';

import { logger } from './logger';
import type { Manifest } from './manifest';
import { Project } from './project';
import { SpawnTask, SpawnTaskOption } from './tasks';
import { combine, spawn } from './utils';

// Types
export interface WorkspaceRunOptions extends Omit<SpawnTaskOption, 'cwd'> {
  buildDeps?: 'all' | 'prod' | 'none';
}

// Class
export class Workspace {
  // Attributes
  private _lastBuild?: SpawnTask;

  private _isAffected?: boolean;
  private readonly _logger: Logger;

  // Constructor
  constructor(
    private readonly _cwd: string,
    readonly manifest: Manifest,
    readonly project: Project
  ) {
    this._logger = logger.child({ label: manifest.name });
  }

  // Methods
  private async _buildDependencies(task: SpawnTask) {
    for await (const dep of combine(this.dependencies(), this.devDependencies())) {
      task.dependsOn(await dep.build());
    }
  }

  async isAffected(base: string): Promise<boolean> {
    if (this._isAffected === undefined) {
      // Test workspace
      const { stdout } = await spawn('git', ['diff', '--name-only', base, '--', this.cwd], {
        cwd: this.project.root,
      });

      this._isAffected = stdout.length > 0;

      if (!this._isAffected) {
        // Test it's dependencies
        for await (const dep of combine(this.dependencies(), this.devDependencies())) {
          if (await dep.isAffected(base)) {
            this._isAffected = true;
            break;
          }
        }
      }
    }

    return this._isAffected;
  }

  async* dependencies(): AsyncGenerator<Workspace, void> {
    if (!this.manifest.dependencies) return;

    for (const dep of Object.keys(this.manifest.dependencies)) {
      const ws = await this.project.workspace(dep);

      if (ws) {
        yield ws;
      }
    }
  }

  async* devDependencies(): AsyncGenerator<Workspace, void> {
    if (!this.manifest.devDependencies) return;

    for (const dep of Object.keys(this.manifest.devDependencies)) {
      const ws = await this.project.workspace(dep);

      if (ws) {
        yield ws;
      }
    }
  }

  async run(script: string, args: string[] = [], opts: WorkspaceRunOptions = {}): Promise<SpawnTask> {
    const pm = await this.project.packageManager();

    const task = new SpawnTask(pm, ['run', script, ...args], {
      ...opts,
      cwd: this.cwd,
      logger: this._logger,
      context: { workspace: this }
    });
    await this._buildDependencies(task);

    return task;
  }

  async build(): Promise<SpawnTask> {
    if (!this._lastBuild) {
      this._lastBuild = await this.run('jill:build');
    }

    return this._lastBuild;
  }

  // Properties
  get name(): string {
    return this.manifest.name;
  }

  get cwd(): string {
    return path.resolve(this.project.root, this._cwd);
  }
}
