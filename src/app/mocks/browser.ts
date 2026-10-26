import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { realtimeHandlers } from './handlers/notifications.handlers';

export async function startMockServer(quiet: boolean): Promise<void> {
  const worker = setupWorker(...handlers, ...realtimeHandlers);
  await worker.start({
    quiet,
    // Request không thuộc API (asset, font...) đi thẳng ra mạng.
    onUnhandledRequest: 'bypass',
    // Worker gộp MSW + Angular Service Worker (một scope chỉ có một service worker), xem public/app-sw.js.
    serviceWorker: { url: 'app-sw.js' },
  });
}
