import { logger } from '@jujulego/jill-core';
import { promises as fs } from 'fs';
import { lock } from 'proper-lockfile';

// Class
export class PidFile {
  // Attributes
  private readonly _logger = logger.child({ context: 'MyrServer' });

  // Statics
  private static processIsRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return false;
    }
  }

  // Methods
  private async lock<R>(fun: () => Promise<R>): Promise<R> {
    const release = await lock('.jill-myr.pid');

    try {
      return await fun();
    } finally {
      await release();
    }
  }

  async create(): Promise<boolean> {
    try {
      this._logger.debug(`Create pid file ${process.pid}`);
      await fs.writeFile('.jill-myr.pid', process.pid.toString(), { flag: 'wx', encoding: 'utf-8' });
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Try to update pidfile
        return await this.update();
      } else {
        this._logger.error(err.stack || err.message);
      }

      return false;
    }

    return true;
  }

  async update(): Promise<boolean> {
    // Get other process pid
    const pid = parseInt(await fs.readFile('.jill-myr.pid', 'utf-8'));
    this._logger.warn(`Looks like myr was already started (${pid})`);

    // Check if other process is still running
    if (PidFile.processIsRunning(pid)) return false;

    try {
      // Lock pidfile
      await this.lock(async () => {
        this._logger.debug(`Update pid file ${pid} => ${process.pid}`);
        await fs.writeFile('.jill-myr.pid', process.pid.toString(), { flag: 'w', encoding: 'utf-8' });
      });

      this._logger.info(`${pid} was killed or stopped, pidfile updated`);
    } catch (err) {
      this._logger.error(err);
      return false;
    }

    return true;
  }

  async delete(): Promise<void> {
    this._logger.debug('Delete pid file');
    await fs.unlink('.jill-myr.pid');
  }
}