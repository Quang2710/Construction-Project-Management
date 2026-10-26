import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHostComponent } from './core/notifications/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ToastHostComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet /><app-toast-host />`,
})
export class AppComponent {}
