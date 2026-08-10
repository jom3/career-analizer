import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoverLetterService } from './cover-letter.service';
import type { CoverLetter } from '../core/models/cover-letter';

@Component({
  selector: 'app-cover-letter',
  imports: [RouterLink],
  templateUrl: './cover-letter.component.html',
  styleUrl: './cover-letter.component.scss',
})
export class CoverLetterComponent implements OnInit {
  private readonly coverLetterService = inject(CoverLetterService);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly letters = signal<CoverLetter[]>([]);

  async ngOnInit(): Promise<void> {
    await this.loadList();
  }

  async loadList(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.letters.set(await this.coverLetterService.list());
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
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