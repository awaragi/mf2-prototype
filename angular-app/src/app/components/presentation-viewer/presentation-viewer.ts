import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PresentationService } from '../../services/presentation';
import { HeaderComponent } from '../header/header';
import { Presentation } from '../../models/presentation';
import { Slide } from '../../models/slide';

@Component({
  selector: 'app-presentation-viewer',
  imports: [HeaderComponent],
  templateUrl: './presentation-viewer.html',
  styleUrl: './presentation-viewer.css'
})
export class PresentationViewerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private presentationService = inject(PresentationService);
  private sanitizer = inject(DomSanitizer);

  presentation = signal<Presentation | undefined>(undefined);
  currentSlideIndex = signal<number>(0);
  currentSlide = computed(() => {
    const pres = this.presentation();
    const index = this.currentSlideIndex();
    return pres?.slides[index];
  });

  slideContent = computed<SafeHtml | null>(() => {
    const slide = this.currentSlide();
    if (!slide) return null;

    if (slide.template === 'html' && slide.html) {
      return this.sanitizer.bypassSecurityTrustHtml(slide.html);
    }
    return null;
  });

  canGoPrevious = computed(() => this.currentSlideIndex() > 0);
  canGoNext = computed(() => {
    const pres = this.presentation();
    if (!pres) return false;
    return this.currentSlideIndex() < pres.slides.length - 1;
  });

  constructor() {
    // Handle keyboard navigation
    effect(() => {
      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
          this.previousSlide();
        } else if (e.key === 'ArrowRight') {
          this.nextSlide();
        } else if (e.key === 'Escape') {
          this.router.navigate(['/']);
        }
      };

      window.addEventListener('keydown', handleKeydown);
      return () => window.removeEventListener('keydown', handleKeydown);
    });
  }

  async ngOnInit() {
    await this.presentationService.loadPresentations();

    this.route.params.subscribe(params => {
      const presentationId = params['presentationId'];
      const slideId = params['slideId'];

      const presentation = this.presentationService.getPresentationById(presentationId);

      if (presentation) {
        this.presentation.set(presentation);

        const slideIndex = presentation.slides.findIndex(s => s.id === slideId);
        if (slideIndex !== -1) {
          this.currentSlideIndex.set(slideIndex);
        }
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  ngOnDestroy() {
    // Cleanup is handled by effect cleanup
  }

  previousSlide() {
    if (this.canGoPrevious()) {
      const newIndex = this.currentSlideIndex() - 1;
      this.navigateToSlideIndex(newIndex);
    }
  }

  nextSlide() {
    if (this.canGoNext()) {
      const newIndex = this.currentSlideIndex() + 1;
      this.navigateToSlideIndex(newIndex);
    }
  }

  private navigateToSlideIndex(index: number) {
    const pres = this.presentation();
    if (!pres) return;

    const slide = pres.slides[index];
    if (slide) {
      this.currentSlideIndex.set(index);
      this.router.navigate(['/present', pres.id, slide.id], { replaceUrl: true });
    }
  }
}
