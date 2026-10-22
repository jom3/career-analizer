# Datos de evaluación

Datos **sintéticos**: empresas, instituciones y personas son ficticias. No usar datos reales de candidatos.

- `profiles.json`: snapshots de perfil (forma de `ProfileSnapshot`).
- `offers.json`: ofertas (forma de `JobOfferDraft` más `id`).
- `cases.json`: pares perfil-oferta con cobertura exacta (determinista) y rango orientativo de score de IA.
- `skill-mentions.json`: casos de regresión para la comparación de skills por palabra completa (SPEC 21).
- `letter-validation.json`: casos para los validadores de carta (SPEC 21).

Los rangos `aiScoreRange` son orientativos: el score de IA puede variar dentro del rango; la cobertura es exacta.

Los rangos se recalibraron tras la primera corrida de `npm run test:eval` con la rúbrica con topes de senioridad (ningún match perfecto supera ~80, y un perfil sin evidencia no pasa de 40). Expresan la relación esperada, no un valor exacto: cobertura 100 → banda alta, cobertura 0 → banda baja.
