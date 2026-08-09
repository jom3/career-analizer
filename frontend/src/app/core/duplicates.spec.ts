import { describe, expect, it } from 'vitest';
import { findDuplicates, normalizeForComparison } from './duplicates';

describe('normalizeForComparison', () => {
  it('colapsa minúsculas, acentos y espacios', () => {
    expect(normalizeForComparison('Full-Stäck  Developer')).toBe(
      'full-stack developer',
    );
  });
});

describe('findDuplicates', () => {
  it('agrupa skills con el mismo nombre normalizado', () => {
    const result = findDuplicates({
      skills: [
        { name: 'TypeScript' },
        { name: 'typescript' },
        { name: 'Full Stack' },
        { name: 'Full  Stack' },
        { name: 'Node.js' },
      ],
      experiences: [],
    });

    expect(result.skills).toHaveLength(2);
    const typescript = result.skills.find((group) => group.key === 'typescript');
    expect(typescript?.items).toHaveLength(2);
    const fullStack = result.skills.find((group) => group.key === 'full stack');
    expect(fullStack?.items).toHaveLength(2);
  });

  it('no agrupa variantes con guion y espacio (falso negativo conocido)', () => {
    const result = findDuplicates({
      skills: [{ name: 'Full-stack' }, { name: 'Full Stack' }],
      experiences: [],
    });

    expect(result.skills).toHaveLength(0);
  });

  it('agrupa experiencias por empresa+posición+periodo', () => {
    const result = findDuplicates({
      skills: [],
      experiences: [
        {
          company: 'Acme',
          position: 'Senior Developer',
          startDate: '2020-01-01',
          endDate: '2022-12-01',
        },
        {
          company: 'acme',
          position: 'senior developer',
          startDate: '2020-01-01',
          endDate: '2022-12-01',
        },
        {
          company: 'Acme',
          position: 'Senior Developer',
          startDate: '2020-01-01',
          endDate: null,
        },
        {
          company: 'Other Corp',
          position: 'Developer',
          startDate: '2019-01-01',
          endDate: null,
        },
      ],
    });

    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0].items).toHaveLength(2);
  });

  it('no agrupa experiencias con periodo distinto', () => {
    const result = findDuplicates({
      skills: [],
      experiences: [
        {
          company: 'Acme',
          position: 'Developer',
          startDate: '2018-01-01',
          endDate: '2020-01-01',
        },
        {
          company: 'Acme',
          position: 'Developer',
          startDate: '2020-01-01',
          endDate: null,
        },
      ],
    });

    expect(result.experiences).toHaveLength(0);
  });

  it('no marca items vacíos como duplicados', () => {
    const result = findDuplicates({
      skills: [{ name: '' }, { name: '   ' }],
      experiences: [
        { company: '', position: '', startDate: null, endDate: null },
        { company: null, position: null, startDate: null, endDate: null },
      ],
    });

    expect(result.skills).toHaveLength(0);
    expect(result.experiences).toHaveLength(0);
  });

  it('no marca items únicos como duplicados', () => {
    const result = findDuplicates({
      skills: [{ name: 'TypeScript' }, { name: 'Angular' }],
      experiences: [],
    });

    expect(result.skills).toHaveLength(0);
    expect(result.experiences).toHaveLength(0);
  });
});
