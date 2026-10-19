import { ChangeDetectionStrategy, Component, inject, input, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { MaterialsStore } from '../../data-access/materials.store';
import { MaterialsDialogsService } from './materials-dialogs.service';
import { CatalogPanelComponent } from './panels/catalog-panel.component';
import { RequestsPanelComponent } from './panels/requests-panel.component';
import { StockPanelComponent } from './panels/stock-panel.component';
import { TransactionsPanelComponent } from './panels/transactions-panel.component';

@Component({
  selector: 'app-materials-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTabsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    StockPanelComponent,
    RequestsPanelComponent,
    TransactionsPanelComponent,
    CatalogPanelComponent,
  ],
  providers: [MaterialsStore, MaterialsDialogsService],
  template: `
    <app-page-header title="Vật tư" subtitle="Tồn kho theo công trường, phiếu yêu cầu và nhập/xuất kho">
      @if (store.canHandle()) {
        <button mat-flat-button type="button" [disabled]="!store.projectId()" (click)="dialogs.scan()">
          <mat-icon>qr_code_scanner</mat-icon>
          Quét mã QR
        </button>
      }
    </app-page-header>

    <mat-form-field class="project" subscriptSizing="dynamic">
      <mat-label>Công trường</mat-label>
      <mat-select [value]="store.projectId()" (valueChange)="store.setProject($event)">
        @for (project of store.projects(); track project.id) {
          <mat-option [value]="project.id">{{ project.code }} · {{ project.name }}</mat-option>
        }
      </mat-select>
    </mat-form-field>

    @if (!store.stockLoading() && store.projects().length === 0) {
      <app-empty-state icon="warehouse" title="Chưa có công trường" message="Bạn chưa được gán vào công trường đang hoạt động." />
    } @else if (store.projectId()) {
      <mat-tab-group mat-stretch-tabs="false" mat-align-tabs="start" animationDuration="150ms">
        <mat-tab>
          <ng-template mat-tab-label>
            Tồn kho
            @if (store.lowStock().length) {
              <span class="badge" [attr.aria-label]="store.lowStock().length + ' vật tư thiếu'">{{ store.lowStock().length }}</span>
            }
          </ng-template>
          <ng-template matTabContent><app-stock-panel /></ng-template>
        </mat-tab>
        <mat-tab label="Phiếu yêu cầu">
          <ng-template matTabContent><app-requests-panel /></ng-template>
        </mat-tab>
        <mat-tab label="Lịch sử nhập/xuất">
          <ng-template matTabContent><app-transactions-panel /></ng-template>
        </mat-tab>
        <mat-tab label="Danh mục vật tư">
          <ng-template matTabContent><app-catalog-panel /></ng-template>
        </mat-tab>
      </mat-tab-group>
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
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
      font: var(--mat-sys-label-small);
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
