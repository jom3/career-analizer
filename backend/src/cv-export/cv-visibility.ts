import type { CvData } from './cv-export.service';

// Un item sin flag (p. ej. CV adaptado a una oferta) se considera visible.
export function applyCompactVisibility(data: CvData): CvData {
  return {
    ...data,
    education: data.education.filter((item) => item.showInCompactCv !== false),
    certifications: data.certifications.filter(
      (item) => item.showInCompactCv !== false,
    ),
  };
}

export function applyDocumentedVisibility(data: CvData): CvData {
  return {
    ...data,
    education: data.education.filter(
      (item) => item.showInDocumentedCv !== false,
    ),
    certifications: data.certifications.filter(
      (item) => item.showInDocumentedCv !== false,
    ),
  };
}
