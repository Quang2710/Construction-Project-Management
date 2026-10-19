import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { HasUnsavedChanges } from '../../../../core/guards/unsaved-changes.guard';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { VndPipe } from '../../../../shared/pipes/vnd.pipe';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { parseIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { MapMarker, MapPoint, ProjectMapComponent } from '../../components/project-map/project-map.component';
import { ProjectFormStore } from '../../data-access/project-form.store';
import {
  Project,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  ProjectStatus,
  ProjectUpsertRequest,
  PROVINCES,
} from '../../models/project.model';
import { PROJECT_STATUS_COLORS } from '../../utils/project-status.utils';

interface ProjectForm {
  code: FormControl<string>;
  name: FormControl<string>;
  clientName: FormControl<string>;
  description: FormControl<string>;
  address: FormControl<string>;
  province: FormControl<string>;
  lat: FormControl<number | null>;
  lng: FormControl<number | null>;
  startDate: FormControl<Date | null>;
  endDate: FormControl<Date | null>;
  budget: FormControl<number | null>;
  status: FormControl<ProjectStatus>;
  managerId: FormControl<string | null>;
  memberIds: FormControl<string[]>;
}

const MIN_BUDGET = 1_000_000;

/** Ngày kết thúc phải sau hoặc bằng ngày bắt đầu (đặt trên control endDate). */
const endAfterStart: ValidatorFn = (control: AbstractControl<Date | null>): ValidationErrors | null => {
  const start = (control.parent as FormGroup<ProjectForm> | null)?.controls.startDate.value;
  const end = control.value;
  return start && end && end.getTime() < start.getTime() ? { endBeforeStart: true } : null;
};

function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

@Component({
  selector: 'app-project-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    VndPipe,
    PageHeaderComponent,
    ErrorStateComponent,
    ProjectMapComponent,
  ],
  providers: [ProjectFormStore],
  templateUrl: './project-form-page.component.html',
  styleUrl: './project-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectFormPageComponent implements HasUnsavedChanges {
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  protected readonly store = inject(ProjectFormStore);

  /** Tham số :id khi sửa; không có khi tạo mới. */
  readonly id = input<string>();

  protected readonly statuses = PROJECT_STATUSES;
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly provinces = PROVINCES;
  protected readonly submitError = signal<string | null>(null);
  private readonly saved = signal(false);

  protected readonly form = new FormGroup<ProjectForm>({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Z0-9-]{3,20}$/)],
    }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    clientName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(300)] }),
    province: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lat: new FormControl<number | null>(null, [Validators.required, Validators.min(-90), Validators.max(90)]),
    lng: new FormControl<number | null>(null, [Validators.required, Validators.min(-180), Validators.max(180)]),
    startDate: new FormControl<Date | null>(null, [Validators.required]),
    endDate: new FormControl<Date | null>(null, [Validators.required, endAfterStart]),
    budget: new FormControl<number | null>(null, [Validators.required, Validators.min(MIN_BUDGET)]),
    status: new FormControl<ProjectStatus>('PLANNING', { nonNullable: true }),
    managerId: new FormControl<string | null>(null),
    memberIds: new FormControl<string[]>([], { nonNullable: true }),
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly title = computed(() => (this.id() ? 'Chỉnh sửa dự án' : 'Tạo dự án mới'));
  protected readonly budgetPreview = computed(() => this.formValue().budget ?? null);
  protected readonly markers = computed<MapMarker[]>(() => {
    const { lat, lng, name, status } = this.formValue();
    return typeof lat === 'number' && typeof lng === 'number'
      ? [{ id: 'picked', lat, lng, title: name || 'Vị trí công trình', color: PROJECT_STATUS_COLORS[status ?? 'PLANNING'] }]
      : [];
  });

  constructor() {
    this.form.controls.startDate.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.endDate.updateValueAndValidity());

    effect(() => {
      const id = this.id() ?? null;
      untracked(() => void this.store.init(id));
    });
    effect(() => {
      const project = this.store.project();
      if (project && !this.saved()) {
        untracked(() => this.fillForm(project));
      }
    });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saved();
  }

  protected pickLocation(point: MapPoint): void {
    if (this.form.disabled) {
      return;
    }
    this.form.patchValue({ lat: roundCoord(point.lat), lng: roundCoord(point.lng) });
    this.form.controls.lat.markAsDirty();
    this.form.markAsDirty();
  }

  protected retry(): void {
    void this.store.init(this.id() ?? null);
  }

  protected async submit(): Promise<void> {
    this.submitError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const result = await this.store.save(this.toRequest());
    if (result.ok) {
      this.saved.set(true);
      this.notification.success(this.id() ? 'Đã cập nhật dự án.' : `Đã tạo dự án ${result.project.code}.`);
      await this.router.navigate(['/projects', result.project.id]);
      return;
    }
    if (result.code === 'PROJECT_CODE_EXISTS') {
      this.form.controls.code.setErrors({ duplicate: true });
      this.form.controls.code.markAsTouched();
    }
    this.submitError.set(result.message);
  }

  private fillForm(project: Project): void {
    this.form.reset({
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      description: project.description,
      address: project.location.address,
      province: project.location.province,
      lat: project.location.lat,
      lng: project.location.lng,
      startDate: parseIsoDate(project.startDate),
      endDate: parseIsoDate(project.endDate),
      budget: project.budget,
      status: project.status,
      managerId: project.managerId,
      memberIds: [...project.memberIds],
    });
  }

  private toRequest(): ProjectUpsertRequest {
    const value = this.form.getRawValue();
    return {
      code: value.code.trim().toUpperCase(),
      name: value.name.trim(),
      clientName: value.clientName.trim(),
      description: value.description.trim(),
      location: {
        address: value.address.trim(),
        province: value.province,
        lat: value.lat ?? 0,
        lng: value.lng ?? 0,
      },
      startDate: value.startDate ? toIsoDate(value.startDate) : '',
      endDate: value.endDate ? toIsoDate(value.endDate) : '',
      budget: value.budget ?? 0,
      status: value.status,
      managerId: value.managerId,
      memberIds: value.memberIds,
    };
  }
}
