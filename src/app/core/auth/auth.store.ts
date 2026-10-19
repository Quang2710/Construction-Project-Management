import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { LoginRequest } from '../../shared/models/auth.model';
import { ROLE_LABELS, User, UserRole } from '../../shared/models/user.model';
import { toApiError } from '../../shared/utils/api-error';
import { readStorage, writeStorage } from '../storage/local-storage';
import { AuthApiService } from './auth-api.service';

export const TOKEN_STORAGE_KEY = 'cpm.access-token';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  readonly user: User | null;
  readonly token: string | null;
  readonly status: AuthStatus;
  readonly error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  status: 'idle',
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withProps(() => ({
    _api: inject(AuthApiService),
  })),
  withComputed(({ user, token, status }) => ({
    isAuthenticated: computed(() => user() !== null && token() !== null),
    isLoading: computed(() => status() === 'loading'),
    role: computed<UserRole | null>(() => user()?.role ?? null),
    roleLabel: computed(() => {
      const current = user();
      return current ? ROLE_LABELS[current.role] : '';
    }),
  })),
  withMethods((store) => {
    function clearSession(): void {
      writeStorage(TOKEN_STORAGE_KEY, null);
      patchState(store, { user: null, token: null, status: 'unauthenticated' });
    }

    return {
      /** Đọc trong computed/effect sẽ tự cập nhật khi user đổi. */
      hasAnyRole(roles: readonly UserRole[]): boolean {
        const role = store.role();
        return role !== null && roles.includes(role);
      },

      async login(credentials: LoginRequest): Promise<boolean> {
        patchState(store, { status: 'loading', error: null });
        try {
          const response = await firstValueFrom(store._api.login(credentials));
          writeStorage(TOKEN_STORAGE_KEY, response.accessToken);
          patchState(store, { user: response.user, token: response.accessToken, status: 'authenticated' });
          return true;
        } catch (error) {
          patchState(store, { status: 'unauthenticated', error: toApiError(error).message });
          return false;
        }
      },

      /** Gọi khi khởi động app: khôi phục phiên từ token đã lưu. */
      async restoreSession(): Promise<void> {
        const token = readStorage(TOKEN_STORAGE_KEY);
        if (!token) {
          patchState(store, { status: 'unauthenticated' });
          return;
        }
        patchState(store, { token, status: 'loading' });
        try {
          const user = await firstValueFrom(store._api.me());
          patchState(store, { user, status: 'authenticated' });
        } catch {
          clearSession();
        }
      },

      async logout(): Promise<void> {
        try {
          await firstValueFrom(store._api.logout());
        } catch {
          // Đăng xuất phía client vẫn tiếp tục dù BE lỗi.
        }
        clearSession();
      },

      clearSession,

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);

export type AuthStoreInstance = InstanceType<typeof AuthStore>;
