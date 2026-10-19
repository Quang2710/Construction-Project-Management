import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { readStorage, writeStorage } from '../storage/local-storage';

const SIDEBAR_STORAGE_KEY = 'cpm.sidebar-collapsed';

interface LayoutState {
  /** Sidebar thu gọn (chỉ icon) trên màn hình lớn — được ghi nhớ. */
  readonly sidebarCollapsed: boolean;
  /** Ngăn kéo menu đang mở trên điện thoại/tablet dọc. */
  readonly mobileNavOpen: boolean;
}

export const LayoutStore = signalStore(
  { providedIn: 'root' },
  withState<LayoutState>({ sidebarCollapsed: false, mobileNavOpen: false }),
  withMethods((store) => ({
    toggleSidebar(): void {
      const sidebarCollapsed = !store.sidebarCollapsed();
      writeStorage(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
      patchState(store, { sidebarCollapsed });
    },
    toggleMobileNav(): void {
      patchState(store, { mobileNavOpen: !store.mobileNavOpen() });
    },
    closeMobileNav(): void {
      patchState(store, { mobileNavOpen: false });
    },
  })),
  withHooks({
    onInit(store) {
      patchState(store, { sidebarCollapsed: readStorage(SIDEBAR_STORAGE_KEY) === 'true' });
    },
  }),
);
