import { describe, expect, it } from 'vitest';
import {
  erpDocumentationSlug,
  erpIsDocumentationSlug,
  erpNormalizeDocumentationText,
} from './documentation-slug.utils';

describe('documentation slug utilities', () => {
  it('normalizes Polish diacritics for search', () => {
    expect(erpNormalizeDocumentationText('Zażółć GĘŚLĄ')).toBe('zazolc gesla');
  });

  it('creates stable URL slugs', () => {
    expect(erpDocumentationSlug('Lista i filtry produktów')).toBe('lista-i-filtry-produktow');
    expect(erpIsDocumentationSlug('lista-i-filtry-produktow')).toBe(true);
    expect(erpIsDocumentationSlug('../products')).toBe(false);
  });
});
