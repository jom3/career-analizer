import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { JobAnalysisService } from '../core/job-analysis.service';
import { JobMatchService } from '../core/job-match.service';
import type {
  InputType,
  JobLevel,
  JobOffer,
  JobOfferDraft,
  JobOfferPayload,
  SourceLanguage,
} from '../core/models/job-analysis';

interface JobOfferForm {
  title: FormControl<string>;
  company: FormControl<string>;
  level: FormControl<JobLevel | ''>;
  responsibilities: FormArray<FormControl<string>>;
  requiredSkills: FormArray<FormControl<string>>;
  preferredSkills: FormArray<FormControl<string>>;
  experienceYears: FormControl<string>;
  experienceSummary: FormControl<string>;
  education: FormArray<FormControl<string>>;
  languages: FormArray<FormControl<string>>;
  keywords: FormArray<FormControl<string>>;
}

type DraftArrayFields = Pick<
  JobOfferDraft,
  | 'responsibilities'
  | 'requiredSkills'
  | 'preferredSkills'
  | 'education'
  | 'languages'
  | 'keywords'
>;

type DraftValues = DraftArrayFields &
  Pick<
    JobOfferDraft,
    'title' | 'company' | 'level' | 'experienceYears' | 'experienceSummary'
  >;

function stringControls(items: string[] | null | undefined): FormControl<string>[] {
  return (items ?? []).map(
    (item) => new FormControl<string>(item, { nonNullable: true }),
  );
}

function buildForm(draft?: JobOfferDraft | null): FormGroup<JobOfferForm> {
  return new FormGroup<JobOfferForm>({
    title: new FormControl<string>(draft?.title ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    company: new FormControl<string>(draft?.company ?? '', {
      nonNullable: true,
    }),
    level: new FormControl<JobLevel | ''>(draft?.level ?? '', {
      nonNullable: true,
    }),
    responsibilities: new FormArray<FormControl<string>>(
      stringControls(draft?.responsibilities),
    ),
    requiredSkills: new FormArray<FormControl<string>>(
      stringControls(draft?.requiredSkills),
    ),
    preferredSkills: new FormArray<FormControl<string>>(
      stringControls(draft?.preferredSkills),
    ),
    experienceYears: new FormControl<string>(
      draft?.experienceYears != null ? String(draft.experienceYears) : '',
      { nonNullable: true },
    ),
    experienceSummary: new FormControl<string>(draft?.experienceSummary ?? '', {
      nonNullable: true,
    }),
    education: new FormArray<FormControl<string>>(
      stringControls(draft?.education),
    ),
    languages: new FormArray<FormControl<string>>(
      stringControls(draft?.languages),
    ),
    keywords: new FormArray<FormControl<string>>(stringControls(draft?.keywords)),
  });
}

@Component({
  selector: 'app-job-analysis',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './job-analysis.component.html',
  styleUrl: './job-analysis.component.scss',
})
export class JobAnalysisComponent implements OnInit {
  private readonly jobAnalysisService = inject(JobAnalysisService);
  private readonly jobMatchService = inject(JobMatchService);
  private readonly router = inject(Router);

  readonly levelOptions: (JobLevel | '')[] = [
    '',
    'Junior',
    'Mid',
    'Senior',
    'Lead',
    'Executive',
  ];

  readonly analyzing = signal(false);
  readonly saving = signal(false);
  readonly matching = signal(false);
  readonly matchForId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly loadingHistory = signal(true);
  readonly errorMessage = signal('');
  readonly savedMessage = signal('');

  readonly textInput = signal('');
  readonly resultReady = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly history = signal<JobOffer[]>([]);

  private pendingSourceLanguage: SourceLanguage | null = null;
  private pendingInputType: InputType = 'TEXT';
  private pendingRawInput: string | null = null;

  readonly form: FormGroup<JobOfferForm> = buildForm();

  get responsibilities(): FormArray<FormControl<string>> {
    return this.form.controls.responsibilities;
  }
  get requiredSkills(): FormArray<FormControl<string>> {
    return this.form.controls.requiredSkills;
  }
  get preferredSkills(): FormArray<FormControl<string>> {
    return this.form.controls.preferredSkills;
  }
  get education(): FormArray<FormControl<string>> {
    return this.form.controls.education;
  }
  get languages(): FormArray<FormControl<string>> {
    return this.form.controls.languages;
  }
  get keywords(): FormArray<FormControl<string>> {
    return this.form.controls.keywords;
  }

  readonly listSections: {
    key: keyof DraftArrayFields;
    label: string;
    itemLabel: string;
    array: FormArray<FormControl<string>>;
  }[] = [
    {
      key: 'responsibilities',
      label: 'Responsabilidades',
      itemLabel: 'Responsabilidad',
      array: this.responsibilities,
    },
    {
      key: 'requiredSkills',
      label: 'Habilidades requeridas',
      itemLabel: 'Habilidad',
      array: this.requiredSkills,
    },
    {
      key: 'preferredSkills',
      label: 'Habilidades preferidas',
      itemLabel: 'Habilidad',
      array: this.preferredSkills,
    },
    {
      key: 'education',
      label: 'Educación',
      itemLabel: 'Requisito',
      array: this.education,
    },
    {
      key: 'languages',
      label: 'Idiomas',
      itemLabel: 'Idioma',
      array: this.languages,
    },
    {
      key: 'keywords',
      label: 'Palabras clave',
      itemLabel: 'Palabra',
      array: this.keywords,
    },
  ];

  async ngOnInit(): Promise<void> {
    await this.loadHistory();
  }

  addItem(array: FormArray<FormControl<string>>): void {
    array.push(new FormControl<string>('', { nonNullable: true }));
  }

  removeItem(array: FormArray<FormControl<string>>, index: number): void {
    array.removeAt(index);
  }

  onTextPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          void this.analyzeFile(file);
        }
        return;
      }
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void this.analyzeFile(file);
    }
    input.value = '';
  }

  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void this.analyzeFile(file);
    }
    input.value = '';
  }

  async analyzeText(): Promise<void> {
    const text = this.textInput().trim();
    if (!text) {
      this.errorMessage.set('Pegá el texto de la oferta antes de analizar.');
      return;
    }
    await this.runAnalysis(() => this.jobAnalysisService.analyzeText(text));
  }

  async onSave(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage.set('Completá el título de la oferta antes de guardar.');
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    this.savedMessage.set('');
    try {
      const payload = this.buildPayload();
      const editingId = this.editingId();
      if (editingId) {
        await this.jobAnalysisService.update(editingId, payload);
      } else {
        await this.jobAnalysisService.create(payload);
      }
      this.resetPreview();
      await this.loadHistory();
      this.savedMessage.set(
        editingId
          ? 'La oferta se actualizó correctamente.'
          : 'La oferta se guardó en tu historial.',
      );
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.saving.set(false);
    }
  }

  async checkCompatibility(offer: JobOffer): Promise<void> {
    this.matchForId.set(offer.id);
    this.errorMessage.set('');
    try {
      const match = await this.jobMatchService.create({
        jobOfferId: offer.id,
      });
      await this.router.navigate(['/job-match', match.id]);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.matchForId.set(null);
    }
  }

  async saveAndMatch(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage.set('Completá el título de la oferta antes de continuar.');
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    this.savedMessage.set('');
    try {
      const payload = this.buildPayload();
      const editingId = this.editingId();
      const saved = editingId
        ? await this.jobAnalysisService.update(editingId, payload)
        : await this.jobAnalysisService.create(payload);
      this.resetPreview();
      await this.loadHistory();
      this.savedMessage.set('La oferta se guardó. Calculando compatibilidad…');
      await this.runMatch(() =>
        this.jobMatchService.create({ jobOfferId: saved.id }),
      );
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.saving.set(false);
    }
  }

  async matchWithoutSaving(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage.set('Completá el título de la oferta antes de continuar.');
      return;
    }
    await this.runMatch(() =>
      this.jobMatchService.create({
        offer: this.buildPayload(),
        saveOffer: false,
      }),
    );
  }

  async editOffer(offer: JobOffer): Promise<void> {
    this.errorMessage.set('');
    this.savedMessage.set('');
    this.pendingSourceLanguage = offer.sourceLanguage;
    this.pendingInputType = offer.inputType;
    this.pendingRawInput = offer.rawInput;
    this.form.reset();
    this.setDraftValues(offer);
    this.editingId.set(offer.id);
    this.resultReady.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async deleteOffer(id: string): Promise<void> {
    if (!window.confirm('¿Eliminar esta oferta de tu historial?')) {
      return;
    }
    this.deletingId.set(id);
    this.errorMessage.set('');
    try {
      await this.jobAnalysisService.remove(id);
      await this.loadHistory();
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.deletingId.set(null);
    }
  }

  reset(): void {
    this.resetPreview();
    this.textInput.set('');
    this.errorMessage.set('');
    this.savedMessage.set('');
  }

  private async analyzeFile(file: File): Promise<void> {
    await this.runAnalysis(() => this.jobAnalysisService.analyzeFile(file));
  }

  private async runMatch(
    create: () => Promise<{ id: string }>,
  ): Promise<void> {
    this.matching.set(true);
    this.errorMessage.set('');
    try {
      const match = await create();
      await this.router.navigate(['/job-match', match.id]);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.matching.set(false);
    }
  }

  private async runAnalysis(
    analyze: () => Promise<{ draft: JobOfferDraft; sourceLanguage: SourceLanguage; inputType: InputType; rawInput: string | null }>,
  ): Promise<void> {
    this.analyzing.set(true);
    this.errorMessage.set('');
    this.savedMessage.set('');
    try {
      const result = await analyze();
      this.pendingSourceLanguage = result.sourceLanguage;
      this.pendingInputType = result.inputType;
      this.pendingRawInput = result.rawInput;
      this.form.reset();
      this.setDraftValues(result.draft);
      this.editingId.set(null);
      this.resultReady.set(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.analyzing.set(false);
    }
  }

  private buildPayload(): JobOfferPayload {
    const v = this.form.getRawValue();
    return {
      title: v.title.trim(),
      company: v.company.trim() || null,
      level: v.level || null,
      responsibilities: this.cleanItems(v.responsibilities),
      requiredSkills: this.cleanItems(v.requiredSkills),
      preferredSkills: this.cleanItems(v.preferredSkills),
      experienceYears: v.experienceYears.trim()
        ? Number(v.experienceYears)
        : null,
      experienceSummary: v.experienceSummary.trim() || null,
      education: this.cleanItems(v.education),
      languages: this.cleanItems(v.languages),
      keywords: this.cleanItems(v.keywords),
      sourceLanguage: this.pendingSourceLanguage,
      inputType: this.pendingInputType,
      rawInput: this.pendingRawInput,
    };
  }

  private cleanItems(items: string[]): string[] {
    return items.map((item) => item.trim()).filter((item) => item.length > 0);
  }

  private setDraftValues(draft: DraftValues): void {
    this.form.controls.title.setValue(draft.title ?? '');
    this.form.controls.company.setValue(draft.company ?? '');
    this.form.controls.level.setValue(draft.level ?? '');
    this.form.controls.experienceYears.setValue(
      draft.experienceYears != null ? String(draft.experienceYears) : '',
    );
    this.form.controls.experienceSummary.setValue(draft.experienceSummary ?? '');
    for (const section of this.listSections) {
      this.setArrayItems(section.array, draft[section.key]);
    }
  }

  private setArrayItems(
    array: FormArray<FormControl<string>>,
    items: string[],
  ): void {
    while (array.length > 0) {
      array.removeAt(0);
    }
    for (const item of items) {
      array.push(new FormControl<string>(item, { nonNullable: true }));
    }
  }

  private resetPreview(): void {
    this.form.reset();
    this.resultReady.set(false);
    this.editingId.set(null);
    this.pendingSourceLanguage = null;
    this.pendingInputType = 'TEXT';
    this.pendingRawInput = null;
  }

  private async loadHistory(): Promise<void> {
    this.loadingHistory.set(true);
    try {
      this.history.set(await this.jobAnalysisService.list());
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loadingHistory.set(false);
    }
  }

  private messageFor(error: unknown): string {
    console.error('job-analysis request failed:', error);
    if (error instanceof HttpErrorResponse) {
      if (error.status === 413) {
        return 'El archivo supera el límite de 10 MB.';
      }
      const backendMessage = (error.error as { message?: string | string[] })
        ?.message;
      if (typeof backendMessage === 'string' && backendMessage.length > 0) {
        return backendMessage;
      }
      if (Array.isArray(backendMessage) && backendMessage.length > 0) {
        return backendMessage.join(', ');
      }
      if (error.status === 0) {
        return 'No se pudo conectar con el servidor (posible bloqueo CORS). Abrí el frontend en http://localhost:4200 y verificá que el backend corra en el puerto 3000.';
      }
      return `Error del servidor (${error.status}). Intentalo de nuevo.`;
    }
    return 'No se pudo completar la operación. Intentalo de nuevo.';
  }
}
