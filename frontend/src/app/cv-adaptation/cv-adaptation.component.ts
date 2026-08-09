import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CvAdaptationService } from '../core/cv-adaptation.service';
import type { AdaptedCv, CvExportFormat } from '../core/models/adapted-cv';

@Component({
  selector: 'app-cv-adaptation',
  imports: [RouterLink],
  templateUrl: './cv-adaptation.component.html',
  styleUrl: './cv-adaptation.component.scss',
})
export class CvAdaptationComponent implements OnInit {
  private readonly cvAdaptationService = inject(CvAdaptationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly versions = signal<AdaptedCv[]>([]);
  readonly version = signal<AdaptedCv | null>(null);
  readonly exporting = signal<CvExportFormat | null>(null);
  readonly deleting = signal(false);
  readonly regenerating = signal(false);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadVersion(id);
    } else {
      await this.loadList();
    }
  }

  async loadList(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.versions.set(await this.cvAdaptationService.list());
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  async loadVersion(id: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.version.set(await this.cvAdaptationService.get(id));
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  async exportCv(format: CvExportFormat): Promise<void> {
    const current = this.version();
    if (!current) return;
    this.exporting.set(format);
    this.errorMessage.set('');
    try {
      await this.cvAdaptationService.download(current.id, format);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.exporting.set(null);
    }
  }

  async regenerate(): Promise<void> {
    const current = this.version();
    if (!current || !current.jobOfferId) return;
    this.regenerating.set(true);
    this.errorMessage.set('');
    try {
      const adapted = await this.cvAdaptationService.create({
        jobOfferId: current.jobOfferId,
        jobMatchId: current.jobMatchId ?? undefined,
      });
      await this.router.navigate(['/cv-adaptation', adapted.id]);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.regenerating.set(false);
    }
  }

  async deleteVersion(id: string): Promise<void> {
    if (!window.confirm('¿Eliminar este CV adaptado?')) return;
    this.deleting.set(true);
    this.errorMessage.set('');
    try {
      await this.cvAdaptationService.remove(id);
      await this.router.navigate(['/cv-adaptation']);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.deleting.set(false);
    }
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return date.toLocaleDateString('es-AR');
  }

  private messageFor(error: unknown): string {
    console.error('cv-adaptation request failed:', error);
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