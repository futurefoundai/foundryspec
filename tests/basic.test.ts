import { describe, it, expect } from 'vitest';
import { ScaffoldManager } from '../src/ScaffoldManager';

describe('FoundrySpec System Check', () => {
  it('should be able to import core modules', () => {
    expect(ScaffoldManager).toBeDefined();
  });

  it('sanity check', () => {
    expect(true).toBe(true);
  });
});
