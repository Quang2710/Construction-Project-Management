import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { Popover, PopoverModule } from 'primeng/popover';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { AppDialog } from '../../../../../shared/ui/dialog/app-dialog.service';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../../shared/ui/state/error-state.component';
import { removeVietnameseTones } from '../../../../../shared/utils/string.utils';
import { MaterialQrDialogComponent } from '../../../components/material-qr-dialog/material-qr-dialog.component';
import { MinQuantityDialogComponent } from '../../../components/min-quantity-dialog/min-quantity-dialog.component';
import { MaterialsStore } from '../../../data-access/materials.store';
import { MATERIAL_CATEGORY_LABELS, StockItem, StockTransactionType } from '../../../models/material.model';
import { MaterialsDialogsService } from '../materials-dialogs.service';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../../shared/ui/field/field.component';

@Component({
  selector: 'app-stock-panel',
  imports: [
    DecimalPipe,
    FormsModule,
    PopoverModule,
    ToggleSwitchModule,
    VndPipe,
    EmptyStateComponent,
    ErrorStateComponent,
    ButtonModule,
    IconComponent,
    TooltipModule,
    ProgressBarModule,
    ...FIELD,
    InputTextModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock-panel.component.html',
  styleUrl: './panels.scss',
})
export class StockPanelComponent {
  private readonly dialog = inject(AppDialog);
  private readonly dialogs = inject(MaterialsDialogsService);
  protected readonly store = inject(MaterialsStore);
  protected readonly categoryLabels = MATERIAL_CATEGORY_LABELS;

  protected readonly query = signal('');
  protected readonly lowOnly = signal(false);
  /** Dòng đang mở menu thao tác (một popover dùng chung cho cả bảng). */
  protected readonly menuItem = signal<StockItem | null>(null);
  private readonly rowMenu = viewChild.required<Popover>('rowMenu');
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

  protected openMenu(event: Event, item: StockItem): void {
    this.menuItem.set(item);
    this.rowMenu().toggle(event);
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
