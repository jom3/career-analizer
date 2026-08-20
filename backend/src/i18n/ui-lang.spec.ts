import { resolveUiLang, selectLang } from './ui-lang';

describe('resolveUiLang', () => {
  it('normaliza "es" a es', () => {
    expect(resolveUiLang('es')).toBe('es');
  });

  it('normaliza "en" a en', () => {
    expect(resolveUiLang('en')).toBe('en');
  });

  it('acepta locales con región (en-US)', () => {
    expect(resolveUiLang('en-US')).toBe('en');
    expect(resolveUiLang('es-AR')).toBe('es');
  });

  it('toma el primer valor de una lista Accept-Language', () => {
    expect(resolveUiLang('en-US,en;q=0.9,es;q=0.8')).toBe('en');
  });

  it('ignora mayúsculas y espacios', () => {
    expect(resolveUiLang(' EN ')).toBe('en');
    expect(resolveUiLang('ES')).toBe('es');
  });

  it('cae a es cuando el header falta', () => {
    expect(resolveUiLang(undefined)).toBe('es');
  });

  it('cae a es ante idiomas no soportados', () => {
    expect(resolveUiLang('fr')).toBe('es');
    expect(resolveUiLang('de-DE')).toBe('es');
    expect(resolveUiLang('')).toBe('es');
  });
});

describe('selectLang', () => {
  it('devuelve el valor del idioma objetivo cuando existe', () => {
    expect(selectLang('español', 'english', 'en')).toBe('english');
    expect(selectLang('español', 'english', 'es')).toBe('español');
  });

  it('cae al otro idioma cuando el objetivo está vacío', () => {
    expect(selectLang('español', '', 'en')).toBe('español');
    expect(selectLang(null, 'english', 'es')).toBe('english');
    expect(selectLang(undefined, 'english', 'es')).toBe('english');
  });

  it('devuelve null cuando ambos están vacíos', () => {
    expect(selectLang(null, undefined, 'es')).toBeNull();
    expect(selectLang('', '', 'en')).toBeNull();
  });

  it('usa es como target por defecto', () => {
    expect(selectLang('español', 'english')).toBe('español');
  });
});
