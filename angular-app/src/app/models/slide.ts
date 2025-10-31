export interface Slide {
  id: string;
  title: string;
  template: 'html' | 'img';
  html?: string;
  src?: string;
  additional?: string;
}

