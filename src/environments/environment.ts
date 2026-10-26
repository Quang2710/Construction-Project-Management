import { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  apiBaseUrl: '/api/v1',
  realtimePath: '/api/v1/realtime',
  // Chưa có BE thật nên bản build production vẫn chạy bằng fake BE.
  useMocks: true,
  mock: {
    minDelayMs: 200,
    maxDelayMs: 800,
    randomErrors: false,
    errorRate: 0.1,
    simulatedNotificationMs: 60_000,
  },
};
