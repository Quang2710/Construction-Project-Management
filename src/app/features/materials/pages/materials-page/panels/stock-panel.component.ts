import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { removeVietnameseTones } from '../../../../../shared/utils/string.utils';
import { MaterialQrDialogComponent } from '../../../components/material-qr-dialog/material-qr-dialog.component';
import { MinQuantityDialogComponent } from '../../../components/min-quantity-dialog/min-quantity-dialog.component';
import { MaterialsStore } from '../../../data-access/materials.store';
import { MATERIAL_CATEGORY_LABELS, StockItem, StockTransactionType } from '../../../models/material.model';
import { MaterialsDialogsService } from '../materials-dialogs.service';

@Component({
  selector: 'app-stock-panel',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTooltipModule,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock-panel.component.html',
  styleUrl: './panels.scss',
})
export class StockPanelComponent {
  private readonly dialog = inject(MatDialog);
  private readonly dialogs = inject(MaterialsDialogsService);
  protected readonly store = inject(MaterialsStore);
  protected readonly categoryLabels = MATERIAL_CATEGORY_LABELS;

  protected readonly query = signal('');
  protected readonly lowOnly = signal(false);
  protected readonly items = computed(() => {
    const keyword = removeVietnameseTones(this.query().trim()).toLowerCase();
    return this.store
      .stock()
      .filter((item) => !this.lowOnly() || item.isLow)
      .filter(
        (item) =>
          !keyword ||
          removeVietnameseTones(`${item.material.code} ${item.material.name}`).toLowerCase().includes(keyword),
      );
  });

  /** % tồn so với 2 lần mức tối thiểu (để vẽ thanh mức độ). */
  protected level(item: StockItem): number {
    const target = Math.max(item.minQuantity * 2, 1);
    return Math.min(100, Math.round((item.quantity / target) * 100));
  }

  protected move(type: StockTransactionType, item?: StockItem): void {
    void this.dialogs.openMovement(type, item?.material.id);
  }

  protected async editMin(item: StockItem): Promise<void> {
    const ref = this.dialog.open<MinQuantityDialogComponent, StockItem, number>(MinQuantityDialogComponent, {
      data: item,
      width: '400px',
      maxWidth: 'calc(100vw - 32px)',
    });
    const value = await firstValueFrom(ref.afterClosed());
    if (value !== undefined) {
      await this.store.setMinQuantity(item.material.id, value);
    }
  }

  protected showQr(item: StockItem): void {
    this.dialog.open(MaterialQrDialogComponent, { data: item.material });
  }

  protected requestLowStock(): void {
    void this.dialogs.openRequestForm(
      this.store.lowStock().map((item) => ({
        materialId: item.material.id,
        // Đề xuất bổ sung lên gấp đôi mức tối thiểu.
        quantity: Math.max(1, item.minQuantity * 2 - item.quantity),
      })),
    );
  }
}
