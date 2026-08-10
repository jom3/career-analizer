import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { CvExportFormat } from '../core/models/cover-letter';
import { CoverLetterService } from './cover-letter.service';
import type { CoverLetter } from '../core/models/cover-letter';

@Component({
  selector: 'app-cover-letter-detail',
  imports: [RouterLink],
  templateUrl: './cover-letter-detail.component.html',
  styleUrl: './cover-letter-detail.component.scss',
})
export class CoverLetterDetailComponent implements OnInit {
  private readonly coverLetterService = inject(CoverLetterService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly letter = signal<CoverLetter | null>(null);
  readonly exporting = signal<CvExportFormat | null>(null);
  readonly deleting = signal(false);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadLetter(id);
    }
  }

  async loadLetter(id: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.letter.set(await this.coverLetterService.get(id));
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  async exportLetter(format: CvExportFormat): Promise<void> {
    const current = this.letter();
    if (!current) return;
    this.exporting.set(format);
    this.errorMessage.set('');
    try {
      await this.coverLetterService.download(current.id, format);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.exporting.set(null);
    }
  }

  async deleteLetter(): Promise<void> {
    const current = this.letter();
    if (!current) return;
    if (!window.confirm('¿Eliminar esta carta de motivación?')) return;
    this.deleting.set(true);
    this.errorMessage.set('');
    try {
      await this.coverLetterService.delete(current.id);
      await this.router.navigate(['/cover-letter']);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.deleting.set(false);
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleDateString('es-AR');
  }

  private messageFor(error: unknown): string {
    console.error('cover-letter request failed:', error);
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
        return 'No se pudo conectar con el servidor (posible bloqueo CORS). Abrí el frontend en http://localhost:4200 y verificá que el backend corra en el puerto 3000.';
      }
      return `Error del servidor (${error.status}). Intentalo de nuevo.`;
    }
    return 'No se pudo completar la operación. Intentalo de nuevo.';
  }
}