import { Command, type ICommand } from '@/src/modules/command';

// Command
@Command({
  command: 'mock'
})
export class MockCommand implements ICommand {
  // Methods
  handler = jest.fn();
}
