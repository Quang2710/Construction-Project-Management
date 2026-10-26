import { faker } from '@faker-js/faker/locale/vi';
import { addDays, subDays } from 'date-fns';
import { Discipline, DISCIPLINE_PREFIXES, nextRevisionLabel } from '../../features/documents/models/document.model';
import { DrawingRecord, DrawingRevisionRecord, ProjectRecord } from '../models/mock-records';
import { apiUrl } from '../utils/http.utils';

const SHEETS: Readonly<Record<Discipline, readonly string[]>> = {
  ARCH: ['Mặt bằng tầng 1', 'Mặt bằng tầng điển hình', 'Mặt đứng trục 1–8', 'Mặt cắt A–A'],
  STRUCT: ['Mặt bằng móng', 'Mặt bằng kết cấu sàn điển hình', 'Chi tiết cột C1–C4'],
  MEP: ['Mặt bằng cấp thoát nước tầng điển hình', 'Mặt bằng điện chiếu sáng', 'Sơ đồ nguyên lý PCCC'],
  CIVIL: ['Bình đồ tuyến', 'Trắc dọc tuyến', 'Mặt cắt ngang điển hình', 'Bố trí cống thoát nước'],
};

const REVISION_NOTES = [
  'Phát hành bản vẽ thi công.',
  'Điều chỉnh vị trí vách ngăn, bổ sung cửa theo ý kiến chủ đầu tư.',
  'Bổ sung cầu thang bộ CT2, cập nhật kích thước.',
];

/** Id file của bản vẽ seed; fake BE sinh PDF minh hoạ khi được yêu cầu. */
export function seedDrawingFileId(drawingId: string, revision: string): string {
  return `seed-drw-${drawingId}-${revision}`;
}

export function createDrawingSeed(projects: readonly ProjectRecord[], floorsOf: (projectId: string) => number, today: Date): DrawingRecord[] {
  const drawings: DrawingRecord[] = [];
  for (const project of projects) {
    if (project.status === 'CANCELLED') {
      continue;
    }
    const disciplines: Discipline[] = floorsOf(project.id) > 0 ? ['ARCH', 'STRUCT', 'MEP'] : ['CIVIL', 'STRUCT'];
    const uploaders = [project.managerId, ...project.memberIds].filter((id): id is string => id !== null);
    const firstIssue = subDays(today, 150);

    for (const discipline of disciplines) {
      const sheets = discipline === 'STRUCT' && floorsOf(project.id) === 0 ? ['Chi tiết mố cầu', 'Chi tiết trụ cầu'] : SHEETS[discipline];
      sheets.forEach((title, index) => {
        const id = `drw-${project.id.slice(4)}-${DISCIPLINE_PREFIXES[discipline].toLowerCase()}${index + 1}`;
        const code = `${DISCIPLINE_PREFIXES[discipline]}-${String(101 + index)}`;
        // Bản vẽ của dự án đang lập kế hoạch chỉ có phiên bản A.
        const count = project.status === 'PLANNING' ? 1 : faker.helpers.weightedArrayElement([
          { value: 1, weight: 4 },
          { value: 2, weight: 4 },
          { value: 3, weight: 3 },
        ]);
        let label = '';
        let issued = addDays(firstIssue, faker.number.int({ min: 0, max: 20 }));
        const revisions: DrawingRevisionRecord[] = [];
        for (let rev = 0; rev < count; rev++) {
          label = nextRevisionLabel(label);
          const fileId = seedDrawingFileId(id, label);
          revisions.push({
            id: `${id}-r${label}`,
            revision: label,
            description: REVISION_NOTES[rev],
            file: { fileId, url: apiUrl(`/files/${fileId}`), fileName: `${code}_Rev${label}.pdf`, size: faker.number.int({ min: 90_000, max: 2_400_000 }) },
            issuedAt: issued.toISOString(),
            uploadedById: faker.helpers.arrayElement(uploaders),
          });
          issued = addDays(issued, faker.number.int({ min: 20, max: 45 }));
        }
        drawings.push({
          id,
          projectId: project.id,
          code,
          title,
          discipline,
          revisions,
          updatedAt: revisions[revisions.length - 1].issuedAt,
        });
      });
    }
  }
  return drawings;
}
