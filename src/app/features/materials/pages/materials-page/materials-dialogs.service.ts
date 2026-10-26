import { inject, Injectable } from '@angular/core';
import { AppDialog } from '../../../../shared/ui/dialog/app-dialog.service';
import { firstValueFrom } from 'rxjs';
import { QrScanDialogComponent, QrScanDialogData } from '../../components/qr-scan-dialog/qr-scan-dialog.component';
import {
  RequestDetailDialogComponent,
  RequestDetailDialogData,
  RequestDetailResult,
} from '../../components/request-detail-dialog/request-detail-dialog.component';
import {
  RequestFormDialogComponent,
  RequestFormDialogData,
  RequestFormResult,
} from '../../components/request-form-dialog/request-form-dialog.component';
import {
  StockMovementDialogComponent,
  StockMovementDialogData,
  StockMovementResult,
} from '../../components/stock-movement-dialog/stock-movement-dialog.component';
import { MaterialsStore } from '../../data-access/materials.store';
import { MaterialRequest, StockTransactionType } from '../../models/material.model';

const DIALOG_SIZE = { width: '560px', maxWidth: 'calc(100vw - 24px)' };

/** Mở các dialog nghiệp vụ kho; được cung cấp ở cấp trang Vật tư (cùng MaterialsStore). */
@Injectable()
export class MaterialsDialogsService {
  private readonly dialog = inject(AppDialog);
  private readonly store = inject(MaterialsStore);

  async openMovement(type: StockTransactionType, materialId?: string): Promise<boolean> {
    const ref = this.dialog.open<StockMovementDialogComponent, StockMovementDialogData, StockMovementResult>(
      StockMovementDialogComponent,
      { ...DIALOG_SIZE, data: { type, materialId, materials: this.store.catalog(), stock: this.store.stock() } },
    );
    const result = await firstValueFrom(ref.afterClosed());
    return result ? this.store.moveStock(result.type, result.materialId, result.quantity, result.note) : false;
  }

  async openRequestForm(prefill?: RequestFormDialogData['prefill']): Promise<MaterialRequest | null> {
    const ref = this.dialog.open<RequestFormDialogComponent, RequestFormDialogData, RequestFormResult>(
      RequestFormDialogComponent,
      {
        ...DIALOG_SIZE,
        width: '640px',
        data: { projectCode: this.store.project()?.code ?? '', materials: this.store.catalog(), prefill },
      },
    );
    const result = await firstValueFrom(ref.afterClosed());
    return result ? this.store.createRequest(result) : null;
  }

  async openRequestDetail(request: MaterialRequest): Promise<void> {
    const ref = this.dialog.open<RequestDetailDialogComponent, RequestDetailDialogData, RequestDetailResult>(
      RequestDetailDialogComponent,
      {
        ...DIALOG_SIZE,
        width: '680px',
        data: { request, canApprove: this.store.canApprove(), canHandle: this.store.canHandle() },
      },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await this.store.actOnRequest(request.id, result.action, result.note);
    }
  }

  /** Quét QR → tra cứu vật tư → mở phiếu nhập/xuất với vật tư đã chọn. */
  async scan(): Promise<void> {
    const ref = this.dialog.open<QrScanDialogComponent, QrScanDialogData, string>(QrScanDialogComponent, {
      ...DIALOG_SIZE,
      data: { sampleCodes: this.store.stock().map((item) => item.material.code) },
    });
    const code = await firstValueFrom(ref.afterClosed());
    if (!code) {
      return;
    }
    const material = await this.store.lookupByCode(code);
    if (material) {
      const inStock = this.store.stock().some((item) => item.material.id === material.id && item.quantity > 0);
      await this.openMovement(inStock ? 'OUT' : 'IN', material.id);
    }
  }
}
