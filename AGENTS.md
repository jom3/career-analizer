# AGENTS.md

Early-stage project. `README.md` defines product vision and principles; there is no code or build/test tooling yet. Features are built via **Spec-Driven Development** — write a spec, get approval, then implement. Detailed behavior lives in individual Specs, not the README.

## Business invariants (non-negotiable)

- The **Candidate Profile** is the single source of truth. Imported CVs build it; generated CVs, cover letters and other documents derive from it.
- AI **must never invent** experience, skills, companies, positions, certifications, education, projects, or achievements. Generated content must stay faithful to real data.
- ATS optimization is not keyword stuffing. Output must stay natural, professional, specific, convincing, human-sounding.
- Spanish and English support. Interface language and document language are independent; one profile generates documents in either language. Translation means natural professional adaptation, not literal translation.
- Keep AI-generated information distinguishable from user-provided information.

## Planned stack (not yet scaffolded)

- Backend: Node.js, NestJS, TypeScript, Prisma ORM, PostgreSQL, Multer.
- Frontend: Angular, TypeScript, Angular Signals. Avoid a global state library (NgRx) unless complexity justifies it.
- Accept untested claims in these plans — verify before relying on them.

## MVP scope

Profile, CV import, CV analysis, job analysis, job matching, CV adaptation, cover letter/motivation generation. Keep interview prep, ATS tracking, job recommendations, LinkedIn integration, and analytics out of the MVP.