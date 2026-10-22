# Datos de evaluación

Datos **sintéticos**: empresas, instituciones y personas son ficticias. No usar datos reales de candidatos.

- `profiles.json`: snapshots de perfil (forma de `ProfileSnapshot`).
- `offers.json`: ofertas (forma de `JobOfferDraft` más `id`).
- `cases.json`: pares perfil-oferta con cobertura exacta (determinista) y rango orientativo de score de IA.
- `skill-mentions.json`: casos de regresión para la comparación de skills por palabra completa (SPEC 21).
- `letter-validation.json`: casos para los validadores de carta (SPEC 21).

Los rangos `aiScoreRange` son orientativos: el score de IA puede variar dentro del rango; la cobertura es exacta.
