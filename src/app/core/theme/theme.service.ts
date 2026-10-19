import { DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';
import { readStorage, writeStorage } from '../storage/local-storage';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'cpm.theme';
const DARK_CLASS = 'theme-dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly modeSignal = signal<ThemeMode>(this.initialMode());

  readonly mode = this.modeSignal.asReadonly();

  constructor() {
    effect(() => {
      const mode = this.modeSignal();
      this.document.documentElement.classList.toggle(DARK_CLASS, mode === 'dark');
      writeStorage(THEME_STORAGE_KEY, mode);
    });
  }

  toggle(): void {
    this.modeSignal.update((mode) => (mode === 'dark' ? 'light' : 'dark'));
  }

  private initialMode(): ThemeMode {
    const stored = readStorage(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    const prefersDark = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    return prefersDark ? 'dark' : 'light';
  }
}
