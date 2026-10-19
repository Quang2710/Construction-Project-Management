import { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiBaseUrl: '/api/v1',
  useMocks: true,
  mock: {
    minDelayMs: 200,
    maxDelayMs: 800,
    randomErrors: false,
    errorRate: 0.1,
  },
};
