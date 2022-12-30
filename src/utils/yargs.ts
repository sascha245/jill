import { Arguments, Argv, CommandModule } from 'yargs';

import { Awaitable } from '../types';

// Types
export interface Middleware<T = unknown, U = T> {
  builder?: (yargs: Argv<T>) => Awaitable<Argv<U>>;
  handler(args: Arguments<U>): Awaitable<void>;
}

export interface Plugin<T = unknown, U = T> {
  builder(yargs: Argv<T>): Awaitable<Argv<U>>;
}

// Command utils
export function defineCommand<T, U>(command: CommandModule<T, U>): CommandModule<T, U> {
  return command;
}

// Middleware utils
export function defineMiddleware<T, U>(middleware: Middleware<T, U>): Middleware<T, U> {
  return middleware;
}

export async function applyMiddlewares<T>(yargs: Argv<T>, middlewares: Middleware[]): Promise<Argv<T>> {
  let tmp: Argv<unknown> = yargs;

  for (const middleware of middlewares) {
    if (middleware.builder) {
      tmp = await middleware.builder(tmp);
    }

    tmp.middleware(middleware.handler);
  }

  return tmp as Argv<T>;
}

// Plugin utils
export function definePlugin<T, U>(plugin: Plugin<T, U>): Plugin<T, U> {
  return plugin;
}

export function assertPlugin(obj: unknown, name: string): asserts obj is Plugin {
  if (!obj) {
    throw new Error(`Plugin ${name} is not a valid plugin. Default export is null or undefined`);
  }

  if (typeof obj !== 'object') {
    throw new Error(`Plugin ${name} is not a valid plugin. Default export is a ${typeof obj}`);
  }

  if (!('builder' in obj)) {
    throw new Error(`Plugin ${name} is not a valid plugin. Missing builder method in default export`);
  }
}
