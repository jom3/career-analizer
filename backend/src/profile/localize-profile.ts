import { selectLang, selectLangList, UiLang } from '../i18n/ui-lang';
import type { ProfileWithCollections } from './profile.service';

// Devuelve una copia del perfil con los campos base (headline, position, etc.)
// rellenados con la versión del idioma objetivo (selectLang) y fallback al otro.
// Los consumidores (generadores de CV/carta, snapshot) usan así el idioma de la UI.
export function localizeProfile(
  profile: ProfileWithCollections,
  target: UiLang = 'es',
): ProfileWithCollections {
  return {
    ...profile,
    headline:
      selectLang(profile.headlineEs, profile.headlineEn, target) ??
      profile.headline,
    location:
      selectLang(profile.locationEs, profile.locationEn, target) ??
      profile.location,
    summary:
      selectLang(profile.summaryEs, profile.summaryEn, target) ??
      profile.summary,
    experiences: profile.experiences.map((item) => ({
      ...item,
      position:
        selectLang(item.positionEs, item.positionEn, target) ?? item.position,
      location:
        selectLang(item.locationEs, item.locationEn, target) ?? item.location,
      description:
        selectLang(item.descriptionEs, item.descriptionEn, target) ??
        item.description,
      metrics:
        selectLangList(item.metricsEs, item.metricsEn, target) ?? item.metrics,
    })),
    education: profile.education.map((item) => ({
      ...item,
      degree: selectLang(item.degreeEs, item.degreeEn, target) ?? item.degree,
      institution:
        selectLang(item.institutionEs, item.institutionEn, target) ??
        item.institution,
      field: selectLang(item.fieldEs, item.fieldEn, target) ?? item.field,
      description:
        selectLang(item.descriptionEs, item.descriptionEn, target) ??
        item.description,
    })),
    certifications: profile.certifications.map((item) => ({
      ...item,
      name: selectLang(item.nameEs, item.nameEn, target) ?? item.name,
      issuer: selectLang(item.issuerEs, item.issuerEn, target) ?? item.issuer,
    })),
    projects: profile.projects.map((item) => ({
      ...item,
      name: selectLang(item.nameEs, item.nameEn, target) ?? item.name,
      role: selectLang(item.roleEs, item.roleEn, target) ?? item.role,
      description:
        selectLang(item.descriptionEs, item.descriptionEn, target) ??
        item.description,
      metrics:
        selectLangList(item.metricsEs, item.metricsEn, target) ?? item.metrics,
    })),
    languages: profile.languages.map((item) => ({
      ...item,
      name: selectLang(item.nameEs, item.nameEn, target) ?? item.name,
    })),
  };
}
