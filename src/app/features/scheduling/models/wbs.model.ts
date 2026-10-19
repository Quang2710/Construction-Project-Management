/** Hạng mục WBS (Work Breakdown Structure) của dự án, lồng nhiều cấp. */
export interface WbsNode {
  readonly id: string;
  readonly projectId: string;
  readonly parentId: string | null;
  readonly name: string;
  /** Thứ tự trong cùng cấp. */
  readonly order: number;
  /** Mã WBS tính theo vị trí, ví dụ "3.1". */
  readonly code: string;
}

export interface WbsCreateRequest {
  readonly name: string;
  readonly parentId: string | null;
}
