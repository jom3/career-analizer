# SPEC 23 — Formulario de perfil compartido

> **Status:** Implemented
> **Depends on:** SPEC 05 (candidate profile), SPEC 06 (CV import), SPEC 17 (perfil bilingüe)
> **Date:** 2026-10-22
> **Objective:** Eliminar la duplicación entre el formulario de `/profile` y el de `/cv-import`, que hoy repiten las mismas secciones con casi el mismo markup, sin perder los campos bilingües ni la detección de duplicados del perfil.
> **Origen:** paso 13 de SPEC 22, diferido porque ambos formularios difieren en idioma editable.

## Scope

**In:**

- Componentes de sección reutilizables por `/profile` y `/cv-import`.
- Soporte de campos bilingües opcional por sección.
- Conservar la detección de duplicados y el autoscroll al ítem agregado.

**Out:**

- Cambios en el modelo de datos del perfil.
- Cambios en el flujo de importación (borrador, ATS, confirmación).
- Rediseño visual.

## Decisions

- **Sí:** **un componente por sección** (`ExperienceSectionComponent`, `SkillsSectionComponent`, `EducationSectionComponent`, `CertificationsSectionComponent`, `ProjectsSectionComponent`, `LanguagesSectionComponent`), no un único formulario monolítico. Cada sección se reutiliza donde haga falta y se testea por separado.
- **Sí:** **el componente no posee el `FormGroup`**: recibe el form y las colecciones del padre. Los padres siguen siendo dueños del estado, la persistencia y la validación. Menos acoplamiento y migración incremental.
- **Sí:** **los componentes no manejan idiomas**: verificado durante la implementación, `/profile` no tiene inputs bilingües. Los idiomas se resuelven en la página con `applyLangToForm` y un store lateral, y los componentes solo renderizan los controles del idioma activo. Por eso no necesitan un input de idiomas.
- **Sí:** **diferencias reales como inputs**: `showMetrics` (perfil sí, importación no), `duplicateIndices` y `overlapIndices` (solo perfil).
- **Sí:** **componentes standalone y zoneless-safe**, con `ChangeDetectionStrategy.OnPush` y signals para lo que sea estado local.
- **No:** mover la cabecera, los botones de guardar/descargar/traducir ni el reporte ATS: quedan en cada página.

## Implementation plan

1. **Tipos compartidos:** definir `ProfileSectionForm` en `frontend/src/app/shared/profile-form/profile-section.types.ts` con la forma mínima del `FormGroup` por sección y el input de idiomas.
2. **`SkillsSectionComponent`:** la sección más simple (nombre + nivel). Es la primera migración y sirve para validar el patrón.
3. **`LanguagesSectionComponent`:** nombre + nivel CEFR.
4. **`EducationSectionComponent`:** campos base más los bilingües opcionales (`degreeEs/En`, `institutionEs/En`, `fieldEs/En`, `descriptionEs/En`).
5. **`CertificationsSectionComponent`:** nombre, emisor, año, URL, más bilingües.
6. **`ProjectsSectionComponent`:** nombre, rol, URL, stack, descripción y métricas, más bilingües.
7. **`ExperienceSectionComponent`:** la más compleja; incluye detección de duplicados y el evento de ítem agregado para el autoscroll.
8. **`PersonalInfoSectionComponent` y `SummarySectionComponent`:** cabecera del perfil; reciben los controles y no manejan idiomas.
9. **Migrar `/profile`** sección por sección, manteniendo las pestañas y el guardado actual.
10. **Migrar `/cv-import`** con `languages: []`.
11. **Limpieza:** eliminar del markup de ambas páginas lo que ahora vive en los componentes y borrar estilos duplicados.
12. **Tests:** ver sección de tests.

## Tests

**Componentes (Vitest):**

- `SkillsSectionComponent` renderiza los controles existentes y agrega/quita ítems sobre el `FormArray` recibido.
- `ExperienceSectionComponent` muestra el tag de duplicado cuando el padre lo indica y emite el evento de ítem agregado.
- Con `showMetrics` en `false` no se renderiza el editor de métricas; por defecto sí.
- Ningún componente muta el form fuera de las acciones del usuario.

**Regresión de páginas:**

- `/profile` guarda el mismo payload que antes, incluidos los campos ES/EN.
- `/cv-import` aplica el borrador al perfil sin cambiar el flujo ATS.

## Acceptance criteria

- [ ] Existen los componentes de sección y los usan las dos páginas.
- [ ] `/profile` conserva pestañas ES/EN, campos bilingües, duplicados y autoscroll.
- [ ] `/cv-import` conserva su formulario de una sola lengua y el reporte ATS.
- [ ] No queda markup de secciones duplicado entre las dos páginas.
- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan.
- [ ] Verificación visual de `/profile` y `/cv-import` en ambos idiomas de interfaz.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Perder campos bilingües al migrar | Migración sección por sección; comparar payload guardado antes y después. |
| Romper la detección de duplicados | El cálculo queda en el padre; el componente solo muestra el indicador. |
| Autoscroll deja de funcionar | El evento de ítem agregado se testea explícitamente. |
| Refactor largo con muchos archivos | Sin cambios de comportamiento: se puede revisar por sección. |

## What is **not** in this spec

- Cambios en validaciones o reglas de negocio del perfil.
- Rediseño visual.
- Cambios en la importación más allá de reutilizar el formulario.
