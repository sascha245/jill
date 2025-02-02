import { type Task } from '@jujulego/tasks';
import { inject, injectable, type interfaces as int } from 'inversify';
import yargs, { type Argv, type CommandModule } from 'yargs';

import { ContextService, type Context } from '@/src/commons/context.service.ts';
import { Logger } from '@/src/commons/logger.service.ts';
import { applyConfigOptions } from '@/src/config/config-options.ts';
import { CURRENT } from '@/src/constants.ts';
import { container, lazyInjectNamed } from '@/src/inversify.config.ts';
import { buildCommandModule, COMMAND, COMMAND_MODULE, getCommandOpts, type ICommand } from '@/src/modules/command.ts';
import { getModule } from '@/src/modules/module.ts';
import { PluginLoaderService } from '@/src/modules/plugin-loader.service.ts';
import { TaskCommand } from '@/src/modules/task-command.tsx';
import { type Class } from '@/src/types.ts';

// @ts-ignore: Outside of typescript's rootDir in build
import pkg from '../package.json';

// Application
@injectable()
export class JillApplication {
  // Attributes
  readonly container: int.Container;
  readonly parser: Argv;

  // Constructor
  constructor(
    @inject(ContextService)
    private readonly context: ContextService,
    @inject(PluginLoaderService)
    private readonly plugins: PluginLoaderService,
    @inject(Logger)
    private readonly logger: Logger,
  ) {
    // Create container
    this.container = container.createChild();

    // Create parser
    this.parser = yargs()
      .scriptName('jill')
      .completion('completion', 'Generate bash completion script')
      .help('help', 'Show help for a command')
      .version('version', 'Show version', pkg.version)
      .wrap(process.stdout.columns)
      .exitProcess(false);
  }

  // Methods
  private _prepareParser(commands: CommandModule[]): Argv {
    applyConfigOptions(this.parser);

    return this.parser
      .command(commands)
      .recommendCommands()
      .strict()
      .fail(false);
  }

  private async _loadPlugins(): Promise<void> {
    this.logger.child({ label: 'plugin' }).verbose('Loading plugin <core>');

    const { CorePlugin } = await import('@/src/core.plugin.ts');
    this.container.load(getModule(CorePlugin, true));

    await this.plugins.loadPlugins(this.container);
  }

  async run(argv: string | readonly string[]): Promise<void> {
    this.context.reset({ application: this });
    await this._loadPlugins();

    // Parse command
    const commands = await this.container.getAllAsync(COMMAND_MODULE);

    await this._prepareParser(commands).parseAsync(argv);
  }

  async tasksOf(argv: string[], ctx: Omit<Context, 'application'> = {}): Promise<Task[]> {
    this.context.reset({ ...ctx, application: this });
    await this._loadPlugins();

    // Prepare commands
    const commands = await this.container.getAllAsync(COMMAND);

    return new Promise<Task[]>((resolve, reject) => {
      const modules: CommandModule[] = [];

      for (const cmd of commands) {
        const opts = getCommandOpts(cmd.constructor as Class<ICommand>);
        const mod = buildCommandModule(cmd, opts);

        mod.handler = async (args) => {
          if (cmd instanceof TaskCommand) {
            const tasks: Task[] = [];

            for await (const tsk of cmd.prepare(args)) {
              tasks.push(tsk);
            }

            resolve(tasks);
          } else {
            resolve([]);
          }
        };

        modules.push(mod);
      }

      // Parse command
      this._prepareParser(modules)
        .parseAsync(argv)
        .catch(reject);
    });
  }
}

container.bind(JillApplication)
  .toSelf()
  .inTransientScope()
  .whenTargetIsDefault();

// Lazy injection
export function LazyCurrentApplication() {
  return lazyInjectNamed(JillApplication, CURRENT);
}

container.bind(JillApplication)
  .toDynamicValue(({ container }) => {
    const ctx = container.get(ContextService);
    const app = ctx.application;

    if (!app) {
      throw new Error('Cannot inject current application, it not yet defined');
    }

    return app;
  })
  .whenTargetNamed(CURRENT);
