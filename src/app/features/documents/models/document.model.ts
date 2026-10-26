import { ListParams } from '../../../shared/models/api.model';
import { UserSummary } from '../../../shared/models/user.model';

export const DISCIPLINES = ['ARCH', 'STRUCT', 'MEP', 'CIVIL'] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_LABELS: Readonly<Record<Discipline, string>> = {
  ARCH: 'Kiến trúc',
  STRUCT: 'Kết cấu',
  MEP: 'Cơ điện',
  CIVIL: 'Hạ tầng',
};

/** Tiền tố số hiệu bản vẽ theo bộ môn (KT-101, KC-201...). */
export const DISCIPLINE_PREFIXES: Readonly<Record<Discipline, string>> = {
  ARCH: 'KT',
  STRUCT: 'KC',
  MEP: 'ME',
  CIVIL: 'HT',
};

export interface DrawingFile {
  readonly fileId: string;
  readonly url: string;
  readonly fileName: string;
  readonly size: number;
}

export interface DrawingRevision {
  readonly id: string;
  /** Ký hiệu phiên bản: A, B, C... */
  readonly revision: string;
  /** Nội dung thay đổi so với phiên bản trước. */
  readonly description: string;
  readonly file: DrawingFile;
  readonly issuedAt: string;
  readonly uploadedBy: UserSummary;
}

export interface Drawing {
  readonly id: string;
  readonly projectId: string;
  readonly projectCode: string;
  /** Số hiệu bản vẽ, duy nhất trong dự án. */
  readonly code: string;
  readonly title: string;
  readonly discipline: Discipline;
  /** Mới nhất ở cuối. */
  readonly revisions: readonly DrawingRevision[];
  readonly currentRevision: DrawingRevision;
  readonly updatedAt: string;
}

export interface DrawingCreateRequest {
  readonly code: string;
  readonly title: string;
  readonly discipline: Discipline;
  readonly description: string;
  readonly file: DrawingFile;
}

export interface RevisionCreateRequest {
  readonly description: string;
  readonly file: DrawingFile;
}

export interface DrawingListParams extends ListParams {
  readonly discipline?: Discipline | null;
}

/** Ký hiệu phiên bản kế tiếp: A → B → ... → Z → AA. */
export function nextRevisionLabel(current: string): string {
  const chars = current.toUpperCase().split('');
  for (let index = chars.length - 1; index >= 0; index--) {
    if (chars[index] !== 'Z') {
      chars[index] = String.fromCharCode(chars[index].charCodeAt(0) + 1);
      return chars.join('');
    }
    chars[index] = 'A';
  }
  return 'A' + chars.join('');
}
