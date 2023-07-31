import { vi } from 'vitest';

import { toMatchLines } from './to-match-lines';

// Tests
describe('toMatchLines', () => {
  it('should compare a string to an array of lines', () => {
    const context = {
      isNot: false,
      promise: false,
      equals: vi.fn().mockReturnValue(true),
    };

    expect(toMatchLines.call(context, 'toto\ntata', ['toto', 'tata']))
      .toMatchObject({
        pass: true
      });

    expect(context.equals).toHaveBeenCalledWith('toto', 'toto');
    expect(context.equals).toHaveBeenCalledWith('tata', 'tata');
  });

  it('should compare a string to an array of regex', () => {
    const context = {
      isNot: false,
      promise: false,
      equals: vi.fn().mockReturnValue(true),
    };

    expect(toMatchLines.call(context, 'toto\ntata', [/toto/, /tata/]))
      .toMatchObject({
        pass: true
      });
  });
});
