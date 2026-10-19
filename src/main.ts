import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

async function prepareMocks(): Promise<void> {
  if (!environment.useMocks) {
    return;
  }
  // Import động: khi tắt mock, MSW + faker không nằm trong bundle chính.
  const { startMockServer } = await import('./app/mocks/browser');
  await startMockServer(environment.production);
}

prepareMocks()
  .then(() => bootstrapApplication(AppComponent, appConfig))
  .catch((err: unknown) => console.error(err));
