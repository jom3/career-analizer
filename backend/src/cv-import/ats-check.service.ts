import { Injectable } from '@nestjs/common';
import { AtsCheckItem, CvDraft } from './cv-import.types';

export const MIN_SUMMARY_LENGTH = 80;
export const MIN_SKILLS = 3;

// Chequeo ATS post-parse: reporta con un booleano por criterio qué tan
// completo está el borrador extraído del CV.
@Injectable()
export class AtsCheckService {
  check(draft: CvDraft): AtsCheckItem[] {
    return [
      this.contact(draft),
      this.headline(draft),
      this.summary(draft),
      this.experience(draft),
      this.skills(draft),
      this.education(draft),
      this.languages(draft),
    ];
  }

  private contact(draft: CvDraft): AtsCheckItem {
    const ok = Boolean(draft.phone) || Boolean(draft.location);
    return {
      key: 'contact',
      label: 'Contacto',
      ok,
      message: ok
        ? 'Datos de contacto presentes.'
        : 'Falta teléfono o ubicación en el CV.',
    };
  }

  private headline(draft: CvDraft): AtsCheckItem {
    const ok = Boolean(draft.headline);
    return {
      key: 'headline',
      label: 'Título profesional',
      ok,
      message: ok
        ? 'Título profesional presente.'
        : 'Falta un título profesional (headline).',
    };
  }

  private summary(draft: CvDraft): AtsCheckItem {
    const length = draft.summary?.length ?? 0;
    const ok = length >= MIN_SUMMARY_LENGTH;
    return {
      key: 'summary',
      label: 'Resumen',
      ok,
      message: ok
        ? 'Resumen con contenido suficiente.'
        : `El resumen es muy corto (${length} caracteres, mínimo ${MIN_SUMMARY_LENGTH}).`,
    };
  }

  private experience(draft: CvDraft): AtsCheckItem {
    const hasComplete = draft.experiences.some(
      (item) =>
        Boolean(item.company) &&
        Boolean(item.position) &&
        (Boolean(item.startDate) || Boolean(item.endDate)),
    );
    return {
      key: 'experience',
      label: 'Experiencia',
      ok: hasComplete,
      message: hasComplete
        ? 'Al menos una experiencia completa con fechas.'
        : 'Falta experiencia laboral con empresa, cargo y fechas.',
    };
  }

  private skills(draft: CvDraft): AtsCheckItem {
    const ok = draft.skills.length >= MIN_SKILLS;
    return {
      key: 'skills',
      label: 'Habilidades',
      ok,
      message: ok
        ? `Se detectaron ${draft.skills.length} habilidades.`
        : `Se detectaron ${draft.skills.length} habilidades (mínimo recomendado ${MIN_SKILLS}).`,
    };
  }

  private education(draft: CvDraft): AtsCheckItem {
    const ok = draft.education.length > 0;
    return {
      key: 'education',
      label: 'Educación',
      ok,
      message: ok
        ? 'Formación académica presente.'
        : 'No se detectó formación académica.',
    };
  }

  private languages(draft: CvDraft): AtsCheckItem {
    const ok = draft.languages.length > 0;
    return {
      key: 'languages',
      label: 'Idiomas',
      ok,
      message: ok ? 'Idiomas presentes.' : 'No se detectaron idiomas en el CV.',
    };
  }
}
