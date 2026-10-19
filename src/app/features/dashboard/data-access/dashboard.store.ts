import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../../shared/utils/api-error';
import { DashboardSummary } from '../models/dashboard.model';
import { DashboardApiService } from './dashboard-api.service';

interface DashboardState {
  readonly summary: DashboardSummary | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const DashboardStore = signalStore(
  withState<DashboardState>({ summary: null, loading: false, error: null }),
  withProps(() => ({ _api: inject(DashboardApiService) })),
  withMethods((store) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        patchState(store, { summary: await firstValueFrom(store._api.summary()), loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: toApiError(error).message });
      }
    },
  })),
  withHooks({
    onInit(store) {
      void store.load();
    },
  }),
);
