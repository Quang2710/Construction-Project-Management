import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OutboxContext, OutboxOutcome, OutboxService } from '../../../core/offline/outbox.service';
import { ImageCompressor } from '../../../shared/data-access/image-compressor.service';
import { UploadsApiService } from '../../../shared/data-access/uploads-api.service';
import { toApiError } from '../../../shared/utils/api-error';
import { DiaryContent, DiaryPhoto, GeoPoint } from '../models/site-diary.model';
import { SiteDiariesApiService } from './site-diaries-api.service';
import { DIARY_OUTBOX_KIND } from './diary-outbox.kind';

/** Ảnh chụp khi mất mạng: giữ Blob gốc trong IndexedDB, nén + tải lên khi đồng bộ. */
export interface PendingPhoto {
  readonly blob: Blob;
  readonly fileName: string;
  readonly caption: string;
  readonly takenAt: string;
  readonly location: GeoPoint | null;
}

export interface DiaryOutboxPayload {
  /** null = nhật ký mới; có id sau khi đã tạo được trên server (để lần thử sau không tạo trùng). */
  readonly diaryId: string | null;
  readonly projectId: string;
  readonly projectCode: string;
  readonly date: string;
  /** content.photos = các ảnh đã có trên server. */
  readonly content: DiaryContent;
  readonly pendingPhotos: readonly PendingPhoto[];
  readonly submit: boolean;
}

function formatDate(iso: string): string {
  return iso.split('-').reverse().join('/');
}

/** Đồng bộ nhật ký công trường lập/sửa khi mất mạng; processor được đăng ký tải lười trong app.config.ts. */
@Injectable({ providedIn: 'root' })
export class DiaryOutboxService {
  private readonly outbox = inject(OutboxService);
  private readonly diariesApi = inject(SiteDiariesApiService);
  private readonly uploads = inject(UploadsApiService);
  private readonly compressor = inject(ImageCompressor);

  /** Nhật ký đang chờ đồng bộ của người dùng hiện tại. */
  readonly entries = computed(() => this.outbox.entries().filter((entry) => entry.kind === DIARY_OUTBOX_KIND));

  enqueue(payload: DiaryOutboxPayload): Promise<unknown> {
    return this.outbox.enqueue(DIARY_OUTBOX_KIND, `Nhật ký ${payload.projectCode} · ${formatDate(payload.date)}`, payload);
  }

  /** Mỗi bước thành công đều lưu tiến độ: ảnh đã tải → bỏ khỏi pendingPhotos; nhật ký đã tạo → ghi diaryId. */
  async process(initial: DiaryOutboxPayload, context: OutboxContext<DiaryOutboxPayload>): Promise<OutboxOutcome> {
    let payload = initial;
    try {
      for (const pending of payload.pendingPhotos) {
        const compressed = await this.compressor.compress(pending.blob);
        const fileName = pending.fileName.replace(/\.[^.]+$/, '') + '.jpg';
        const uploaded = await firstValueFrom(this.uploads.upload(compressed, fileName));
        const photo: DiaryPhoto = {
          id: uploaded.id,
          url: uploaded.url,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          size: uploaded.size,
          caption: pending.caption,
          takenAt: pending.takenAt,
          location: pending.location,
        };
        payload = {
          ...payload,
          content: { ...payload.content, photos: [...payload.content.photos, photo] },
          pendingPhotos: payload.pendingPhotos.filter((item) => item !== pending),
        };
        await context.saveProgress(payload);
      }

      let diaryId = payload.diaryId;
      if (diaryId) {
        await firstValueFrom(this.diariesApi.update(diaryId, payload.content));
      } else {
        const created = await firstValueFrom(
          this.diariesApi.create({ ...payload.content, projectId: payload.projectId, date: payload.date }),
        );
        diaryId = created.id;
        payload = { ...payload, diaryId };
        await context.saveProgress(payload);
      }
      if (payload.submit) {
        await firstValueFrom(this.diariesApi.submit(diaryId));
      }
      return {
        kind: 'done',
        message: `Đã đồng bộ nhật ký ${payload.projectCode} ngày ${formatDate(payload.date)}${payload.submit ? ' và gửi duyệt' : ''}.`,
        link: `/site-diaries/${diaryId}`,
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 0) {
        return { kind: 'offline' };
      }
      return { kind: 'failed', message: toApiError(error).message };
    }
  }
}
