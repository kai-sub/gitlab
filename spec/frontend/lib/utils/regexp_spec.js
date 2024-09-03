import { containsPotentialRegex } from '~/lib/utils/regexp';

describe('containsPotentialRegex', () => {
  it('should return true for a string containing regex elements', () => {
    expect(containsPotentialRegex('Does this contain .* a regex?')).toBe(true);
    expect(containsPotentialRegex('Special characters like (parentheses) and [brackets].')).toBe(
      true,
    );
    expect(containsPotentialRegex('Matches \\d digits and \\w word characters.')).toBe(true);
  });

  it('should return true for a string with multiple regex elements', () => {
    expect(containsPotentialRegex('Multiple elements: .*\\d+')).toBe(true);
  });

  it('should return false for a string with no regex elements', () => {
    expect(containsPotentialRegex('This is a test string.')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(containsPotentialRegex('')).toBe(false);
  });

  it('should return false for strings with only alphabets and numbers', () => {
    expect(containsPotentialRegex('abcdefg12345')).toBe(false);
    expect(containsPotentialRegex('simpleTextWithoutRegex')).toBe(false);
  });
});
