import { Routes } from '@angular/router';
import { PresentationListComponent } from './components/presentation-list/presentation-list';
import { PresentationViewerComponent } from './components/presentation-viewer/presentation-viewer';

export const routes: Routes = [
  { path: '', component: PresentationListComponent },
  { path: 'present/:presentationId/:slideId', component: PresentationViewerComponent },
  { path: '**', redirectTo: '' }
];
