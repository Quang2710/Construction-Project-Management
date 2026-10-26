import { DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { NotificationService } from '../notifications/notification.service';

/** Sự kiện cài đặt PWA (chưa có trong lib.dom của TypeScript). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Cập nhật phiên bản mới của PWA và nút "Cài đặt ứng dụng". */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly toast = inject(NotificationService);
  private readonly view = inject(DOCUMENT).defaultView;

  private installEvent: BeforeInstallPromptEvent | null = null;
  /** Trình duyệt cho phép cài đặt (Chrome/Edge Android & desktop). */
  readonly installAvailable = signal(false);

  init(): void {
    this.view?.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installEvent = event as BeforeInstallPromptEvent;
      this.installAvailable.set(true);
    });
    this.view?.addEventListener('appinstalled', () => {
      this.installEvent = null;
      this.installAvailable.set(false);
    });

    if (!this.swUpdate.isEnabled) {
      return;
    }
    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => {
        // duration 0: giữ thông báo tới khi người dùng chọn (đang nhập form thì không tự tải lại).
        void this.toast.action('Đã có phiên bản mới của ứng dụng.', 'Tải lại', 0).then((reload) => {
          if (reload) {
            this.view?.location.reload();
          }
        });
      });
    this.swUpdate.unrecoverable.subscribe(() => {
      void this.toast.action('Ứng dụng cần tải lại để tiếp tục hoạt động.', 'Tải lại', 0).then(() => this.view?.location.reload());
    });
    setInterval(() => void this.swUpdate.checkForUpdate().catch(() => false), UPDATE_CHECK_INTERVAL_MS);
  }

  async install(): Promise<void> {
    const event = this.installEvent;
    if (!event) {
      return;
    }
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') {
      this.installEvent = null;
      this.installAvailable.set(false);
    }
  }
}
