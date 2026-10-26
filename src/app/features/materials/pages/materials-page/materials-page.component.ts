import { ChangeDetectionStrategy, Component, inject, input, OnInit } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { MaterialsStore } from '../../data-access/materials.store';
import { MaterialsDialogsService } from './materials-dialogs.service';
import { CatalogPanelComponent } from './panels/catalog-panel.component';
import { RequestsPanelComponent } from './panels/requests-panel.component';
import { StockPanelComponent } from './panels/stock-panel.component';
import { TransactionsPanelComponent } from './panels/transactions-panel.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';

@Component({
  selector: 'app-materials-page',
  imports: [
    FormsModule,
    TabsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    StockPanelComponent,
    RequestsPanelComponent,
    TransactionsPanelComponent,
    CatalogPanelComponent,
    ButtonModule,
    IconComponent,
    ...FIELD,
    SelectModule,
  ],
  providers: [MaterialsStore, MaterialsDialogsService],
  template: `
    <app-page-header title="Vật tư" subtitle="Tồn kho theo công trường, phiếu yêu cầu và nhập/xuất kho">
      @if (store.canHandle()) {
        <button pButton type="button" [disabled]="!store.projectId()" (click)="dialogs.scan()">
          <app-icon>qr_code_scanner</app-icon>
          Quét mã QR
        </button>
      }
    </app-page-header>

    <app-field class="project" dense>
      <label fieldLabel>Công trường</label>
      <p-select [ngModel]="store.projectId()" (ngModelChange)="store.setProject($event)" [options]="store.projects()" optionValue="id" placeholder="Chọn…" [filter]="true" filterBy="code,name" emptyFilterMessage="Không tìm thấy dự án" [fluid]="true">
        <ng-template #selectedItem let-project>{{ project.code }} · {{ project.name }}</ng-template>
        <ng-template #item let-project>{{ project.code }} · {{ project.name }}</ng-template>
      </p-select>
    </app-field>

    @if (!store.stockLoading() && store.projects().length === 0) {
      <app-empty-state icon="warehouse" title="Chưa có công trường" message="Bạn chưa được gán vào công trường đang hoạt động." />
    } @else if (store.projectId()) {
      <p-tabs [value]="0" [lazy]="true" [scrollable]="true">
        <p-tablist>
          <p-tab [value]="0">
            Tồn kho
            @if (store.lowStock().length) {
              <span class="badge" [attr.aria-label]="store.lowStock().length + ' vật tư thiếu'">{{ store.lowStock().length }}</span>
            }
          </p-tab>
          <p-tab [value]="1">Phiếu yêu cầu</p-tab>
          <p-tab [value]="2">Lịch sử nhập/xuất</p-tab>
          <p-tab [value]="3">Danh mục vật tư</p-tab>
        </p-tablist>
        <p-tabpanels>
          <p-tabpanel [value]="0">
            <ng-template #content>
              <app-stock-panel />
            </ng-template>
          </p-tabpanel>
          <p-tabpanel [value]="1">
            <ng-template #content>
              <app-requests-panel />
            </ng-template>
          </p-tabpanel>
          <p-tabpanel [value]="2">
            <ng-template #content>
              <app-transactions-panel />
            </ng-template>
          </p-tabpanel>
          <p-tabpanel [value]="3">
            <ng-template #content>
              <app-catalog-panel />
            </ng-template>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    }
  `,
  styles: `
    .project {
      width: min(420px, 100%);
      margin-bottom: 8px;
    }
    .badge {
      min-width: 20px;
      margin-left: 6px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--app-error);
      color: var(--app-on-error);
      font: var(--app-label-small);
      line-height: 20px;
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialsPageComponent implements OnInit {
  protected readonly store = inject(MaterialsStore);
  protected readonly dialogs = inject(MaterialsDialogsService);

  /** ?projectId= khi mở từ nơi khác. */
  readonly projectId = input<string>();

  ngOnInit(): void {
    void this.store.init(this.projectId() ?? null);
  }
}
