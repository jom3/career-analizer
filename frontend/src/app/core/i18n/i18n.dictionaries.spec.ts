import { describe, expect, it } from 'vitest';
import { es } from './es';
import { en } from './en';

describe('Diccionarios i18n', () => {
  it('es y en tienen exactamente las mismas claves', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('ninguna clave de es está vacía', () => {
    for (const [key, value] of Object.entries(es)) {
      expect(value.trim().length, `clave '${key}' vacía en es`).toBeGreaterThan(0);
    }
  });

  it('ninguna clave de en está vacía', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim().length, `clave '${key}' vacía en en`).toBeGreaterThan(0);
    }
  });
});
