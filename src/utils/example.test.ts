import * as fc from 'fast-check';

describe('Property-Based Testing Setup', () => {
  it('should run property-based tests with fast-check', () => {
    // Simple property: reversing a string twice returns the original
    fc.assert(
      fc.property(fc.string(), (str) => {
        const reversed = str.split('').reverse().join('');
        const doubleReversed = reversed.split('').reverse().join('');
        return doubleReversed === str;
      }),
      { numRuns: 100 }
    );
  });

  it('should generate random numbers within range', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (num) => {
        return num >= 0 && num <= 100;
      }),
      { numRuns: 100 }
    );
  });
});
