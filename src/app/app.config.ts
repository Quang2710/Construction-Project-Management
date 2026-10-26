import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeVi from '@angular/common/locales/vi';
import {
  ApplicationConfig,
  inject,
  Injector,
  isDevMode,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { provideDateFnsAdapter } from '@angular/material-date-fns-adapter';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatIconRegistry } from '@angular/material/icon';
import { MatPaginatorIntl } from '@angular/material/paginator';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { vi } from 'date-fns/locale';
import { environment } from '../environments/environment';

import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth.store';
import { AppTitleStrategy } from './core/config/app-title.strategy';
import { ViPaginatorIntl } from './core/config/vi-paginator-intl';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { offlineCacheInterceptor } from './core/offline/offline-cache.interceptor';
import { PwaService } from './core/pwa/pwa.service';
import { ThemeService } from './core/theme/theme.service';
import { OutboxService } from './core/offline/outbox.service';
import { DIARY_OUTBOX_KIND } from './features/site-diaries/data-access/diary-outbox.kind';
import type { DiaryOutboxPayload } from './features/site-diaries/data-access/diary-outbox.service';

registerLocaleData(localeVi);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      // Route con (vd. /projects/:id/edit) nhận được :id của route cha qua input binding.
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
    ),
    // offlineCacheInterceptor đứng cuối (gần BE nhất): thay lỗi mất mạng bằng dữ liệu cache trước khi errorInterceptor báo lỗi.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, offlineCacheInterceptor])),
    { provide: LOCALE_ID, useValue: 'vi' },
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    { provide: MatPaginatorIntl, useClass: ViPaginatorIntl },
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline' } },
    // Datepicker hiển thị và nhập theo định dạng dd/MM/yyyy.
    { provide: MAT_DATE_LOCALE, useValue: vi },
    provideDateFnsAdapter({
      parse: { dateInput: ['dd/MM/yyyy', 'd/M/yyyy', 'yyyy-MM-dd'] },
      display: {
        dateInput: 'dd/MM/yyyy',
        monthYearLabel: 'MM/yyyy',
        dateA11yLabel: 'PPP',
        monthYearA11yLabel: 'MMMM yyyy',
      },
    }),
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
      inject(ThemeService);
    }),
    // Khôi phục phiên đăng nhập trước khi router chạy guard lần đầu.
    provideAppInitializer(() => inject(AuthStore).restoreSession()),
    // PWA: fake BE dùng worker gộp MSW + ngsw (public/app-sw.js); BE thật chỉ cần ngsw-worker.js.
    provideServiceWorker(environment.useMocks ? 'app-sw.js' : 'ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => {
      inject(PwaService).init();
      // Đồng bộ nhật ký offline chạy được ngay khi mở app (không chờ vào trang nhật ký); code tải lười.
      const injector = inject(Injector);
      inject(OutboxService).registerLoader<DiaryOutboxPayload>(DIARY_OUTBOX_KIND, async () => {
        const { DiaryOutboxService } = await import('./features/site-diaries/data-access/diary-outbox.service');
        const service = injector.get(DiaryOutboxService);
        return (payload, context) => service.process(payload, context);
      });
    }),
  ],
};
