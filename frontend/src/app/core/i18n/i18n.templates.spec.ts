import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP_DIR = resolve(process.cwd(), 'src', 'app');

const WHITELIST = new Set([
  'Career Analyzer',
  'ES',
  'EN',
  '/',
  '·',
  '—',
  '✓',
  '✗',
  '+',
  '%',
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
  '01',
  '02',
  '03',
  '04',
  '05',
]);

function collectHtmlFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectHtmlFiles(full));
    } else if (entry.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

function stripInterpolations(value: string): string {
  return value.replace(/\{\{[\s\S]*?\}\}/g, '');
}

function extractStaticText(html: string): string[] {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const fragments: string[] = [];
  const content = withoutComments.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  const tagContent = content.replace(/<[^>]*>/g, '\n');
  for (const raw of tagContent.split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    if (isControlFlow(trimmed)) {
      continue;
    }
    const text = stripInterpolations(trimmed).trim();
    if (text) {
      fragments.push(text);
    }
  }
  const attrPattern =
    /\b(?:placeholder|title|aria-label)="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(withoutComments)) !== null) {
    const text = stripInterpolations(match[1]).trim();
    if (text) {
      fragments.push(text);
    }
  }
  return fragments;
}

function isControlFlow(line: string): boolean {
  if (line.startsWith('@')) {
    return true;
  }
  if (line === '}') {
    return true;
  }
  if (/^\}\s*(@\w+.*)?\{?$/.test(line)) {
    return true;
  }
  return false;
}

function isWhitelisted(fragment: string): boolean {
  return (
    WHITELIST.has(fragment) ||
    /^[\d.]+%?$/.test(fragment) ||
    /^[\d]{1,4}([-\/]\d{1,4})?$/.test(fragment) ||
    /^[\d]+\.?$/.test(fragment)
  );
}

describe('Scan de literales de UI en plantillas', () => {
  const files = collectHtmlFiles(APP_DIR);

  it('encuentra plantillas a escanear (la ruta base es correcta)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('no hay texto visible de UI que no pase por i18n.t()', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const html = readFileSync(file, 'utf8');
      for (const fragment of extractStaticText(html)) {
        if (fragment.includes('i18n.t(')) {
          continue;
        }
        if (isWhitelisted(fragment)) {
          continue;
        }
        if (!/[A-Za-zÁÉÍÓÚáéíóúñÑ]{2,}/.test(fragment)) {
          continue;
        }
        offenders.push(`${file.replace(APP_DIR, '')}: "${fragment}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
