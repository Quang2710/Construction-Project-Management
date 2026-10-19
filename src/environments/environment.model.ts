export interface MockSettings {
  /** Độ trễ tối thiểu giả lập cho mỗi request (ms). */
  readonly minDelayMs: number;
  /** Độ trễ tối đa giả lập cho mỗi request (ms). */
  readonly maxDelayMs: number;
  /** Bật lỗi 500 ngẫu nhiên để kiểm thử error state. */
  readonly randomErrors: boolean;
  /** Tỉ lệ lỗi ngẫu nhiên (0..1) khi randomErrors = true. */
  readonly errorRate: number;
}

export interface Environment {
  readonly production: boolean;
  readonly apiBaseUrl: string;
  /** true: khởi động MSW làm fake BE. Tắt khi đã có BE thật. */
  readonly useMocks: boolean;
  readonly mock: MockSettings;
}
