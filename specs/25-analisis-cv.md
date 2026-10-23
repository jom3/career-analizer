# SPEC 25 — Análisis de CV

> **Status:** Approved
> **Depends on:** SPEC 05 (perfil), SPEC 06 (importación y ATS), SPEC 22 (idioma de documento y códigos de error)
> **Date:** 2026-10-23
> **Objective:** Completar el ítem 3 del MVP («CV Analysis and improvement suggestions»). Hoy solo existe el chequeo ATS al importar (7 booleanos) y los gaps del match contra una oferta. Falta un análisis del CV en sí: una nota objetiva, un diagnóstico por sección y sugerencias concretas para mejorarlo, siempre sobre datos reales del perfil.

## Scope

**In:**

- Diagnóstico determinista del perfil: 9 chequeos ponderados que dan una nota 0-100.
- Sugerencias y fortalezas redactadas por IA, ancladas al snapshot y con sección válida.
- Página `/cv-analysis` con nota, checklist, fortalezas y sugerencias accionables.
- Acceso desde el rail de navegación.

**Out:**

- Persistir el análisis o su historial (se calcula al abrir la página).
- Analizar un archivo suelto sin perfil (para eso está la importación).
- Cambiar el chequeo ATS del import.
- Reescribir el CV automáticamente.

## Decisions

- **Sí:** **nota determinista y ponderada.** Los pesos suman 100: intro 15, contacto 10, experiencia 20, métricas de experiencia 15, educación 10, skills 10, proyectos/certificaciones 10, idiomas 5, sin duplicados 5. Reproducible y auditable.
- **Sí:** **la IA solo redacta fortalezas y sugerencias**, no la nota. Si la IA falla, la página sigue funcionando con el diagnóstico determinista y sin sugerencias (degradación explícita, sin error 502).
- **Sí:** **las sugerencias apuntan a una sección conocida** (`intro`, `contact`, `experience`, `education`, `skills`, `projects`, `languages`) con una acción concreta en el idioma del documento. El backend descarta secciones inválidas.
- **Sí:** **sin persistencia.** No hay migración ni modelo nuevo; el análisis se calcula con el perfil actual, así nunca queda desactualizado.
- **Sí:** **el idioma del análisis sale de `Accept-Language`** (texto de la IA y etiquetas del frontend), consistente con el resto de la app.
- **No:** inventar logros, métricas ni secciones faltantes: las sugerencias solo proponen mejorar lo que ya existe o completar secciones vacías del perfil.

## API

`GET /cv-analysis`

```ts
interface CvAnalysisDto {
  score: number;                    // 0-100
  checks: { key: CvCheckKey; ok: boolean; detail?: string }[];
  strengths: string[];              // 0-4, idioma del documento
  suggestions: { section: CvSection; action: string }[]; // 0-4
  lang: 'es' | 'en';
  aiAvailable: boolean;             // false si la IA falló y se degradó
}
```

`CvCheckKey`: `intro` | `contact` | `experience` | `experienceMetrics` | `education` | `skills` | `projects` | `languages` | `noDuplicates`.

Las etiquetas y los mensajes de cada chequeo los traduce el frontend por `key`; el backend solo devuelve `detail` numérico cuando aporta (por ejemplo, cantidad de skills).

## Implementation plan

1. **Tipos y pesos:** `backend/src/cv-analysis/cv-analysis.types.ts` con los enums, la tabla de pesos y los tipos del DTO.
2. **Diagnóstico determinista:** `cv-analysis.service.ts` con `analyze(userId, lang)`. Calcula los 9 chequeos y la nota, detecta duplicados de skills y experiencias con la misma normalización que el frontend (minúsculas, sin acentos, espacios colapsados).
3. **Parser de IA:** `cv-analysis-parser.service.ts` con structured outputs: 2-4 fortalezas y 2-4 sugerencias, sección enumerada, sin inventar. Valida y recorta la respuesta.
4. **Degradación:** si el parser falla, el servicio devuelve `aiAvailable: false`, arrays vacíos y la nota determinista. Loguea el error, no lanza 502.
5. **Controller y módulo:** `GET /cv-analysis` protegido por el guard global, `CvAnalysisModule` registrado en `app.module.ts`.
6. **Frontend — modelos y servicio:** `core/models/cv-analysis.ts` y `core/cv-analysis.service.ts`.
7. **Frontend — página:** `cv-analysis.component` con nota, checklist traducido, fortalezas y sugerencias con su sección. Empty state cuando el perfil está vacío, con CTA a `/profile`.
8. **Frontend — navegación y rutas:** entrada «05 Análisis de CV» en el rail; «Documentos» pasa a 06. Ruta `/cv-analysis` dentro del shell.
9. **i18n es/en:** todas las claves de la página y de los 9 chequeos, con paridad verificada por el test existente.
10. **Tests:** unitarios del diagnóstico, del parser y e2e del endpoint.

## Tests

**Diagnóstico:**

- Perfil vacío → nota 0, todos los chequeos en falso salvo ninguno, y `suggestions` vacías.
- Perfil completo (todas las secciones, con métricas) → nota 100 y todos los chequeos en verdadero.
- Falta solo métricas → nota 85.
- Skills duplicados (`TypeScript` y `typescript`) → `noDuplicates` en falso y nota menor.
- Skills insuficientes (3 de 5) → `skills` en falso.

**Parser:**

- Respuesta válida → fortalezas y sugerencias normalizadas y recortadas a 4.
- Sección inválida descartada.
- Texto vacío o forma inválida → error controlado que el servicio degrada.

**E2E:**

- `GET /cv-analysis` sin sesión → 401.
- `GET /cv-analysis` autenticado con perfil → 200 con `score`, 9 chequeos y `lang`.
- Con el parser mockeado fallando → 200, `aiAvailable: false` y la nota presente.

## Acceptance criteria

- [ ] `GET /cv-analysis` devuelve nota, 9 chequeos, fortalezas, sugerencias, idioma y `aiAvailable`.
- [ ] La nota es la suma ponderada de los chequeos (pesos que suman 100) y es reproducible.
- [ ] Los duplicados se detectan con la misma normalización que el perfil (acentos y mayúsculas incluidos).
- [ ] Si la IA falla, el endpoint responde 200 con `aiAvailable: false` y la nota determinista.
- [ ] Las sugerencias con sección inválida se descartan; nunca se inventan logros ni métricas.
- [ ] `/cv-analysis` muestra nota, checklist, fortalezas y sugerencias; con perfil vacío muestra empty state con CTA.
- [ ] El rail muestra «05 Análisis de CV» y «06 Documentos».
- [ ] Textos en es/en con paridad; los chequeos se traducen por `key`.
- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La IA sugiere cosas ya presentes o inventadas | Prompt cerrado + validación de sección + recorte; la nota no depende de la IA. |
| Nota subjetiva o incomparable entre corridas | Es determinista: solo depende del perfil, no del modelo. |
| Duplicados normalizados distinto que en el frontend | Misma función de normalización y casos de prueba con acentos y mayúsculas. |
| Página vacía para perfiles nuevos | Empty state con CTA a completar el perfil. |

## What is **not** in this spec

- Historial de análisis o comparación entre versiones.
- Análisis de un archivo sin perfil.
- Reescritura automática del CV.
- Puntaje ATS del documento exportado (ya existe el del import).
