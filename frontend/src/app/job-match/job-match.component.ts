import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { JobMatchService } from '../core/job-match.service';
import type { JobMatch, JobMatchGap } from '../core/models/job-match';

const DIMENSION_LABELS: Record<string, string> = {
  skills: 'Habilidades',
  experience: 'Experiencia',
  education: 'Educación',
  languages: 'Idiomas',
};

const GAP_STATUS_LABELS: Record<JobMatchGap['status'], string> = {
  HAVE: 'La tenés',
  MISSING: 'Falta',
  PARTIAL: 'Parcial',
};

const GAP_SOURCE_LABELS: Record<JobMatchGap['source'], string> = {
  REQUIRED: 'Requerida',
  PREFERRED: 'Preferida',
  OTHER: 'En la oferta',
};

@Component({
  selector: 'app-job-match',
  imports: [RouterLink],
  templateUrl: './job-match.component.html',
  styleUrl: './job-match.component.scss',
})
export class JobMatchComponent implements OnInit {
  private readonly jobMatchService = inject(JobMatchService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly matches = signal<JobMatch[]>([]);
  readonly match = signal<JobMatch | null>(null);
  readonly recomputing = signal(false);
  readonly deleting = signal(false);

  readonly dimensionLabels = DIMENSION_LABELS;
  readonly gapStatusLabels = GAP_STATUS_LABELS;
  readonly gapSourceLabels = GAP_SOURCE_LABELS;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadMatch(id);
    } else {
      await this.loadList();
    }
  }

  async loadList(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.matches.set(await this.jobMatchService.list());
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  async loadMatch(id: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.match.set(await this.jobMatchService.get(id));
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  async recompute(): Promise<void> {
    const current = this.match();
    if (!current) return;
    this.recomputing.set(true);
    this.errorMessage.set('');
    try {
      this.match.set(await this.jobMatchService.recompute(current.id));
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.recomputing.set(false);
    }
  }

  async deleteMatch(id: string): Promise<void> {
    if (!window.confirm('¿Eliminar este resultado del historial?')) return;
    this.deleting.set(true);
    this.errorMessage.set('');
    try {
      await this.jobMatchService.remove(id);
      await this.router.navigate(['/job-match']);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.deleting.set(false);
    }
  }

  isNullScore(match: JobMatch | null): boolean {
    return match !== null && match.dimensions.every((d) => d.score === null);
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return date.toLocaleDateString('es-AR');
  }

  private messageFor(error: unknown): string {
    console.error('job-match request failed:', error);
    if (error instanceof HttpErrorResponse) {
      const backendMessage = (error.error as { message?: string | string[] })
        ?.message;
      if (typeof backendMessage === 'string' && backendMessage.length > 0) {
        return backendMessage;
      }
      if (Array.isArray(backendMessage) && backendMessage.length > 0) {
        return backendMessage.join(', ');
      }
      if (error.status === 0) {
        return 'No se pudo conectar con el servidor (posible bloqueo CORS).';
      }
      return `Error del servidor (${error.status}). Intentalo de nuevo.`;
    }
    return 'No se pudo completar la operación. Intentalo de nuevo.';
  }
}