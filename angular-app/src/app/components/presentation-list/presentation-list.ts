import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PresentationService } from '../../services/presentation';
import { HeaderComponent } from '../header/header';

@Component({
  selector: 'app-presentation-list',
  imports: [RouterLink, HeaderComponent],
  templateUrl: './presentation-list.html',
  styleUrl: './presentation-list.css'
})
export class PresentationListComponent implements OnInit {
  private presentationService = inject(PresentationService);

  presentations = this.presentationService.presentationList;
  isLoading = this.presentationService.isLoading;
  errorMessage = this.presentationService.errorMessage;

  async ngOnInit() {
    await this.presentationService.loadPresentations();
  }

  getFirstSlideId(presentation: any): string {
    return presentation.slides[0]?.id || '';
  }
}
