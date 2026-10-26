import type { PDFDocumentProxy } from 'pdfjs-dist';

export type PdfDocument = PDFDocumentProxy;

/** Worker được copy vào /pdfjs khi build (xem angular.json > assets). */
const WORKER_SRC = 'pdfjs/pdf.worker.min.mjs';

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

/** Tải lười pdf.js (~400 kB) chỉ khi mở bản vẽ. */
function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
  pdfjsPromise ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(WORKER_SRC, document.baseURI).href;
    return pdfjs;
  });
  return pdfjsPromise;
}

/** pdf.js chuyển (transfer) buffer sang worker nên truyền bản sao để giữ được bộ nhớ đệm. */
export async function openPdf(data: ArrayBuffer): Promise<PdfDocument> {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
}

/** Giải phóng tài liệu và worker liên quan (pdf.js v6: huỷ qua loadingTask). */
export function closePdf(pdf: PdfDocument | null | undefined): void {
  void pdf?.loadingTask.destroy();
}

export interface RenderedPage {
  readonly width: number;
  readonly height: number;
}

/**
 * Vẽ một trang lên canvas. `scale` là tỉ lệ so với kích thước gốc (1 = 72 dpi);
 * nhân devicePixelRatio để nét mảnh không bị nhoè trên màn hình mật độ cao.
 */
export async function renderPage(pdf: PdfDocument, pageNumber: number, scale: number, canvas: HTMLCanvasElement): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNumber);
  const ratio = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * ratio });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
  canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
  await page.render({ canvas, viewport }).promise;
  return { width: canvas.width, height: canvas.height };
}

/** Tỉ lệ để trang vừa khít chiều rộng khung xem. */
export async function fitWidthScale(pdf: PdfDocument, pageNumber: number, containerWidth: number): Promise<number> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  return Math.max(0.1, containerWidth / viewport.width);
}
