import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { VndPipe } from '../../../../../shared/pipes/vnd.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/state/empty-state.component';
import { removeVietnameseTones } from '../../../../../shared/utils/string.utils';
import { MaterialFormDialogComponent } from '../../../components/material-form-dialog/material-form-dialog.component';
import { MaterialQrDialogComponent } from '../../../components/material-qr-dialog/material-qr-dialog.component';
import { MaterialsStore } from '../../../data-access/materials.store';
import {
  Material,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  MaterialCategory,
  MaterialUpsertRequest,
} from '../../../models/material.model';

@Component({
  selector: 'app-catalog-panel',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    VndPipe,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <mat-form-field class="toolbar__search" subscriptSizing="dynamic">
        <mat-label>Tìm vật tư</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input #search matInput [value]="query()" (input)="query.set(search.value)" />
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Nhóm</mat-label>
        <mat-select [value]="category()" (valueChange)="category.set($event)">
          <mat-option [value]="null">Tất cả nhóm</mat-option>
          @for (item of categories; track item) {
            <mat-option [value]="item">{{ categoryLabels[item] }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <span class="toolbar__spacer"></span>
      @if (store.canManage()) {
        <button mat-flat-button type="button" (click)="edit(null)"><mat-icon>add</mat-icon> Thêm vật tư</button>
      }
    </div>

    @if (items().length === 0) {
      <app-empty-state icon="category" title="Không có vật tư phù hợp" />
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên vật tư</th>
              <th class="hide-sm">Nhóm</th>
              <th>ĐVT</th>
              <th class="num">Đơn giá</th>
              <th><span class="cdk-visually-hidden">Thao tác</span></th>
            </tr>
          </thead>
          <tbody>
            @for (material of items(); track material.id) {
              <tr>
                <td class="name">{{ material.code }}</td>
                <td>
                  {{ material.name }}
                  @if (material.description) {
                    <div class="sub">{{ material.description }}</div>
                  }
                </td>
                <td class="hide-sm">{{ categoryLabels[material.category] }}</td>
                <td>{{ material.unit }}</td>
                <td class="num">{{ material.unitPrice | vnd }}</td>
                <td class="actions">
                  <button mat-icon-button type="button" matTooltip="Nhãn QR" aria-label="Nhãn QR" (click)="showQr(material)">
                    <mat-icon>qr_code_2</mat-icon>
                  </button>
                  @if (store.canManage()) {
                    <button mat-icon-button type="button" matTooltip="Sửa" aria-label="Sửa" (click)="edit(material)">
                      <mat-icon>edit</mat-icon>
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styleUrl: './panels.scss',
  styles: `
    .actions {
      width: 96px;
      white-space: nowrap;
    }
  `,
})
export class CatalogPanelComponent {
  private readonly dialog = inject(MatDialog);
  protected readonly store = inject(MaterialsStore);
  protected readonly categories = MATERIAL_CATEGORIES;
  protected readonly categoryLabels = MATERIAL_CATEGORY_LABELS;
  protected readonly query = signal('');
  protected readonly category = signal<MaterialCategory | null>(null);

  protected readonly items = computed(() => {
    const keyword = removeVietnameseTones(this.query().trim()).toLowerCase();
    return this.store
      .catalog()
      .filter((material) => !this.category() || material.category === this.category())
      .filter((material) => !keyword || removeVietnameseTones(`${material.code} ${material.name}`).toLowerCase().includes(keyword));
  });

  protected showQr(material: Material): void {
    this.dialog.open(MaterialQrDialogComponent, { data: material });
  }

  protected async edit(material: Material | null): Promise<void> {
    const ref = this.dialog.open<MaterialFormDialogComponent, Material | null, MaterialUpsertRequest>(MaterialFormDialogComponent, {
      data: material,
      width: '520px',
      maxWidth: 'calc(100vw - 24px)',
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await this.store.saveMaterial(material?.id ?? null, result);
    }
  }
}
