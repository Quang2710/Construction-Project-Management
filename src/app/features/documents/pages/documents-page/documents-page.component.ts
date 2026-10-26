import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AppDialog } from '../../../../shared/ui/dialog/app-dialog.service';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import {
  DrawingUploadDialogComponent,
  DrawingUploadDialogData,
  DrawingUploadResult,
} from '../../components/drawing-upload-dialog/drawing-upload-dialog.component';
import { DocumentsStore } from '../../data-access/documents.store';
import { Discipline, DISCIPLINE_LABELS, DISCIPLINES, Drawing } from '../../models/document.model';
import { ButtonModule } from 'primeng/button';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { ProgressBarModule } from 'primeng/progressbar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FIELD } from '../../../../shared/ui/field/field.component';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonChangeEvent, SelectButtonModule } from 'primeng/selectbutton';
import { withAllOption } from '../../../../shared/utils/options';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';

const ALL = 'ALL';

@Component({
  selector: 'app-documents-page',
  imports: [
    FormsModule,
    DatePipe,
    ReactiveFormsModule,
    SelectButtonModule,
    PaginatorModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ButtonModule,
    IconComponent,
    ProgressBarModule,
    ProgressSpinnerModule,
    ...FIELD,
    InputTextModule,
    SelectModule,
  ],
  providers: [DocumentsStore],
  templateUrl: './documents-page.component.html',
  styleUrl: './documents-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly dialog = inject(AppDialog);
  protected readonly store = inject(DocumentsStore);

  /** ?projectId= khi quay lại từ trang bản vẽ. */
  readonly projectId = input<string>();

  protected readonly allValue = ALL;
  protected readonly disciplines = DISCIPLINES;
  protected readonly disciplineLabels = DISCIPLINE_LABELS;
  protected readonly disciplineFilterOptions = withAllOption(this.disciplines, this.disciplineLabels, 'Tất cả bộ môn');
  protected readonly search = new FormControl(this.store.query(), { nonNullable: true });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => void this.store.setFilter({ query }));
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    void this.store.init(this.projectId() ?? null);
  }

  protected onProject(projectId: string): void {
    void this.store.setProject(projectId);
    void this.router.navigate([], { queryParams: { projectId }, replaceUrl: true });
  }

  protected onDiscipline(event: SelectButtonChangeEvent): void {
    const value: unknown = event.value;
    void this.store.setFilter({ discipline: typeof value === 'string' && value !== ALL ? (value as Discipline) : null });
  }

  protected onPage(event: PaginatorState): void {
    void this.store.setFilter({ page: (event.page ?? 0) + 1 });
  }

  protected open(drawing: Drawing): void {
    void this.router.navigate(['/documents', drawing.id]);
  }

  protected async upload(): Promise<void> {
    const ref = this.dialog.open<DrawingUploadDialogComponent, DrawingUploadDialogData, DrawingUploadResult>(DrawingUploadDialogComponent, {
      width: '600px',
      maxWidth: 'calc(100vw - 24px)',
      data: { mode: 'drawing', projectCode: this.store.project()?.code ?? '' },
    });
    const result = await firstValueFrom(ref.afterClosed());
    const created = result?.draft ? await this.store.create(result.draft, result.file) : null;
    if (created) {
      await this.router.navigate(['/documents', created.id]);
    }
  }
}
