import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ROLE_LABELS } from '../../../shared/models/user.model';
import { imageUrlToDataUrl } from '../../../shared/utils/image.utils';
import { distanceMeters, formatDistance } from '../../../shared/utils/geo.utils';
import { parseIsoDate } from '../../../shared/utils/date.utils';
import {
  DIARY_STATUS_LABELS,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  SiteDiary,
  WEATHER_LABELS,
} from '../models/site-diary.model';

const DATE_FORMAT = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const DATETIME_FORMAT = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const NUMBER_FORMAT = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

const COLORS = { primary: '#9a3412', muted: '#57534e', border: '#d6d3d1', headerFill: '#f5f5f4' };

function header(cells: string[]): TableCell[] {
  return cells.map((text) => ({ text, style: 'tableHeader' }));
}

function table(widths: (string | number)[], head: string[], rows: TableCell[][], emptyText: string): Content {
  if (rows.length === 0) {
    return { text: emptyText, style: 'muted', margin: [0, 2, 0, 8] };
  }
  return {
    table: { headerRows: 1, widths, body: [header(head), ...rows] },
    layout: {
      hLineColor: () => COLORS.border,
      vLineColor: () => COLORS.border,
      fillColor: (rowIndex: number) => (rowIndex === 0 ? COLORS.headerFill : null),
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 2, 0, 10],
  };
}

function section(title: string, pageBreak?: 'before'): Content {
  return pageBreak
    ? { text: title.toUpperCase(), style: 'section', pageBreak }
    : { text: title.toUpperCase(), style: 'section' };
}

function reviewer(diary: SiteDiary): string {
  const review = [...diary.history].reverse().find((entry) => entry.action === 'APPROVED' || entry.action === 'REJECTED');
  return review ? `${review.by.fullName}\n${DATETIME_FORMAT.format(new Date(review.at))}` : '';
}

/**
 * Dựng nội dung PDF (hàm thuần, dễ kiểm thử). images: map photoId -> data URL JPEG.
 */
export function buildDiaryPdfDefinition(diary: SiteDiary, images: ReadonlyMap<string, string>): TDocumentDefinitions {
  const weather = diary.weather;
  const temperature =
    weather.minTemp !== null && weather.maxTemp !== null ? `${weather.minTemp}–${weather.maxTemp} °C` : 'Không ghi nhận';

  const photoCells: Content[] = diary.photos
    .filter((photo) => images.has(photo.id))
    .map((photo) => {
      const gps = photo.location
        ? `GPS ${photo.location.lat.toFixed(5)}, ${photo.location.lng.toFixed(5)} · cách công trình ${formatDistance(
            distanceMeters(photo.location, diary.project),
          )}`
        : 'Không có GPS';
      return {
        stack: [
          { image: images.get(photo.id) ?? '', fit: [240, 170], alignment: 'center' },
          { text: photo.caption || photo.fileName, style: 'caption', margin: [0, 4, 0, 0] },
          { text: `${DATETIME_FORMAT.format(new Date(photo.takenAt))} · ${gps}`, style: 'muted' },
        ],
        margin: [0, 0, 0, 12],
      };
    });
  const photoRows: Content[] = [];
  for (let index = 0; index < photoCells.length; index += 2) {
    photoRows.push({ columns: [photoCells[index], photoCells[index + 1] ?? { text: '' }], columnGap: 16 });
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 56, 40, 48],
    info: { title: `Nhật ký thi công ${diary.project.code} ${diary.date}` },
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25 },
    header: {
      columns: [
        { text: `${diary.project.code} · ${diary.project.name}`, style: 'muted' },
        { text: `Trạng thái: ${DIARY_STATUS_LABELS[diary.status]}`, style: 'muted', alignment: 'right' },
      ],
      margin: [40, 24, 40, 0],
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Xuất lúc ${DATETIME_FORMAT.format(new Date())}`, style: 'muted' },
        { text: `Trang ${currentPage}/${pageCount}`, style: 'muted', alignment: 'right' },
      ],
      margin: [40, 16, 40, 0],
    }),
    content: [
      { text: 'NHẬT KÝ THI CÔNG XÂY DỰNG', style: 'title' },
      { text: DATE_FORMAT.format(parseIsoDate(diary.date)), style: 'subtitle' },
      {
        table: {
          widths: [110, '*'],
          body: [
            [{ text: 'Dự án', bold: true }, `${diary.project.code} — ${diary.project.name}`],
            [{ text: 'Người lập', bold: true }, `${diary.createdBy.fullName} (${ROLE_LABELS[diary.createdBy.role]})`],
            [{ text: 'Thời tiết', bold: true }, `Sáng: ${WEATHER_LABELS[weather.morning]} · Chiều: ${WEATHER_LABELS[weather.afternoon]} · ${temperature}`],
            [{ text: 'Tổng nhân công', bold: true }, `${diary.totalWorkers} người`],
          ],
        },
        layout: 'noBorders',
        margin: [0, 8, 0, 12],
      },

      section('1. Nhân công theo tổ đội'),
      table(
        ['*', 80],
        ['Tổ đội', 'Số người'],
        diary.labor.map((entry) => [entry.crew, { text: String(entry.headcount), alignment: 'right' }]),
        'Không có nhân công trong ngày.',
      ),

      section('2. Máy móc, thiết bị'),
      table(
        ['*', 60, 80],
        ['Thiết bị', 'Số lượng', 'Giờ hoạt động'],
        diary.equipment.map((entry) => [
          entry.name,
          { text: String(entry.quantity), alignment: 'right' },
          { text: entry.hours === null ? '—' : `${entry.hours} giờ`, alignment: 'right' },
        ]),
        'Không sử dụng máy móc.',
      ),

      section('3. Khối lượng hoàn thành'),
      table(
        ['*', 50, 80],
        ['Hạng mục', 'ĐVT', 'Khối lượng'],
        diary.workItems.map((item) => [
          item.description,
          item.unit,
          { text: NUMBER_FORMAT.format(item.quantity), alignment: 'right' },
        ]),
        'Không ghi nhận khối lượng.',
      ),

      section('4. Sự cố, an toàn lao động'),
      table(
        [90, 60, '*', '*'],
        ['Loại', 'Mức độ', 'Mô tả', 'Biện pháp xử lý'],
        diary.incidents.map((incident) => [
          INCIDENT_TYPE_LABELS[incident.type],
          INCIDENT_SEVERITY_LABELS[incident.severity],
          incident.description,
          incident.actionTaken || '—',
        ]),
        'Không có sự cố, đảm bảo an toàn lao động.',
      ),

      section('5. Ghi chú'),
      { text: diary.notes || 'Không có.', margin: [0, 2, 0, 10] },

      ...(diary.reviewNote ? [section('Ý kiến người duyệt'), { text: diary.reviewNote, margin: [0, 2, 0, 10] } as Content] : []),

      ...(photoRows.length ? [section('6. Ảnh hiện trường', 'before'), ...photoRows] : []),

      {
        columns: [
          { stack: [{ text: 'NGƯỜI LẬP', bold: true }, { text: diary.createdBy.fullName, margin: [0, 40, 0, 0] }], alignment: 'center' },
          { stack: [{ text: 'NGƯỜI DUYỆT', bold: true }, { text: reviewer(diary), margin: [0, 40, 0, 0] }], alignment: 'center' },
        ],
        margin: [0, 24, 0, 0],
        unbreakable: true,
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true, alignment: 'center', color: COLORS.primary },
      subtitle: { fontSize: 11, alignment: 'center', margin: [0, 2, 0, 0] },
      section: { fontSize: 10, bold: true, color: COLORS.primary, margin: [0, 6, 0, 2] },
      tableHeader: { bold: true },
      caption: { bold: true },
      muted: { fontSize: 8, color: COLORS.muted },
    },
  };
}

type PdfMakeModule = typeof import('pdfmake/build/pdfmake');

/** Xuất PDF phía client. pdfmake + font (~2MB) chỉ được tải khi người dùng bấm xuất. */
export async function exportDiaryPdf(diary: SiteDiary): Promise<void> {
  const [pdfMakeModule, fontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  // pdfmake là bundle UMD: tuỳ bundler, API nằm ở default hoặc chính module.
  const pdfMake = ((pdfMakeModule as PdfMakeModule & { default?: PdfMakeModule }).default ?? pdfMakeModule) as PdfMakeModule;
  pdfMake.addVirtualFileSystem(fontsModule.default);

  const images = new Map<string, string>();
  await Promise.all(
    diary.photos.map(async (photo) => {
      try {
        images.set(photo.id, await imageUrlToDataUrl(photo.url));
      } catch {
        // Ảnh lỗi thì bỏ qua, phần còn lại của báo cáo vẫn xuất được.
      }
    }),
  );

  await pdfMake.createPdf(buildDiaryPdfDefinition(diary, images)).download(`nhat-ky-${diary.project.code}-${diary.date}.pdf`);
}
