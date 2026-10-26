/* eslint-disable */
/**
 * Service worker gộp của app: Angular Service Worker (PWA, cache app shell) + MSW (fake BE).
 *
 * Một scope chỉ có một service worker, nên cả hai được nạp vào cùng một script và mỗi
 * worker gắn listener "fetch" của mình. Ở đây ta giữ lại hai listener đó và tự điều phối:
 *   - /api/*   → MSW trước (fake BE). MSW không trả lời (chưa bật mock) → sang ngsw / mạng.
 *   - còn lại  → ngsw (cache app shell, chạy offline).
 * Các sự kiện khác (install, activate, message, push...) giữ nguyên cho cả hai worker.
 *
 * Khi tắt mock (environment.useMocks = false), app.config.ts đăng ký thẳng ngsw-worker.js, không dùng file này.
 */
(function () {
  var fetchListeners = { msw: null, ngsw: null };
  var current = null;
  var originalAddEventListener = self.addEventListener.bind(self);

  // MSW tự gỡ service worker khi tab cuối cùng đóng (CLIENT_CLOSED). Với worker gộp, việc đó
  // xoá luôn PWA → mở lại khi mất mạng sẽ không chạy. ngsw không gọi unregister khi chạy bình thường
  // (chỉ safety-worker.js làm việc đó, là script riêng), nên vô hiệu hoá ở đây là an toàn.
  self.registration.unregister = function () {
    return Promise.resolve(false);
  };

  self.addEventListener = function (type, listener, options) {
    if (type === 'fetch' && current) {
      fetchListeners[current] = listener;
      return;
    }
    originalAddEventListener(type, listener, options);
  };

  current = 'msw';
  importScripts('./mockServiceWorker.js');

  // ngsw-worker.js chỉ có trong bản build production (ng serve không sinh ra) → bỏ qua nếu thiếu.
  current = 'ngsw';
  try {
    importScripts('./ngsw-worker.js');
  } catch (error) {
    console.info('[app-sw] Không có ngsw-worker.js (chế độ dev): chỉ chạy MSW.');
  }

  current = null;
  self.addEventListener = originalAddEventListener;

  function isApiRequest(request) {
    var url = new URL(request.url);
    return url.origin === self.location.origin && url.pathname.indexOf('/api/') === 0;
  }

  /** Gọi listener và cho biết nó có nhận xử lý request (gọi respondWith) hay không. */
  function dispatch(listener, event) {
    if (!listener) {
      return false;
    }
    var responded = false;
    var respondWith = event.respondWith.bind(event);
    event.respondWith = function (response) {
      responded = true;
      respondWith(response);
    };
    try {
      listener.call(self, event);
    } finally {
      event.respondWith = respondWith;
    }
    return responded;
  }

  originalAddEventListener('fetch', function (event) {
    if (isApiRequest(event.request) && dispatch(fetchListeners.msw, event)) {
      return;
    }
    dispatch(fetchListeners.ngsw, event);
  });
})();
