import { Slide } from './slide';

export interface Presentation {
  id: string;
  title: string;
  version: string;
  slides: Slide[];
}
