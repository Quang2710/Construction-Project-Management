import { Discipline } from '../../features/documents/models/document.model';
import { removeVietnameseTones } from '../../shared/utils/string.utils';

/**
 * Sinh bản vẽ PDF minh hoạ cho dữ liệu seed (không có file thật).
 * PDF viết tay tối giản: một trang A3 ngang, chỉ lệnh vẽ vector + font Helvetica chuẩn,
 * nên chữ được bỏ dấu tiếng Việt. Mỗi phiên bản thêm thay đổi để so sánh phiên bản có khác biệt.
 */
export interface DrawingPdfSpec {
  readonly projectCode: string;
  readonly projectName: string;
  readonly code: string;
  readonly title: string;
  readonly discipline: Discipline;
  /** 0 = phiên bản A. */
  readonly revisionIndex: number;
  readonly revision: string;
  readonly issuedAt: string;
}

const WIDTH = 1190.55;
const HEIGHT = 841.89;
const MARGIN = 20;
const GRID_X = [110, 260, 410, 560, 710];
const GRID_Y = [700, 560, 420, 280, 160];
const AXIS_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function ascii(value: string): string {
  return removeVietnameseTones(value).replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1');
}

function text(x: number, y: number, size: number, value: string): string {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${ascii(value)}) Tj ET`;
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `${x1} ${y1} m ${x2} ${y2} l S`;
}

function rect(x: number, y: number, w: number, h: number, op: 'S' | 'f' | 'B' = 'S'): string {
  return `${x} ${y} ${w} ${h} re ${op}`;
}

/** Cung 90° (cánh cửa mở) xấp xỉ bằng Bézier. */
function quarterArc(cx: number, cy: number, r: number): string {
  const k = 0.5523 * r;
  return `${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c S`;
}

/** Đám mây đánh dấu vùng sửa đổi (revision cloud). */
function revisionCloud(x: number, y: number, w: number, h: number): string {
  const bump = 18;
  const parts: string[] = [`${x} ${y} m`];
  const edge = (fromX: number, fromY: number, dx: number, dy: number, steps: number, outX: number, outY: number): void => {
    for (let i = 1; i <= steps; i++) {
      const sx = fromX + (dx * (i - 1)) / steps;
      const sy = fromY + (dy * (i - 1)) / steps;
      const ex = fromX + (dx * i) / steps;
      const ey = fromY + (dy * i) / steps;
      parts.push(`${sx + outX} ${sy + outY} ${ex + outX} ${ey + outY} ${ex} ${ey} c`);
    }
  };
  const nx = Math.max(2, Math.round(w / bump));
  const ny = Math.max(2, Math.round(h / bump));
  edge(x, y, w, 0, nx, 0, -8);
  edge(x + w, y, 0, h, ny, 8, 0);
  edge(x + w, y + h, -w, 0, nx, 0, 8);
  edge(x, y + h, 0, -h, ny, -8, 0);
  return parts.join(' ') + ' S';
}

function grid(): string[] {
  const ops = ['0.6 0.6 0.6 RG 0.5 w [8 4 2 4] 0 d'];
  for (const x of GRID_X) {
    ops.push(line(x, 120, x, 740));
  }
  for (const y of GRID_Y) {
    ops.push(line(70, y, 750, y));
  }
  ops.push('[] 0 d 0 0 0 RG');
  GRID_X.forEach((x, index) => ops.push(text(x - 4, 752, 12, AXIS_LETTERS[index])));
  GRID_Y.forEach((y, index) => ops.push(text(52, y - 4, 12, String(index + 1))));
  return ops;
}

function columns(): string[] {
  const ops = ['0.15 0.15 0.15 rg'];
  for (const x of GRID_X) {
    for (const y of GRID_Y) {
      ops.push(rect(x - 8, y - 8, 16, 16, 'f'));
    }
  }
  return ops;
}

function disciplineLayer(discipline: Discipline): string[] {
  switch (discipline) {
    case 'STRUCT': {
      // Dầm: hai nét song song giữa các cột.
      const ops = ['0 0 0 RG 0.8 w'];
      for (const y of GRID_Y) {
        ops.push(line(GRID_X[0], y + 5, GRID_X[4], y + 5), line(GRID_X[0], y - 5, GRID_X[4], y - 5));
      }
      ops.push(text(300, 486, 10, 'SAN BTCT DAY 120 - B25'), text(450, 346, 10, 'DAM D1 220x500'));
      return ops;
    }
    case 'MEP': {
      const ops = ['0 0.35 0.8 RG 1.4 w [10 3] 0 d'];
      ops.push(`${GRID_X[0] + 20} 640 m ${GRID_X[3] + 30} 640 l ${GRID_X[3] + 30} 220 l S`);
      ops.push('0.8 0.2 0.1 RG');
      ops.push(`${GRID_X[1] + 20} 600 m ${GRID_X[4] - 20} 600 l S`, '[] 0 d 0 0 0 RG');
      ops.push(text(GRID_X[0] + 24, 648, 9, 'ONG CAP NUOC PPR D32'), text(GRID_X[1] + 24, 586, 9, 'MANG CAP 200x100'));
      return ops;
    }
    case 'CIVIL': {
      const ops = ['0.2 0.2 0.2 RG 2 w'];
      ops.push('90 200 m 300 260 450 620 730 680 c S', '0.5 w [6 4] 0 d', '90 230 m 300 290 450 650 730 710 c S', '[] 0 d');
      ops.push(text(320, 420, 11, 'TIM TUYEN - KM0+000 DEN KM0+850'));
      return ops;
    }
    case 'ARCH': {
      // Tường bao + vách ngăn.
      const ops = ['0 0 0 RG 4 w', rect(GRID_X[0], GRID_Y[4], GRID_X[4] - GRID_X[0], GRID_Y[0] - GRID_Y[4]), '2 w'];
      ops.push(line(GRID_X[2], GRID_Y[0], GRID_X[2], GRID_Y[2]), line(GRID_X[0], GRID_Y[2], GRID_X[4], GRID_Y[2]));
      ops.push(text(170, 630, 12, 'PHONG KHACH'), text(470, 630, 12, 'PHONG NGU 1'), text(300, 340, 12, 'BEP + AN'));
      return ops;
    }
  }
}

/** Thay đổi tích luỹ theo phiên bản (B: dời vách + cửa; C: thêm cầu thang + mây sửa đổi). */
function revisionLayer(index: number, revision: string): string[] {
  const ops: string[] = [];
  if (index >= 1) {
    ops.push('0.75 0 0 RG 2.5 w', line(GRID_X[3] - 60, GRID_Y[1], GRID_X[3] - 60, GRID_Y[3]));
    ops.push('1 w', quarterArc(GRID_X[3] - 60, GRID_Y[2] - 50, 40), line(GRID_X[3] - 60, GRID_Y[2] - 50, GRID_X[3] - 20, GRID_Y[2] - 50));
    ops.push('0 0 0 RG 0.6 w', line(GRID_X[2], 200, GRID_X[3] - 60, 200), text(GRID_X[2] + 30, 206, 9, '3,450'));
  }
  if (index >= 2) {
    const sx = GRID_X[3] + 20;
    ops.push('0 0 0 RG 1 w', rect(sx, GRID_Y[3] + 10, 110, 120));
    for (let step = 1; step < 10; step++) {
      ops.push(line(sx, GRID_Y[3] + 10 + step * 12, sx + 110, GRID_Y[3] + 10 + step * 12));
    }
    ops.push(text(sx + 18, GRID_Y[3] - 6, 9, 'CAU THANG BO CT2'));
    ops.push('0.85 0.1 0.1 RG 1.2 w', revisionCloud(sx - 20, GRID_Y[3] - 20, 160, 175));
  }
  if (index >= 1) {
    ops.push('0.85 0.1 0.1 RG 0.85 0.1 0.1 rg', text(GRID_X[4] - 30, 140, 11, `REV ${revision}`), '0 0 0 RG 0 0 0 rg');
  }
  return ops;
}

function titleBlock(spec: DrawingPdfSpec): string[] {
  const x = WIDTH - MARGIN - 380;
  const y = MARGIN + 10;
  return [
    '0 0 0 RG 1.2 w',
    rect(x, y, 370, 150),
    line(x, y + 110, x + 370, y + 110),
    line(x, y + 70, x + 370, y + 70),
    line(x, y + 35, x + 370, y + 35),
    line(x + 240, y, x + 240, y + 70),
    text(x + 10, y + 128, 10, `DU AN: ${spec.projectCode}`),
    text(x + 10, y + 115, 8, spec.projectName.slice(0, 70)),
    text(x + 10, y + 88, 12, spec.title.slice(0, 48)),
    text(x + 10, y + 75, 8, 'TEN BAN VE'),
    text(x + 10, y + 48, 16, spec.code),
    text(x + 250, y + 48, 16, `REV ${spec.revision}`),
    text(x + 10, y + 14, 9, `NGAY PHAT HANH: ${spec.issuedAt.slice(0, 10).split('-').reverse().join('/')}`),
    text(x + 250, y + 14, 8, 'TY LE 1:100'),
    text(MARGIN + 10, MARGIN + 6, 7, 'BAN VE MINH HOA - DU LIEU DEMO CONSTRUCTION PROJECT MANAGEMENT'),
  ];
}

function contentStream(spec: DrawingPdfSpec): string {
  return [
    '0 0 0 RG 1.5 w',
    rect(MARGIN, MARGIN, WIDTH - 2 * MARGIN, HEIGHT - 2 * MARGIN),
    ...grid(),
    ...columns(),
    ...disciplineLayer(spec.discipline),
    ...revisionLayer(spec.revisionIndex, spec.revision),
    ...titleBlock(spec),
  ].join('\n');
}

/** Ghép các object PDF, tính bảng xref theo byte offset (nội dung chỉ có ASCII nên 1 ký tự = 1 byte). */
export function buildDrawingPdf(spec: DrawingPdfSpec): Uint8Array {
  const content = contentStream(spec);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
