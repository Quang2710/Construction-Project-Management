import { utils, WorkBook, WorkSheet, writeFile } from 'xlsx';
import { parseIsoDate, toIsoDate } from '../../../shared/utils/date.utils';
import {
  CHANGE_ORDER_STATUS_LABELS,
  ChangeOrder,
  COST_CATEGORY_LABELS,
  CostEntry,
  CostSummary,
  PAYMENT_STATUS_LABELS,
  PaymentMilestone,
  ProfitLossRow,
} from '../models/cost.model';

type Cell = string | number | null;

const MONEY_FORMAT = '#,##0';
const PERCENT_FORMAT = '0.0"%"';
const DATE_FORMAT = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export interface ProjectCostExport {
  readonly summary: CostSummary;
  readonly entries: readonly CostEntry[];
  readonly changeOrders: readonly ChangeOrder[];
  readonly payments: readonly PaymentMilestone[];
}

function formatDate(iso: string | null): string {
  return iso ? DATE_FORMAT.format(parseIsoDate(iso.slice(0, 10))) : '';
}

function sum<T>(rows: readonly T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

/**
 * Bảng có dòng tiêu đề: định dạng số tiền / phần trăm theo cột, độ rộng cột, bộ lọc.
 * `footer` (dòng tổng) không nằm trong vùng lọc.
 */
function tableSheet(
  head: readonly string[],
  rows: readonly Cell[][],
  options: { widths: readonly number[]; money?: readonly number[]; percent?: readonly number[]; footer?: Cell[] },
): WorkSheet {
  const body = options.footer ? [...rows, options.footer] : rows;
  const sheet = utils.aoa_to_sheet([[...head], ...body]);
  for (let r = 1; r <= body.length; r++) {
    for (const [cols, format] of [
      [options.money ?? [], MONEY_FORMAT],
      [options.percent ?? [], PERCENT_FORMAT],
    ] as const) {
      for (const c of cols) {
        const cell = sheet[utils.encode_cell({ r, c })] as { t: string; z?: string } | undefined;
        if (cell?.t === 'n') {
          cell.z = format;
        }
      }
    }
  }
  sheet['!cols'] = options.widths.map((wch) => ({ wch }));
  if (rows.length > 0) {
    sheet['!autofilter'] = { ref: utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } }) };
  }
  return sheet;
}

/** Sheet "Tổng hợp": cặp nhãn – giá trị; các chỉ số lãi/lỗ bị bỏ khi người xem không có quyền (null). */
function summarySheet(summary: CostSummary, exportedAt: Date): WorkSheet {
  const rows: [string, number | null, 'money' | 'percent'][] = [
    ['Giá trị hợp đồng gốc', summary.originalContract, 'money'],
    ['Phát sinh được chấp thuận', summary.approvedChanges, 'money'],
    ['Giá trị hợp đồng hiện tại', summary.contractValue, 'money'],
    ['Dự toán chi phí', summary.costBudget, 'money'],
    ['Chi phí thực tế', summary.actualCost, 'money'],
    ['Khối lượng hoàn thành', summary.progress, 'percent'],
    ['Doanh thu ghi nhận theo khối lượng', summary.earnedRevenue, 'money'],
    ['Đã đề nghị thanh toán', summary.billed, 'money'],
    ['Đã thu', summary.received, 'money'],
    ['Còn phải thu', summary.receivable, 'money'],
    ['Lãi/lỗ đến nay', summary.profitToDate, 'money'],
    ['Chi phí dự báo khi hoàn thành', summary.forecastCost, 'money'],
    ['Lãi/lỗ dự báo', summary.forecastProfit, 'money'],
    ['Tỷ suất lợi nhuận dự báo', summary.forecastMargin, 'percent'],
  ];
  const visible = rows.filter(([, value]) => value !== null);
  const sheet = utils.aoa_to_sheet([
    ['BÁO CÁO CHI PHÍ DỰ ÁN'],
    [`${summary.projectCode} · ${summary.projectName}`],
    [`Xuất lúc ${exportedAt.toLocaleString('vi-VN')}`],
    [],
    ['Chỉ tiêu', 'Giá trị (VND)'],
    ...visible.map(([label, value]) => [label, value]),
  ]);
  visible.forEach(([, , kind], index) => {
    const cell = sheet[utils.encode_cell({ r: index + 5, c: 1 })] as { z?: string } | undefined;
    if (cell) {
      cell.z = kind === 'money' ? MONEY_FORMAT : PERCENT_FORMAT;
    }
  });
  sheet['!cols'] = [{ wch: 38 }, { wch: 22 }];
  sheet['!merges'] = [utils.decode_range('A1:B1'), utils.decode_range('A2:B2'), utils.decode_range('A3:B3')];
  return sheet;
}

function itemsSheet(summary: CostSummary): WorkSheet {
  const items = summary.items;
  return tableSheet(
    ['Mã', 'Hạng mục', 'Dự toán', 'Thực tế', 'Còn lại', '% đã chi', '% khối lượng', 'Cảnh báo'],
    items.map((item) => [
      item.code,
      item.name,
      item.budget,
      item.actual,
      item.variance,
      item.percentUsed,
      item.progress,
      item.actual > item.budget ? 'Vượt dự toán' : item.overrun ? 'Chi nhanh hơn khối lượng' : '',
    ]),
    {
      widths: [8, 36, 18, 18, 18, 10, 12, 24],
      money: [2, 3, 4],
      percent: [5, 6],
      footer: ['', 'Tổng cộng', summary.costBudget, summary.actualCost, summary.costBudget - summary.actualCost, null, null, ''],
    },
  );
}

function entriesSheet(entries: readonly CostEntry[]): WorkSheet {
  return tableSheet(
    ['Ngày', 'Số chứng từ', 'Hạng mục', 'Loại chi phí', 'Nội dung', 'Nhà cung cấp', 'Số tiền', 'Người ghi'],
    entries.map((entry) => [
      formatDate(entry.date),
      entry.documentNo,
      entry.costItemName,
      COST_CATEGORY_LABELS[entry.category],
      entry.description,
      entry.vendor,
      entry.amount,
      entry.createdBy.fullName,
    ]),
    {
      widths: [12, 14, 28, 16, 40, 28, 18, 22],
      money: [6],
      footer: ['', '', '', '', 'Tổng cộng', '', sum(entries, (entry) => entry.amount), ''],
    },
  );
}

function changeOrdersSheet(orders: readonly ChangeOrder[]): WorkSheet {
  const approved = orders.filter((order) => order.status === 'APPROVED');
  return tableSheet(
    ['Mã', 'Ngày', 'Nội dung', 'Hạng mục', 'Chi phí tăng thêm', 'Giá trị được thanh toán', 'Trạng thái', 'Ý kiến'],
    orders.map((order) => [
      order.code,
      formatDate(order.date),
      order.title,
      order.costItemName,
      order.costAmount,
      order.revenueAmount,
      CHANGE_ORDER_STATUS_LABELS[order.status],
      order.decisionNote,
    ]),
    {
      widths: [8, 12, 40, 28, 18, 20, 16, 32],
      money: [4, 5],
      footer: [
        '',
        '',
        'Tổng đã chấp thuận',
        '',
        sum(approved, (order) => order.costAmount),
        sum(approved, (order) => order.revenueAmount),
        '',
        '',
      ],
    },
  );
}

function paymentsSheet(payments: readonly PaymentMilestone[]): WorkSheet {
  return tableSheet(
    ['Đợt', 'Nội dung', '% HĐ', 'Giá trị', 'Hạn thanh toán', 'Trạng thái', 'Ngày đề nghị', 'Ngày thu', 'Đã thu'],
    payments.map((payment) => [
      payment.order,
      payment.name,
      payment.percent,
      payment.amount,
      formatDate(payment.dueDate),
      PAYMENT_STATUS_LABELS[payment.status] + (payment.isOverdue ? ' (quá hạn)' : ''),
      formatDate(payment.invoicedAt),
      formatDate(payment.paidAt),
      payment.paidAmount,
    ]),
    {
      widths: [6, 36, 8, 18, 14, 28, 14, 12, 18],
      money: [3, 8],
      percent: [2],
      footer: ['', 'Tổng cộng', null, sum(payments, (p) => p.amount), '', '', '', '', sum(payments, (p) => p.paidAmount)],
    },
  );
}

/** Workbook chi phí một dự án (hàm thuần, dễ kiểm thử). */
export function buildProjectCostWorkbook(data: ProjectCostExport, exportedAt = new Date()): WorkBook {
  const book = utils.book_new();
  utils.book_append_sheet(book, summarySheet(data.summary, exportedAt), 'Tổng hợp');
  utils.book_append_sheet(book, itemsSheet(data.summary), 'Dự toán vs thực tế');
  utils.book_append_sheet(book, entriesSheet(data.entries), 'Chi phí thực tế');
  utils.book_append_sheet(book, changeOrdersSheet(data.changeOrders), 'Phát sinh');
  utils.book_append_sheet(book, paymentsSheet(data.payments), 'Thanh toán');
  return book;
}

/** Workbook báo cáo lãi/lỗ toàn danh mục. */
export function buildProfitLossWorkbook(rows: readonly ProfitLossRow[]): WorkBook {
  const book = utils.book_new();
  const sheet = tableSheet(
    [
      'Mã dự án',
      'Tên dự án',
      'Trạng thái',
      'Giá trị HĐ',
      'Dự toán chi phí',
      'Chi phí thực tế',
      '% khối lượng',
      'Doanh thu ghi nhận',
      'Đã thu',
      'Còn phải thu',
      'Lãi/lỗ đến nay',
      'Chi phí dự báo',
      'Lãi/lỗ dự báo',
      'Tỷ suất dự báo',
    ],
    rows.map((row) => [
      row.projectCode,
      row.projectName,
      row.status,
      row.contractValue,
      row.costBudget,
      row.actualCost,
      row.progress,
      row.earnedRevenue,
      row.received,
      row.receivable,
      row.profitToDate,
      row.forecastCost,
      row.forecastProfit,
      row.forecastMargin,
    ]),
    {
      widths: [12, 40, 14, 18, 18, 18, 12, 18, 18, 18, 18, 18, 18, 12],
      money: [3, 4, 5, 7, 8, 9, 10, 11, 12],
      percent: [6, 13],
      footer: [
        '',
        'Tổng cộng',
        '',
        sum(rows, (row) => row.contractValue),
        sum(rows, (row) => row.costBudget),
        sum(rows, (row) => row.actualCost),
        null,
        sum(rows, (row) => row.earnedRevenue),
        sum(rows, (row) => row.received),
        sum(rows, (row) => row.receivable),
        sum(rows, (row) => row.profitToDate ?? 0),
        sum(rows, (row) => row.forecastCost ?? 0),
        sum(rows, (row) => row.forecastProfit ?? 0),
        null,
      ],
    },
  );
  utils.book_append_sheet(book, sheet, 'Lãi lỗ');
  return book;
}

function stamp(date: Date): string {
  return toIsoDate(date).replaceAll('-', '');
}

export function exportProjectCostExcel(data: ProjectCostExport): void {
  writeFile(buildProjectCostWorkbook(data), `chi-phi-${data.summary.projectCode}-${stamp(new Date())}.xlsx`);
}

export function exportProfitLossExcel(rows: readonly ProfitLossRow[]): void {
  writeFile(buildProfitLossWorkbook(rows), `lai-lo-du-an-${stamp(new Date())}.xlsx`);
}
