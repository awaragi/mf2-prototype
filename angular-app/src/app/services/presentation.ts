import { Injectable, signal } from '@angular/core';
import { Presentation } from '../models/presentation';
import { Slide } from '../models/slide';

@Injectable({
  providedIn: 'root',
})
export class PresentationService {
  private presentations = signal<Presentation[]>([]);
  private loading = signal<boolean>(false);
  private error = signal<string | null>(null);

  // Public computed signals
  readonly presentationList = this.presentations.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly errorMessage = this.error.asReadonly();

  constructor() {}

  async loadPresentations(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await fetch('/api/slides.json');
      const presentations = await response.json() as Presentation[];
      this.presentations.set(presentations);
    } catch (err) {
      this.error.set('Error loading presentations. Please try again.');
      console.error('Error loading presentations:', err);
    } finally {
      this.loading.set(false);
    }
  }

  getPresentationById(id: string): Presentation | undefined {
    return this.presentations().find(p => p.id === id);
  }

  getSlideById(presentationId: string, slideId: string): Slide | undefined {
    const presentation = this.getPresentationById(presentationId);
    return presentation?.slides.find(s => s.id === slideId);
  }
}
