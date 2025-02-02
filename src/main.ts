import chalk from 'chalk';
import { hideBin } from 'yargs/helpers';

import { container } from '@/src/inversify.config.ts';
import { JillApplication } from '@/src/jill.application.ts';
import { ExitException } from '@/src/utils/exit.ts';

// Bootstrap
(async () => {
  const app = await container.getAsync(JillApplication);

  try {
    await app.run(hideBin(process.argv));
  } catch (err) {
    if (err instanceof ExitException) {
      process.exit(err.code);
    } else {
      console.error(await app.parser.getHelp());
      console.error(chalk.red(err.message));

      process.exit(1);
    }
  }
})();
