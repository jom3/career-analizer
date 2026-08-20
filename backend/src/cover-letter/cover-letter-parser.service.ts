import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import type { ProfileSnapshot } from '../job-match/profile-util';

export interface CoverLetterMatchInsight {
  overallScore: number | null;
  overallJustification: string | null;
  dimensions: {
    key: string;
    score: number | null;
    justification: string;
  }[];
  gaps: {
    name: string;
    status: 'HAVE' | 'MISSING' | 'PARTIAL';
  }[];
}

export interface CoverLetterGenerationInput {
  profile: ProfileSnapshot;
  offer: {
    title: string | null;
    company: string | null;
    responsibilities: string[];
    requiredSkills: string[];
    preferredSkills: string[];
    experienceSummary: string | null;
    keywords: string[];
  };
  recruiterName: string | null;
  note: string | null;
  lang: 'es' | 'en';
  match: CoverLetterMatchInsight | null;
}

export interface CoverLetterGenerationResult {
  content: string;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Redacta el cuerpo de la carta de motivación (saludo → cierre) con la API de
// OpenAI (structured outputs). Solo produce prosa libre a partir del snapshot
// real del perfil y de la oferta: la fecha, el asunto y la firma los arma el
// sistema al renderizar, y el borrador jamás se persiste sin edición humana.
@Injectable()
export class CoverLetterParserService {
  private readonly model: string;

  constructor(
    configService: ConfigService,
    private readonly openaiService: OpenaiService,
  ) {
    this.model = configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  get modelName(): string {
    return this.model;
  }

  async generate(
    input: CoverLetterGenerationInput,
  ): Promise<CoverLetterGenerationResult> {
    const draft = await this.draft(input);
    try {
      return await this.audit(draft.content);
    } catch (error) {
      // El auditor es best-effort: si falla, se entrega el borrador sin auditar.
      console.error(
        'OpenAI cover letter audit failed, returning un-audited draft:',
        error,
      );
      return draft;
    }
  }

  // Redacta el borrador en un primer llamado; no se expone públicamente.
  private async draft(
    input: CoverLetterGenerationInput,
  ): Promise<CoverLetterGenerationResult> {
    try {
      const messages: {
        role: 'system' | 'user';
        content: string;
      }[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(input.lang),
        },
        {
          role: 'user',
          content: `Job offer:\n${JSON.stringify(input.offer)}`,
        },
        {
          role: 'user',
          content: `Candidate profile snapshot:\n${JSON.stringify(input.profile)}`,
        },
        {
          role: 'user',
          content: `Recruiter name (empty means a generic greeting): ${input.recruiterName ?? ''}\nAdditional note from the candidate: ${input.note ?? ''}`,
        },
      ];
      if (input.match) {
        messages.push({
          role: 'user',
          content: `Job match analysis between the candidate profile and the job offer (use it to pick the strongest real evidence to align with the offer; NEVER claim anything the profile snapshot does not contain):\n${JSON.stringify(input.match)}`,
        });
      }
      const completion =
        await this.openaiService.client.chat.completions.create({
          model: this.model,
          messages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'cover_letter',
              strict: true,
              schema: this.buildSchema(),
            },
          },
        });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('empty response');
      }
      const raw = JSON.parse(content) as Record<string, unknown>;
      const normalized = this.normalize(raw);
      if (!normalized) {
        throw new Error('invalid shape');
      }
      return normalized;
    } catch (error) {
      console.error('OpenAI cover letter generation failed:', error);
      throw new BadGatewayException(
        'La IA no pudo redactar la carta. Intenta de nuevo.',
      );
    }
  }

  // Segunda pasada de edición: recibe el borrador y devuelve la versión
  // corregida aplicando solo reglas de auditoría, sin inventar contenido.
  private async audit(content: string): Promise<CoverLetterGenerationResult> {
    const messages: { role: 'system' | 'user'; content: string }[] = [
      {
        role: 'system',
        content: this.buildAuditPrompt(),
      },
      {
        role: 'user',
        content: content,
      },
    ];
    const completion = await this.openaiService.client.chat.completions.create({
      model: this.model,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'cover_letter_audit',
          strict: true,
          schema: this.buildSchema(),
        },
      },
    });
    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('empty audit response');
    }
    const raw = JSON.parse(responseContent) as Record<string, unknown>;
    const normalized = this.normalize(raw);
    if (!normalized) {
      throw new Error('invalid audit shape');
    }
    return normalized;
  }

  private buildSystemPrompt(lang: 'es' | 'en'): string {
    const writeIn =
      lang === 'es'
        ? 'Write the letter in Spanish.'
        : 'Write the letter in English.';
    return [
      'You write a natural, human-sounding motivation cover letter for a candidate applying to a specific job. It must not sound machine-generated.',
      writeIn,
      'You receive the real candidate profile snapshot, the job offer analysis, an optional recruiter name, an optional note from the candidate, and the job match analysis between profile and offer.',
      'The letter body (stored in "content") goes from the greeting to the closing line ("Sincerely," / "Atentamente,"). The date, the subject line and the signature name are added deterministically elsewhere: do NOT include them.',
      'The greeting must use the recruiter name when provided ("Dear {name},") and a generic localized greeting otherwise ("Dear Hiring Team," / "Estimado equipo de selección,").',
      '======================================================',
      'EMPLOYER NAMES — DO NOT MENTION',
      '======================================================',
      'Never name the candidate\'s current or past employers, clients, or companies (e.g. "en la Clínica Dental Rivera", "en el Centro Boliviano Americano"). Describe the experience by its nature instead: the type of project, the role, or the domain, without the proper name.',
      'Example transformation:',
      '- Instead of: "Diseñé una plataforma para la Clínica Dental Rivera que..."',
      '- Write: "Diseñé una plataforma de gestión interna para un centro de salud que..."',
      '- Instead of: "En mi rol en el Centro Boliviano Americano, desarrollé..."',
      '- Write: "En un proyecto de gestión de proyectos para una institución educativa, desarrollé..."',
      'If the profile has no clear domain/sector to generalize to, drop the location phrase entirely and start straight from the action: "Diseñé una plataforma que permite..." This rule applies to ALL past employers/clients in the letter, not just the first one mentioned. The target company name (the one the candidate is applying to) is a separate case — see the "company name" rule below, which still allows it once if organic.',
      '======================================================',
      'MANDATORY PROCESS (do not skip either step, do not show step 1 in the output)',
      '======================================================',
      'Step 1 — List in bullet form ONLY verifiable facts pulled from the profile, offer, and match analysis: concrete projects, technologies used, tasks performed, numeric data if present, education, certifications. No adjectives. No conclusions. No connectors. No "lo que permitió/facilitó" phrasing — if a fact caused a result, write them as TWO separate bullets, not one bullet with a connector. No employer/client names — generalize those to domain/sector at this stage already. Just facts, one per bullet.',
      'Step 2 — Write the letter using ONLY the bullets from step 1, converted into natural prose. Every sentence must add a NEW fact. If you feel the urge to write a clause that explains, summarizes, or justifies a fact you already stated ("which allowed...", "demonstrating...", "key for...", "ensuring...", "lo que permitió...", "lo que facilitó...", "contribuyendo a...", "priorizando...", "que respaldan...", "que certifican..."), STOP — do not write it. That urge means a bullet is missing; go back to step 1, and either add a more concrete fact there or leave the sentence as a plain, standalone fact.',
      'MECHANICAL FIX — apply this automatically while drafting, don\'t wait for the self-check: any time you are about to write "[hecho/herramienta], lo que permitió/facilitó/optimizó/garantizó [resultado]", STOP mid-draft and split it at the comma into two independent sentences instead: "[Hecho/herramienta].  [Resultado como hecho propio, sin conector]." Do this the moment the construction appears in your draft, not after. This fix applies to ANY trailing gerund clause or "que + verbo" clause, not only "lo que" constructions — see GERUND CLAUSE and TRAILING "QUE" CLAUSE rules below.',
      'Examples of the mechanical fix:',
      '- Before: "Usé Angular, NestJS y PostgreSQL, lo que permitió crear herramientas similares a Miro."',
      '- After: "Usé Angular, NestJS y PostgreSQL para crear herramientas similares a Miro." (or, if you prefer two sentences: "Usé Angular, NestJS y PostgreSQL. El resultado: herramientas similares a Miro.")',
      '- Before: "Optimicé bases de datos SQL, lo que me permite gestionar eficientemente la información."',
      '- After: "Optimicé el rendimiento de consultas en bases de datos SQL." (drop the vague result entirely if it has no concrete datum — do not keep a diluted version of the deleted clause)',
      '- Before: "Automaticé respuestas con un bot, lo que facilitó la interacción con múltiples agentes."',
      '- After: "Automaticé respuestas con un bot que soporta múltiples agentes simultáneos." (fold the real information into a plain description, not a justification clause)',
      '- Before: "Este proyecto optimiza bases de datos PostgreSQL, contribuyendo así a la eficiencia del manejo de la información."',
      '- After: "El proyecto optimiza bases de datos PostgreSQL." (delete the "contribuyendo a" clause entirely — it adds no new fact, only a vague adjective)',
      '- Before: "Utilicé JavaScript y React, priorizando la mantenibilidad y el crecimiento futuro del software."',
      '- After: "Utilicé JavaScript y React para construir componentes reutilizables." (only keep a purpose clause if it names something concrete; otherwise delete it)',
      '- Before: "Construí APIs RESTful, facilitando flujos de datos entre frontend y backend."',
      '- After: "Construí las APIs RESTful que conectan el frontend con el backend." (fold the real content into the main clause, delete the "facilitando" tail)',
      '- Before: "Cuento con certificaciones en Angular y React, que respaldan mis habilidades técnicas."',
      '- After: "Cuento con certificaciones en Angular y React." (delete the "que respaldan..." tail entirely — it adds no new fact)',
      '======================================================',
      'WORKED EXAMPLE (follow this pattern exactly)',
      '======================================================',
      'Facts extracted (step 1, for illustration only):',
      '- Built an internal platform for a dental clinic (client not named): task management, document handling, reporting',
      '- Stack: Angular, NestJS, PostgreSQL',
      '- Similar in scope to Miro + Notion + Trello combined',
      '- Implemented JWT auth and role-based authorization',
      '- Built and consumed REST APIs connecting frontend/backend',
      '- Degree in Computer Engineering',
      '- Job offer requires: React, Node.js, PostgreSQL, secure auth',
      'GOOD letter (facts only, no interpretation, no forced connection, no employer name, no trailing gerund/justification clauses):',
      '"Diseñé y construí una plataforma de gestión interna para un centro de salud que combina tareas, documentos y reportes — similar en alcance a Miro, Notion y Trello juntos — usando Angular, NestJS y PostgreSQL. Implementé autenticación JWT y autorización por roles, y construí las APIs REST que conectan el frontend con el backend.',
      '',
      'Tengo formación en Ingeniería Informática y experiencia práctica con JavaScript, TypeScript y React en proyectos anteriores.',
      '',
      'Estoy disponible para una entrevista esta semana."',
      'BAD version of the same content (what NOT to do — notice each red flag):',
      '"Diseñé y construí una plataforma para la Clínica Dental Rivera, lo que demostró mi capacidad para crear soluciones integrales. [names the employer — DELETE the name, generalize to sector; also self-evaluative — DELETE]',
      "Usé Angular, NestJS y PostgreSQL, tecnologías clave para el desarrollo backend. [forced connection via 'clave para', and 'clave' is a banned empty adjective — DELETE the clause, keep only the fact]",
      'Esta plataforma permite gestionar tareas, facilitando la comunicación del equipo. [mid-sentence gerund clause hanging off a restated fact — DELETE ENTIRELY, adds nothing new]',
      'Implementé autenticación JWT, garantizando la seguridad de la información. [closing gerund justifying the fact — DELETE the gerund clause]',
      "Mejoré el rendimiento de las consultas, lo que permitió una gestión más eficiente. [mid-sentence 'lo que permitió' clause + empty adjective 'eficiente' — apply the MECHANICAL FIX: \"Mejoré el rendimiento de las consultas.\" and stop there]",
      "Este proyecto optimiza bases de datos, contribuyendo así a la eficiencia del manejo de información. [opens referring back to something already stated AND trails into a 'contribuyendo a' gerund clause with an empty adjective — DELETE the whole second half]",
      "Cuento con certificaciones en tecnologías relevantes. [empty adjective 'relevantes' with no named technology or fact — DELETE or replace with the actual certification names — see SPECIFIC BANNED PHRASE rule below]",
      'Construí APIs RESTful, facilitando flujos de datos entre frontend y backend. [trailing gerund clause adding no new fact — fold into the main clause instead]',
      'Esto se alinea perfectamente con los requerimientos del puesto. [forced connection, vague, no new fact — DELETE ENTIRELY]"',
      'Notice the GOOD version never explains why a fact matters, never names the employer, never uses "lo que permitió/facilitó" or any other trailing justification gerund or "que" clause, never uses an empty adjective without a fact attached, and never lets a sentence trail off into a clause that restates what was just said — it just states facts back to back, lets the reader connect them to the job requirements on their own, and closes with a plain action.',
      '======================================================',
      'CLOSING LINE — DEDICATED EXAMPLES (this is the rule that slips through most)',
      '======================================================',
      'The closing line is ONLY a concrete next step or availability statement. It must NOT restate contribution, teamwork, or goals in any form — even softened or paraphrased.',
      'BAD closings (all forbidden, including partial variants):',
      '- "Estoy disponible para conversar más sobre esta oportunidad y cómo puedo contribuir a su equipo."',
      '- "Quedo atento a su respuesta para coordinar una entrevista."',
      '- "Espero con interés poder conversar sobre cómo puedo aportar al equipo."',
      '- "Me encantaría discutir cómo mi experiencia puede contribuir al crecimiento de [company]."',
      '- "Estoy disponible para explorar cómo mis capacidades pueden encajar en su equipo."',
      'GOOD closings (concrete action only, nothing else attached):',
      '- "Estoy disponible para una entrevista esta semana."',
      '- "Puedo coordinar una llamada en los próximos días."',
      '- "Quedo disponible para una entrevista en el horario que les resulte conveniente."',
      'Rule of thumb: if the closing sentence contains "equipo", "aportar", "contribuir", "crecimiento", "objetivos", or "éxito" in reference to the company, delete that clause. The closing is about scheduling next steps, not about restating value.',
      '======================================================',
      'CONTENT RULES',
      '======================================================',
      '1. Open with the strongest real fact or achievement from the profile. Do NOT open with "My name is X and I am [position]" nor "As [position], I have been...".',
      '2. Use the single most relevant real achievement or project from the profile that connects to the job, with one concrete datum (number, percentage, scale, time span) IF the profile declares it. If no numeric datum exists, describe the outcome concretely anyway: what changed, what was solved, what was delivered. Never fall back on vague adjectives such as "efficient", "advanced", "optimal", "comprehensive", "relevant", "advanced-level".',
      '3. If the offer analysis shows something specific about the company (product, market, particular stack), weave it in as natural context of a phrase, NOT as a justification.',
      '4. When the candidate provided a note or message for the recruiter, make that note the main angle or hook of the letter, not a paragraph appended at the end.',
      '5. Never name the candidate\'s past employers or clients — see the "EMPLOYER NAMES" section above.',
      '======================================================',
      'FORBIDDEN PATTERNS (the pattern itself, not just the literal words)',
      '======================================================',
      '1. Generic enthusiasm, any phrasing: "I am passionate about", "I am excited", "I am interested", "I am motivated", "this attracts me".',
      '2. Forced connection between a skill/fact and the job or company. This includes ALL of these paraphrases and any equivalent: "is key for", "is essential for", "is fundamental for", "matches the needs of", "aligns with", "is in line with", "is relevant to", "is suited to", "coincides with", "son requisitos clave/fundamentales para". Any sentence shaped like "[fact] + [connector] + [job/company]" must be deleted; state the fact alone.',
      '3. Self-evaluative phrases that interpret your own achievement: "this demonstrates...", "which reflects...", "evidencing my ability to...", "showing that I...".',
      '4. Empty adjectives not backed by a datum: innovative, advanced, robust, optimal, efficient, comprehensive, significant, key, essential, relevant, fundamental (as a bare modifier). Only usable glued to a specific number or fact, never alone.',
      '5. GERUND CLAUSE RULE (expanded): trailing clauses that summarize or justify a fact just stated — ANY gerund construction, not only "lo que permitió". This includes "ensuring...", "guaranteeing...", "facilitando...", "permitiendo...", "logrando...", "asegurando...", "contribuyendo a...", "priorizando...", "buscando...", "aportando...", as well as "which/lo que" constructions ("which allowed...", "lo que permitió...", "lo que facilitó...", "lo que me permite..."). This applies MID-SENTENCE too, not only at paragraph endings. Apply the MECHANICAL FIX the moment any such construction appears in a draft. Test: remove the clause — if the sentence still stands as a complete, standalone fact without it, the clause was decorative and must be deleted.',
      '6. TRAILING "QUE" CLAUSE RULE: the trailing-justification pattern also includes "que + verb" constructions attached to a fact just stated, not only gerunds: "que respaldan...", "que certifican...", "que confirman...", "que avalan mis habilidades/conocimientos/formación", "que demuestran...". Treat these identically to the GERUND CLAUSE rule — delete them, don\'t rewrite them, since they add no new fact and only restate that the fact "supports" or "backs" something.',
      '7. Generic closings: see the dedicated CLOSING LINE section above — this rule is treated with zero tolerance since it is the most common failure.',
      "8. Do not mention the target company's name more than once in the whole body, unless it appears organically inside a sentence with real content. Do not mention any past employer or client name at all — see EMPLOYER NAMES section.",
      '9. Sentences that open referring to something already stated ("This project...", "This...", "That experience...") and then interpret or restate it — delete these completely, don\'t rewrite them.',
      '10. One idea per sentence: if a sentence states a fact AND explains its meaning or generic impact, split it and delete the second half.',
      '11. ZERO-TOLERANCE EMPTY-ADJECTIVE LIST: these exact words/forms are banned unless immediately followed by a number, percentage, or a specifically named fact: "clave", "relevante(s)", "eficaz/eficaces", "eficiente(s)", "fundamental(es)", "avanzado(a/s)", "óptimo(a/s)", "sólido(a/s)" (when describing skills in the abstract, e.g. "experiencia sólida en X" — this is a soft-empty adjective too). Before finalizing, scan the draft for each of these words individually: if found without an adjacent number or named specific, delete the word and reword the phrase around it — do not just soften it to a synonym, since synonyms of banned adjectives are still banned.',
      '12. SPECIFIC BANNED PHRASE (recurring failure — zero tolerance, exact match): "certificaciones en tecnologías relevantes" and any close variant ("cursos en tecnologías relevantes", "formación en tecnologías relevantes", "certificaciones en tecnologías clave") is banned outright. When listing certifications, state them as a plain list with no qualifying adjective before "tecnologías": "certificaciones en Angular, React y Node.js" — full stop, no adjective needed between "certificaciones/cursos" and the technology names.',
      '======================================================',
      'FORMAT',
      '======================================================',
      '- Maximum 180 words.',
      '- Sentences of varying length. Avoid forced connectors: "moreover", "on the other hand", "in that regard", "furthermore", "likewise".',
      "- Self-confident tone about the candidate's experience; never pleading.",
      '======================================================',
      'FINAL SELF-CHECK BEFORE DELIVERING',
      '======================================================',
      'Review the letter sentence by sentence and ask these questions:',
      'a) "Would this sentence work for any candidate at any company by changing two words?" If yes → rewrite with a specific fact, or delete.',
      'b) "Does this sentence add a NEW fact, or does it interpret/summarize/justify a fact from a previous sentence — anywhere in the sentence, including mid-sentence clauses after a comma?" If the latter → delete that clause (or the whole sentence), don\'t rewrite it.',
      'c) "Does the closing sentence contain any word referencing team, contribution, growth, or goals?" If yes → replace it with a plain action from the GOOD closings list above.',
      'd) "Does any sentence name a past employer or client?" If yes → remove the name and generalize to the domain/sector, or drop the phrase entirely per the EMPLOYER NAMES section.',
      "e) \"Does any sentence contain a trailing gerund clause, a trailing 'que + verbo' clause, or a 'lo que permitió/facilitó' construction, in ANY form (contribuyendo, priorizando, garantizando, que respaldan, que certifican, etc.)?\" If yes → apply the MECHANICAL FIX and split or delete it.",
      'f) "Does any sentence contain a word from the ZERO-TOLERANCE EMPTY-ADJECTIVE LIST without a number or named fact next to it?" If yes → delete the word and reword.',
      'FINAL PASS — LITERAL WORD SEARCH (separate from the sentence-by-sentence check above): after finishing the sentence-by-sentence review, do one more pass where you literally search your own draft text for each of these roots: "clave", "relevante", "eficien", "eficaz", "efectivo", "fundamental", "avanzad", "óptim", "sólid". These are a hard filter, not stylistic suggestions — if any match is found, it must be removed, no exceptions, even if the sentence "reads well" without it.',
      'After any deletion or rewrite, re-run the full check on the resulting letter — a fixed sentence can still fail a different rule. Do NOT show the bullets or the review process: output only the final letter.',
      '======================================================',
      'FACTUAL GROUNDING (non-negotiable)',
      '======================================================',
      'NEVER claim companies, positions, skills, achievements, metrics, education, certifications or projects that are NOT present in the candidate profile snapshot. Never invent a skill the offer requires but the profile lacks; if the match shows a skill as MISSING or PARTIAL, do not claim it.',
      'The match analysis is guidance to pick the strongest real evidence in the profile snapshot: never assert something the snapshot does not contain.',
      'The additional note is the only extra user information you may use, and only when it fits naturally (e.g. where they saw the vacancy, availability). Never invent facts the note does not state.',
      'No keyword stuffing, no detached keyword lists.',
    ].join(' ');
  }

  private buildAuditPrompt(): string {
    return [
      "You are an editor, not a writer. You receive a cover letter that was already generated by another process. Your ONLY job is to detect and remove specific forbidden patterns, then return the corrected letter. You do NOT rewrite tone, you do NOT add new content, you do NOT rephrase sentences that don't violate a rule below. Minimal intervention: touch only what violates a rule, leave everything else exactly as written.",
      'You receive the letter body only (from greeting to closing line). Do not add or remove the greeting or closing line structure — only edit within it.',
      '======================================================',
      'WHAT TO SCAN FOR (apply each rule independently, in this order)',
      '======================================================',
      'RULE 1 — EMPLOYER/CLIENT NAMES',
      'Any proper name of a past employer or client (e.g. "Clínica Dental Rivera", "Centro Boliviano Americano") must be removed and generalized to the sector/domain ("un centro de salud", "una institución educativa"), or the phrase dropped entirely if no clear domain exists. The target company (the one being applied to) may appear once — leave that instance alone.',
      'RULE 2 — SENTENCES REFERRING BACK TO A PRIOR SENTENCE',
      'Any sentence that opens with "Este/Esta/Estos/Estas [noun]...", "Este proyecto...", "Esta plataforma...", "That experience..." and then goes on to interpret, summarize, or restate what was just said (rather than introducing a genuinely new noun/subject) — delete the interpretive part, or the whole sentence if nothing new remains.',
      'RULE 3 — TRAILING GERUND / "QUE" / "LO QUE" JUSTIFICATION CLAUSES',
      'Find any clause — anywhere in a sentence, not just at the end — of these shapes:',
      '- "..., lo que permitió/facilitó/optimizó/garantizó/asegura/refuerza [X]"',
      '- "..., [gerundio: facilitando/permitiendo/logrando/asegurando/garantizando/contribuyendo a/priorizando/buscando/aportando] [X]"',
      '- "..., que respalda(n)/certifica(n)/confirma(n)/avala(n)/demuestra(n) [X]"',
      'Test: remove the clause. If the sentence still reads as a complete, standalone fact without it, the clause was decorative — DELETE the clause (keep the rest of the sentence intact). Do not rewrite it into a softer version; cut it and let the sentence end at the fact.',
      'RULE 4 — FORCED CONNECTION TO THE JOB/COMPANY',
      'Any sentence shaped like "[skill/fact] + is key/essential/fundamental/relevant for + [job/company]", or paraphrases: "coincide con", "se alinea con", "está en línea con", "es adecuado para", "son requisitos clave para". Delete the connecting clause; keep the fact alone if it stands on its own, otherwise delete the full sentence.',
      'RULE 5 — SELF-EVALUATIVE PHRASES',
      'Any clause where the candidate interprets their own achievement: "esto demuestra...", "lo cual refleja...", "evidenciando mi capacidad de...", "lo cual demuestra que...". Delete the clause.',
      'RULE 6 — EMPTY ADJECTIVES (ZERO TOLERANCE)',
      'Search literally for these word roots, case-insensitive, anywhere in the text: "clave", "relevante", "eficien", "eficaz", "efectivo", "fundamental", "avanzad", "óptim", "sólid", "innovador", "integral" (when used as a vague modifier, e.g. "sistema integral" with no further specifics), "robust". If found WITHOUT an adjacent number, percentage, or specifically named fact right next to it, delete the word. If deleting it leaves an awkward gap (e.g. "tengo experiencia en"), close the sentence naturally without adding a new adjective back in.',
      'RULE 7 — SPECIFIC BANNED PHRASES (exact match, case-insensitive)',
      '- "tecnologías relevantes" / "tecnologías clave" (in any surrounding phrase about certifications or skills) → replace with just the technology names, no adjective.',
      '- "esto se alinea con los requerimientos del puesto" / any close paraphrase → delete entirely.',
      '- "quedo atento a su respuesta" / "espero con interés su respuesta" / "espero poder conversar sobre cómo puedo aportar/contribuir" → replace with a plain closing (see RULE 8).',
      'RULE 8 — GENERIC CLOSING LINE',
      'The closing sentence must be ONLY a concrete next step (interview, call, availability) with no reference to "equipo", "aportar", "contribuir", "crecimiento", "objetivos", "éxito" tied to the company. If the closing violates this, replace it with one of: "Estoy disponible para una entrevista esta semana." / "Puedo coordinar una llamada en los próximos días." / "Quedo disponible para una entrevista en el horario que les resulte conveniente." Pick whichever fits the surrounding tone best; do not invent a different one.',
      'RULE 9 — COMPANY NAME REPEATED VACUOUSLY',
      "If the target company's name appears more than once and the second mention adds no real content, delete that second mention or replace it with nothing (fold the sentence around it).",
      '======================================================',
      'PROCESS',
      '======================================================',
      '1. Read the letter once fully.',
      '2. Go rule by rule (1 through 9), scanning the FULL text for each rule before moving to the next — not sentence by sentence rule-by-rule, but rule-by-rule across the whole text. This catches instances a single linear read misses.',
      '3. After applying all 9 rules, re-read the full corrected letter once more end to end to confirm no rule was missed and the text still flows as natural prose (correct any awkward joins left by a deletion — minimal smoothing only, e.g. fixing a dangling comma, never adding new claims or adjectives).',
      '4. Check the word count is still under 180 words. If a deletion made it noticeably short, do NOT pad it with new adjectives or generic filler — leave it concise.',
      '======================================================',
      'WHAT YOU MUST NOT DO',
      '======================================================',
      "- Do not add any fact, skill, project, or number that wasn't already in the input letter.",
      '- Do not rephrase sentences that already comply — if a sentence violates no rule, leave it character-for-character identical.',
      '- Do not change the greeting or the overall paragraph structure unless a full paragraph becomes empty after edits (then merge or remove it).',
      '- Do not explain your edits or show your rule-by-rule process.',
      '======================================================',
      'OUTPUT FORMAT',
      '======================================================',
      'Return ONLY the corrected letter body, in the exact same format the input was given in (plain text in, plain text out; if the input was a JSON object with a "content" field, return the same JSON shape with only "content" updated). No preamble, no explanation, no list of what was changed.',
    ].join(' ');
  }

  private buildSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: { type: 'string' },
      },
      required: ['content'],
    };
  }

  private normalize(
    raw: Record<string, unknown>,
  ): CoverLetterGenerationResult | null {
    const content = nonEmptyString(raw.content);
    if (content === null) {
      return null;
    }
    return { content };
  }
}
