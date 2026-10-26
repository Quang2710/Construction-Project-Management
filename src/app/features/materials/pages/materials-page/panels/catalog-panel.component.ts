import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppDialog } from '../../../../../shared/ui/dialog/app-dialog.service';
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
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { TooltipModule } from 'primeng/tooltip';
import { FIELD } from '../../../../../shared/ui/field/field.component';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { toOptions } from '../../../../../shared/utils/options';

@Component({
  selector: 'app-catalog-panel',
  imports: [
    FormsModule,
    VndPipe,
    EmptyStateComponent,
    ButtonModule,
    IconComponent,
    TooltipModule,
    ...FIELD,
    InputTextModule,
    SelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <app-field class="toolbar__search" dense>
        <label fieldLabel>Tìm vật tư</label>
        <app-icon fieldPrefix>search</app-icon>
        <input #search pInputText [value]="query()" (input)="query.set(search.value)" />
      </app-field>
      <app-field dense>
        <label fieldLabel>Nhóm</label>
        <p-select [ngModel]="category()" (ngModelChange)="category.set($event)" [options]="categoryOptions" optionLabel="label" optionValue="value" [showClear]="true" placeholder="Tất cả nhóm" [fluid]="true" />
      </app-field>
      <span class="toolbar__spacer"></span>
      @if (store.canManage()) {
        <button pButton type="button" (click)="edit(null)"><app-icon>add</app-icon> Thêm vật tư</button>
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
                  <button pButton text rounded severity="secondary" type="button" pTooltip="Nhãn QR" tooltipPosition="bottom" aria-label="Nhãn QR" (click)="showQr(material)">
                    <app-icon pButtonIcon>qr_code_2</app-icon>
                  </button>
                  @if (store.canManage()) {
                    <button pButton text rounded severity="secondary" type="button" pTooltip="Sửa" tooltipPosition="bottom" aria-label="Sửa" (click)="edit(material)">
                      <app-icon pButtonIcon>edit</app-icon>
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
  private readonly dialog = inject(AppDialog);
  protected readonly store = inject(MaterialsStore);
  protected readonly categories = MATERIAL_CATEGORIES;
  protected readonly categoryLabels = MATERIAL_CATEGORY_LABELS;
  protected readonly categoryOptions = toOptions(this.categories, this.categoryLabels);
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
