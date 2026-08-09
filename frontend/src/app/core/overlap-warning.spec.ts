import { describe, expect, it } from 'vitest';
import { overlappingExperiences } from './overlap-warning';

describe('overlappingExperiences', () => {
  const today = new Date(2026, 5, 15);

  it('marca dos experiencias con rango compartido', () => {
    const result = overlappingExperiences(
      [
        { startDate: '2020-01-01', endDate: '2023-12-01', current: false },
        { startDate: '2022-01-01', endDate: '2025-12-01', current: false },
      ],
      today,
    );
    expect(result).toEqual([[0, 1]]);
  });

  it('extiende current hasta hoy y solapa con otra experiencia activa', () => {
    const result = overlappingExperiences(
      [
        { startDate: '2024-01-01', endDate: null, current: true },
        { startDate: '2025-01-01', endDate: null, current: true },
      ],
      today,
    );
    expect(result).toEqual([[0, 1]]);
  });

  it('no marca experiencias con periodos separados', () => {
    const result = overlappingExperiences(
      [
        { startDate: '2018-01-01', endDate: '2019-12-01', current: false },
        { startDate: '2020-01-01', endDate: '2021-12-01', current: false },
      ],
      today,
    );
    expect(result).toEqual([]);
  });

  it('marca rangos que comparten límite exacto', () => {
    const result = overlappingExperiences(
      [
        { startDate: '2018-01-01', endDate: '2020-01-01', current: false },
        { startDate: '2020-01-01', endDate: '2021-01-01', current: false },
      ],
      today,
    );
    expect(result).toEqual([[0, 1]]);
  });

  it('ignora experiencias con fechas incompletas', () => {
    const result = overlappingExperiences(
      [
        { startDate: '2020-01-01', endDate: null, current: false },
        { startDate: null, endDate: '2024-01-01', current: false },
        { startDate: null, endDate: null, current: false },
      ],
      today,
    );
    expect(result).toEqual([]);
  });

  it('devuelve lista vacía para entrada vacía', () => {
    expect(overlappingExperiences([], today)).toEqual([]);
  });

  it('una experiencia finalizada antes de hoy no solapa con current', () => {
    const result = overlappingExperiences(
      [
        { startDate: '2018-01-01', endDate: '2019-12-01', current: false },
        { startDate: '2024-01-01', endDate: null, current: true },
      ],
      today,
    );
    expect(result).toEqual([]);
  });
});
