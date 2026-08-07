# Career Analyzer

AI-powered SaaS platform designed to assist professionals throughout the job-search process.

## Vision

Career Analyzer helps candidates create and manage their professional profile, analyze job opportunities, evaluate compatibility, and generate tailored application documents.

The system should improve how candidates present their **real experience**, without inventing information.

## Core Workflow

```text
Candidate Profile
       ↓
CV Import / Profile Creation
       ↓
CV Analysis
       ↓
Job Description Analysis
       ↓
Candidate ↔ Job Matching
       ↓
Skill Gaps & Recommendations
       ↓
Tailored CV
       ↓
Cover Letter / Motivation
```

## Core Features

* Candidate profile management.
* CV import and automatic information extraction.
* CV analysis and improvement suggestions.
* Job description analysis.
* Candidate/job matching.
* Skill gap identification.
* ATS-oriented CV optimization.
* Tailored CV generation.
* Cover letters and motivation statements.
* Multiple CV versions for different job applications.
* Spanish and English support.

## Candidate Profile

The **Candidate Profile** is the source of truth.

Imported CVs are used to build the profile, while generated CVs and application documents are derived from it.

AI must not invent:

* Experience.
* Skills.
* Companies.
* Positions.
* Certifications.
* Education.
* Projects.
* Achievements.

Generated content must remain faithful to the candidate's real information.

## ATS & Human Writing

Generated CVs should be optimized for ATS through:

* Relevant keywords.
* Clear structure.
* Standard sections.
* Job-specific terminology.
* Relevant experience and skills.

ATS optimization must not become keyword stuffing.

All generated content should remain:

* Natural.
* Professional.
* Specific.
* Convincing.
* Human-sounding.

## Multilingual Support

Initial languages:

* Spanish.
* English.

Interface language and document language should be independent.

The same Candidate Profile should be able to generate CVs, cover letters, and other documents in different languages.

Translation should prioritize **natural professional adaptation**, not literal translation.

The architecture should allow additional languages in the future.

## Development Approach

The project will use **Spec-Driven Development**.

```text
Product Vision
      ↓
Small Feature
      ↓
Specification
      ↓
Review / Approval
      ↓
Implementation
      ↓
Testing
```

Features should be developed incrementally. Large features should be divided into smaller specifications.

The README defines product context and principles; detailed behavior belongs in individual Specs.

## Technology Stack

### Backend

* **Node.js**
* **NestJS**
* **TypeScript**
* **Prisma ORM**
* **PostgreSQL**
* **Multer** for file uploads
* PDF/document processing libraries as required
* PDF generation library as required
* AI/LLM provider integration

### Frontend

* **Angular**
* **TypeScript**
* **Angular Signals** for local/application state where appropriate
* **Angular Material**, Tailwind CSS, or native CSS depending on the component/design requirements

The project should avoid introducing a global state-management library such as NgRx unless the application complexity justifies it.

### Infrastructure

The exact infrastructure and deployment strategy will be defined during the architecture specifications.

Potential components include:

* Docker
* Object/file storage
* PostgreSQL
* AI provider APIs
* CI/CD

## Engineering Principles

* Keep the architecture modular.
* Prefer simplicity over unnecessary complexity.
* Avoid premature optimization.
* Keep business rules explicit.
* Maintain strong typing.
* Test important business logic.
* Protect user and professional data.
* Keep AI-generated information distinguishable from user-provided information.
* Do not introduce technologies without a clear requirement.

## MVP

The initial MVP should focus on:

1. Candidate Profile.
2. CV Import.
3. CV Analysis.
4. Job Analysis.
5. Job Matching.
6. CV Adaptation.
7. Cover Letter / Motivation Generation.

Future features such as interview preparation, application tracking, job recommendations, LinkedIn integration, and career analytics should remain outside the initial MVP.
