# SPEC 17 — Perfil bilingüe es/en con traducción por IA y revisión humana

> **Status:** Implemented
> **Depends on:** SPEC 05 (Candidate Profile), SPEC 06 (CV import), SPEC 14 (i18n UI)
> **Date:** 2026-08-19
> **Objective:** Convertir el Candidate Profile (fuente de verdad) en un perfil bilingüe es/en: cada campo de texto editable del perfil pasa a tener una versión por idioma, un endpoint de traducción por IA (adaptación natural profesional, sin traducir nombres propios) genera la versión en el otro idioma para que el usuario la revise y edite antes de guardar, y el editor de perfil muestra/edita ambos idiomas. Este spec NO cambia aún el idioma de los documentos generados (eso es SPEC 18); aquí solo se prepara el perfil para que existan ambas versiones.

## Scope

**In:**

- **Modelo de datos bilingüe (backend/Prisma)**: los campos de texto editable del perfil pasan a tener una versión por idioma (`es` / `en`). Se hace con columnas nuevas `*_es` / `*_en` en cada modelo (`Profile`, `Experience`, `Education`, `Certification`, `Project`, `Language`), conservando las columnas actuales como compatibilidad. Campos bilingües:
  - `Profile`: `headline`, `location`, `summary`.
  - `Experience`: `position`, `location`, `description`, `metrics`.
  - `Education`: `degree`, `institution`, `field`, `description`.
  - `Certification`: `name`, `issuer`.
  - `Project`: `name`, `role`, `description`, `metrics`.
  - `Language`: `name`.
- **Campos NO traducibles** (quedan como campo único, compartido por ambos idiomas): `phone`, `website`, `linkedin` (Profile), `skills.name`, `techStack` (Project), `url` (Certification/Project), fechas (`startDate`/`endDate`/`current`/`year`), `sortOrder`, `source`.
- **Endpoint de traducción del perfil** (backend):
  - `POST /profile/translate` → body `{ lang: 'es' | 'en' }` (el idioma destino). Traduce los campos del idioma de origen al idioma destino usando IA, con adaptación natural profesional (no literal) y **sin traducir nombres propios** (empresas, skills, techStack, CEFR, URLs, tecnologías). Devuelve el perfil con los campos del idioma destino completados, **sin persistir** (borrador para revisión).
  - El idioma de origen es el que tiene contenido; si ambos tienen contenido, el destino se re-traduce desde el de mayor cobertura o el primario definido en el request.
  - La IA solo recibe los campos de texto del perfil; el prompt prohíbe inventar datos, skills, empresas, logros, métricas, educación o proyectos que no existan en el perfil de origen (invariante README). Solo traduce lo que está; nunca agrega.
  - Falla con 422/502 si la respuesta no es parseable; guardia determinista que descarta campos vacíos/inventados y conserva verbatim lo no traducible.
- **Aprobación humana**: la traducción es un **borrador** (no se persiste sola). El usuario la revisa/edita y recién el `PUT /profile` guarda las versiones. No hay "auto-aplicar" sin gate humano.
- **Editor de perfil (frontend)**: muestra el idioma de la UI activa por defecto y un **selector/pestaña ES/EN** para ver y editar el otro idioma. Un botón **"Traducir al [otro idioma]"** dispara `POST /profile/translate`, llena los campos del otro idioma (en la pestaña correspondiente) y los deja pendientes de revisión/guardado.
- **Migración de perfiles existentes**: al migrar, el contenido existente (columnas actuales) se asigna al idioma detectado (heurística: presencia de acentos/caracteres propios del español → `es`, si no → `en`) o al idioma de UI activo como fallback; el otro idioma queda vacío hasta que el usuario use "Traducir". Sin pérdida de datos (se conserva el contenido original en su idioma detectado).
- **Tests**: unitarios del traductor (IA mockeada: traduce prosa, no nombres propios, no inventa, JSON inválido → 422), del service (no persiste, migración de perfiles existentes, detección de idioma), del parser de perfil (leer/guardar ambos idiomas), y e2e del flujo (traducir → revisar → guardar).

**Out of scope (para specs futuros):**

- Cambiar el idioma de los **documentos generados** (CV adaptado, carta, match, CV base) a el de la interfaz — es **SPEC 18**, que consume este perfil bilingüe.
- Traducción automática sin revisión humana.
- Traducir nombres propios, skills, techStack, CEFR o tecnologías.
- Más de dos idiomas (solo `es`/`en`).
- Detección de idioma por modelo de ML (heurística simple es/en).
- Traducción del contenido de las ofertas (`JobOffer`).

## Data model

Cambios en `backend/prisma/schema.prisma`. Se agregan columnas por idioma conservando las actuales como compatibilidad (migración `profile_bilingual`):

```prisma
model Profile {
  id         String   @id @default(cuid())
  userId     String   @unique
  // ...columnas existentes (compat)...
  headline   String?
  location   String?
  summary    String?
  // ... columnas nuevas por idioma ...
  headlineEs String?
  headlineEn String?
  locationEs String?
  locationEn String?
  summaryEs  String?
  summaryEn  String?
  // ...
}

model Experience {
  // ...
  positionEs   String?
  positionEn   String?
  locationEs   String?
  locationEn   String?
  descriptionEs String?
  descriptionEn String?
  metricsEs    String[]
  metricsEn    String[]
}

model Education {
  degreeEs        String?
  degreeEn        String?
  institutionEs   String?
  institutionEn   String?
  fieldEs         String?
  fieldEn         String?
  descriptionEs   String?
  descriptionEn   String?
}

model Certification {
  nameEs    String?
  nameEn    String?
  issuerEs  String?
  issuerEn  String?
}

model Project {
  nameEs        String?
  nameEn        String?
  roleEs        String?
  roleEn        String?
  descriptionEs String?
  descriptionEn String?
  metricsEs     String[]
  metricsEn     String[]
}

model Language {
  nameEs String?
  nameEn String?
}
```

Convenciones:

- Las columnas `*_es`/`*_en` son la fuente para el idioma correspondiente. Las columnas originales (`headline`, `position`, etc.) se conservan para retrocompatibilidad y se **sincronizan** con el idioma detectado/primario en cada guardado (así los consumidores que aún usan la columna única siguen funcionando hasta SPEC 18).
- Campos no traducibles (skills, techStack, urls, fechas, nivel, source) no tienen variante por idioma.
- `metricsEs`/`metricsEn`: listas paralelas; si el usuario agrega/edita una métrica en un idioma, el otro queda sin ese ítem hasta traducir (no se fuerza paridad).
- DTO: `ProfileDto` expone por cada campo bilingüe un objeto `{ es?: string; en?: string }` (o `{ es: string[]; en: string[] }` para metrics) manteniendo también los campos planos actuales para no romper el frontend de una vez. El frontend nuevo lee/escribe el objeto por idioma.

## Implementation plan

Cada paso deja el sistema compilable y funcionando.

1. **Schema y migración**: agregar las columnas `*_es`/`*_en` a `Profile`, `Experience`, `Education`, `Certification`, `Project`, `Language`. Ejecutar `prisma migrate dev` (nombre `profile_bilingual`) y `prisma generate`.
2. **Migración de datos existentes**: script/consulta que asigna el contenido de las columnas originales al idioma detectado (heurística de acentos → es, si no en; fallback es) llenando las columnas `*_es`/`*_en` correspondientes. El otro idioma queda null. Se ejecuta una vez (no en cada arranque).
3. **Service de perfil bilingüe**: actualizar `ProfileService.replaceForUser` para leer/escribir ambos idiomas y sincronizar las columnas únicas con el idioma detectado/primario. Actualizar `ProfileDto` para aceptar `{ es, en }` y devolverlos.
4. **Traductor (parser IA)**: crear `backend/src/profile/profile-translator.service.ts` que recibe el perfil (idioma de origen) y el idioma destino, llama a OpenAI (structured outputs) con el prompt de traducción natural profesional, sin nombres propios, sin inventar, y devuelve solo los campos del idioma destino. Guardia determinista que descarta vacíos y conserva verbatim lo no traducible. Tests con IA mockeada.
5. **Endpoint de traducción**: `POST /profile/translate` en `ProfileController` (body `{ lang }`). Resuelve el idioma de origen, traduce, devuelve el perfil con el idioma destino completado **sin persistir** (200). Si el JSON de la IA no es parseable o la forma es inválida → 502/422. e2e.
6. **Frontend — modelos**: actualizar `frontend/src/app/core/models/profile.ts` para los objetos `{ es, en }` por campo bilingüe.
7. **Frontend — editor con pestañas**: en `profile.component`, agregar el selector/pestaña ES/EN que cambia qué idioma se edita, y el botón **"Traducir al [otro idioma]"** que llama `POST /profile/translate`, llena la pestaña del otro idioma y deja todo pendiente de guardar (el botón "Guardar perfil" persiste vía `PUT /profile`).
8. **Sweep de retrocompatibilidad**: verificar que los consumidores actuales (export de CV base, CV adaptado, carta, match) sigan funcionando leyendo las columnas únicas sincronizadas (no cambian hasta SPEC 18).
9. **Verificación final**: `npm run build:all`, `npm run lint:all`, `npm run test:all` (frontend y backend), y flujo manual (perfil existente en español → detectar es → pestaña EN vacía → "Traducir al inglés" → revisar/editar → guardar → recargar → ambos idiomas persistidos; cambiar el idioma de la UI → el editor muestra la pestaña del idioma activo).

## Acceptance criteria

- [ ] Existen las columnas `*_es`/`*_en` en los 6 modelos; la migración `profile_bilingual` está aplicada y el client regenerado.
- [ ] Los perfiles existentes se migran sin pérdida: el contenido original queda en su idioma detectado (`es` si tiene acentos/caracteres españoles, si no `en`, fallback `es`), el otro idioma queda vacío.
- [ ] `POST /profile/translate` con `lang` destino devuelve el perfil con los campos del idioma destino completados, en adaptación natural profesional, **sin traducir nombres propios** (empresas, skills, techStack, CEFR, URLs) y **sin inventar** datos que no estén en el origen; **no persiste** (nada cambia en DB hasta `PUT /profile`).
- [ ] La IA recibe solo los campos de texto del perfil; el prompt prohíbe inventar/omitir datos reales; JSON inválido o forma inválida → 502/422 (testeado).
- [ ] El botón "Traducir al [otro idioma]" en `/profile` llena la pestaña del otro idioma (pendiente de revisión) y solo "Guardar perfil" persiste las versiones (`PUT /profile`).
- [ ] El editor muestra por defecto el idioma de la UI activa y permite cambiar de pestaña para ver/editar el otro idioma; al recargar, ambos idiomas persisten y se muestran correctamente.
- [ ] Los campos no traducibles (skills, techStack, URLs, fechas, nivel) quedan únicos y compartidos; no se duplican por idioma.
- [ ] Retrocompatibilidad: el CV base exportado (SPEC 07), CV adaptado, carta y match siguen funcionando con las columnas únicas sincronizadas (sin cambios en SPEC 18 aún).
- [ ] `npm run build:all`, `npm run lint:all` y `npm run test:all` pasan (frontend y backend).

## Decisions

- **Sí:** **perfil bilingüe con campos por idioma** (`*_es`/`*_en`), no perfiles paralelos. Mantiene un solo perfil como fuente de verdad, con cada campo de texto en ambas versiones. Los no traducibles (skills, techStack, CEFR, fechas, URLs) quedan únicos.
- **Sí:** **traducción por IA con revisión humana** (borrador que no persiste solo). La IA hace adaptación natural profesional (no literal, invariante README), **sin traducir nombres propios** y sin inventar; el usuario revisa/edita y guarda con `PUT /profile`. El gate humano preserva la invariante de no inventar y la calidad del contenido.
- **Sí:** **endpoint `POST /profile/translate` separado** (no traducción inline en el PUT), para que el borrador sea explícito y revisable antes de persistir.
- **Sí:** **migración de perfiles existentes con detección de idioma por heurística simple** (acentos → es, si no en, fallback es). Sin pérdida de datos; el otro idioma se completa con "Traducir" cuando el usuario lo decida.
- **Sí:** **editor con pestañas ES/EN + botón "Traducir al [otro idioma]"**. La pestaña activa es la del idioma de la UI por defecto; el botón llena el otro idioma y queda pendiente de guardar.
- **No:** cambiar el idioma de los documentos generados (SPEC 18), traducción sin revisión, traducir nombres propios/skills/techStack/CEFR, más de dos idiomas, detección por ML, traducción de ofertas.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La IA inventa contenido al traducir | El prompt prohíbe agregar datos ausentes; la guardia determinista descarta campos que no corresponden a campos de origen; el resultado es borrador con revisión humana obligatoria antes de guardar. |
| La IA traduce nombres propios o skills | Prompt explícito de no traducir nombres propios/skills/techStack/CEFR; estos campos no se envían como traducibles; guardia que conserva verbatim lo no traducible. |
| Romper los consumidores actuales (export, adaptado, carta, match) | Se conservan las columnas únicas y se sincronizan con el idioma detectado/primario en cada guardado; los consumidores no cambian hasta SPEC 18. |
| Perfiles existentes mal clasificados de idioma | Heurística con fallback a es; el usuario puede corregir editando la pestaña del otro idioma; no se pierde el contenido original. |
| Métricas fuera de paridad entre idiomas | `metricsEs`/`metricsEn` son listas independientes; no se fuerza paridad; la traducción las completa y el usuario revisa. |
| El editor bilingüe complica la UX del perfil | Pestañas ES/EN claras; el idioma de UI es el activo por defecto; botón de traducir como acción explícita. |
| Costo de las llamadas de IA de traducción | Solo `POST /profile/translate` dispara IA (acción explícita del usuario); `PUT`/`GET`/lecturas nunca llaman a la IA. |

## What is **not** in this spec

- Cambiar el idioma de los documentos generados (CV adaptado, carta, match, CV base) a el de la interfaz — **SPEC 18**.
- Traducción automática sin revisión humana.
- Traducir nombres propios, skills, techStack, CEFR o tecnologías.
- Más de dos idiomas.
- Detección de idioma por modelo de ML.
- Traducción del contenido de las ofertas (`JobOffer`).

Cada uno, si llega, tendrá su propio spec.
