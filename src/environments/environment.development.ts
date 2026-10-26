import { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiBaseUrl: '/api/v1',
  realtimePath: '/api/v1/realtime',
  useMocks: true,
  mock: {
    minDelayMs: 200,
    maxDelayMs: 800,
    randomErrors: false,
    errorRate: 0.1,
    simulatedNotificationMs: 45_000,
  },
};
