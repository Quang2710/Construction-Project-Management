import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export async function startMockServer(quiet: boolean): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({
    quiet,
    // Request không thuộc API (asset, font...) đi thẳng ra mạng.
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: 'mockServiceWorker.js' },
  });
}
