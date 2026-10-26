import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
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
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state.component';
import { isValidIsoDate, parseIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { PhotoUploaderComponent } from '../../components/photo-uploader/photo-uploader.component';
import { DiaryFormStore, MAX_PHOTOS } from '../../data-access/diary-form.store';
import {
  CREW_SUGGESTIONS,
  DiaryContent,
  EDITABLE_DIARY_STATUSES,
  EQUIPMENT_SUGGESTIONS,
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPE_LABELS,
  INCIDENT_TYPES,
  IncidentEntry,
  IncidentSeverity,
  IncidentType,
  SiteDiary,
  UNIT_SUGGESTIONS,
  WEATHER_CONDITIONS,
  WEATHER_LABELS,
  WeatherCondition,
} from '../../models/site-diary.model';

interface LaborForm {
  crew: FormControl<string>;
  headcount: FormControl<number | null>;
}

interface EquipmentForm {
  name: FormControl<string>;
  quantity: FormControl<number | null>;
  hours: FormControl<number | null>;
}

interface WorkItemForm {
  description: FormControl<string>;
  unit: FormControl<string>;
  quantity: FormControl<number | null>;
}

interface IncidentForm {
  type: FormControl<IncidentType>;
  severity: FormControl<IncidentSeverity>;
  description: FormControl<string>;
  actionTaken: FormControl<string>;
}

interface DiaryForm {
  projectId: FormControl<string>;
  date: FormControl<Date | null>;
  morning: FormControl<WeatherCondition>;
  afternoon: FormControl<WeatherCondition>;
  minTemp: FormControl<number | null>;
  maxTemp: FormControl<number | null>;
  labor: FormArray<FormGroup<LaborForm>>;
  equipment: FormArray<FormGroup<EquipmentForm>>;
  workItems: FormArray<FormGroup<WorkItemForm>>;
  incidents: FormArray<FormGroup<IncidentForm>>;
  notes: FormControl<string>;
}

/** Nhiệt độ cao nhất ≥ thấp nhất (đặt trên control maxTemp). */
const maxAboveMin: ValidatorFn = (control: AbstractControl<number | null>): ValidationErrors | null => {
  const min = (control.parent as FormGroup<DiaryForm> | null)?.controls.minTemp.value;
  const max = control.value;
  return typeof min === 'number' && typeof max === 'number' && max < min ? { belowMin: true } : null;
};

function laborGroup(crew = '', headcount: number | null = null): FormGroup<LaborForm> {
  return new FormGroup<LaborForm>({
    crew: new FormControl(crew, { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    headcount: new FormControl(headcount, [Validators.required, Validators.min(0), Validators.max(1000)]),
  });
}

function equipmentGroup(name = '', quantity: number | null = 1, hours: number | null = null): FormGroup<EquipmentForm> {
  return new FormGroup<EquipmentForm>({
    name: new FormControl(name, { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    quantity: new FormControl(quantity, [Validators.required, Validators.min(1), Validators.max(100)]),
    hours: new FormControl(hours, [Validators.min(0), Validators.max(24)]),
  });
}

function workItemGroup(description = '', unit = 'm³', quantity: number | null = null): FormGroup<WorkItemForm> {
  return new FormGroup<WorkItemForm>({
    description: new FormControl(description, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
    unit: new FormControl(unit, { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    quantity: new FormControl(quantity, [Validators.required, Validators.min(0)]),
  });
}

function incidentGroup(incident?: IncidentEntry): FormGroup<IncidentForm> {
  return new FormGroup<IncidentForm>({
    type: new FormControl<IncidentType>(incident?.type ?? 'SAFETY', { nonNullable: true }),
    severity: new FormControl<IncidentSeverity>(incident?.severity ?? 'LOW', { nonNullable: true }),
    description: new FormControl(incident?.description ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(1000)],
    }),
    actionTaken: new FormControl(incident?.actionTaken ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });
}

function filterSuggestions(options: readonly string[], query: string): readonly string[] {
  const keyword = query.trim().toLowerCase();
  return keyword ? options.filter((option) => option.toLowerCase().includes(keyword)) : options;
}

@Component({
  selector: 'app-diary-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PhotoUploaderComponent,
  ],
  providers: [DiaryFormStore],
  templateUrl: './diary-form-page.component.html',
  styleUrl: './diary-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiaryFormPageComponent implements HasUnsavedChanges {
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  protected readonly store = inject(DiaryFormStore);

  /** :id khi sửa. */
  readonly id = input<string>();
  /** ?projectId=&date= khi tạo từ lịch hoặc trang dự án. */
  readonly projectId = input<string>();
  readonly date = input<string>();

  protected readonly weatherOptions = WEATHER_CONDITIONS;
  protected readonly weatherLabels = WEATHER_LABELS;
  protected readonly incidentTypes = INCIDENT_TYPES;
  protected readonly incidentTypeLabels = INCIDENT_TYPE_LABELS;
  protected readonly severities = INCIDENT_SEVERITIES;
  protected readonly severityLabels = INCIDENT_SEVERITY_LABELS;
  protected readonly unitOptions = UNIT_SUGGESTIONS;
  protected readonly maxPhotos = MAX_PHOTOS;
  protected readonly today = new Date();
  protected readonly submitError = signal<string | null>(null);
  private readonly saved = signal(false);
  private readonly photosTouched = signal(false);

  protected readonly form = new FormGroup<DiaryForm>({
    projectId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    date: new FormControl<Date | null>(new Date(), [Validators.required]),
    morning: new FormControl<WeatherCondition>('SUNNY', { nonNullable: true }),
    afternoon: new FormControl<WeatherCondition>('SUNNY', { nonNullable: true }),
    minTemp: new FormControl<number | null>(null, [Validators.min(-10), Validators.max(50)]),
    maxTemp: new FormControl<number | null>(null, [Validators.min(-10), Validators.max(50), maxAboveMin]),
    labor: new FormArray<FormGroup<LaborForm>>([laborGroup()]),
    equipment: new FormArray<FormGroup<EquipmentForm>>([]),
    workItems: new FormArray<FormGroup<WorkItemForm>>([workItemGroup()]),
    incidents: new FormArray<FormGroup<IncidentForm>>([]),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly title = computed(() => (this.id() ? 'Chỉnh sửa nhật ký' : 'Lập nhật ký công trường'));
  protected readonly totalWorkers = computed(() =>
    (this.formValue().labor ?? []).reduce((sum, entry) => sum + (entry.headcount ?? 0), 0),
  );
  /** Nhật ký đã gửi/duyệt thì không cho sửa. */
  protected readonly locked = computed(() => {
    const diary = this.store.diary();
    return diary !== null && !EDITABLE_DIARY_STATUSES.includes(diary.status) && !this.saved();
  });

  constructor() {
    this.form.controls.minTemp.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.maxTemp.updateValueAndValidity());

    effect(() => {
      const id = this.id() ?? null;
      untracked(() => void this.store.init(id));
    });
    // Tạo mới: điền sẵn dự án/ngày từ query param.
    effect(() => {
      const projectId = this.projectId();
      const date = this.date();
      untracked(() => {
        if (this.id()) {
          return;
        }
        if (projectId) {
          this.form.controls.projectId.setValue(projectId);
        }
        if (date && isValidIsoDate(date)) {
          this.form.controls.date.setValue(parseIsoDate(date));
        }
      });
    });
    effect(() => {
      const diary = this.store.diary();
      if (diary && !this.saved()) {
        untracked(() => this.fillForm(diary));
      }
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.saved() && (this.form.dirty || this.photosTouched());
  }

  protected crewOptions(index: number): readonly string[] {
    return filterSuggestions(CREW_SUGGESTIONS, this.form.controls.labor.at(index)?.controls.crew.value ?? '');
  }

  protected equipmentOptions(index: number): readonly string[] {
    return filterSuggestions(EQUIPMENT_SUGGESTIONS, this.form.controls.equipment.at(index)?.controls.name.value ?? '');
  }

  protected addLabor(): void {
    this.form.controls.labor.push(laborGroup());
    this.form.markAsDirty();
  }

  protected addEquipment(): void {
    this.form.controls.equipment.push(equipmentGroup());
    this.form.markAsDirty();
  }

  protected addWorkItem(): void {
    this.form.controls.workItems.push(workItemGroup());
    this.form.markAsDirty();
  }

  protected addIncident(): void {
    this.form.controls.incidents.push(incidentGroup());
    this.form.markAsDirty();
  }

  protected removeAt(array: FormArray<FormGroup>, index: number): void {
    array.removeAt(index);
    this.form.markAsDirty();
  }

  protected onFiles(files: File[]): void {
    this.photosTouched.set(true);
    void this.store.addFiles(files);
  }

  protected onRemovePhoto(localId: string): void {
    this.photosTouched.set(true);
    this.store.removePhoto(localId);
  }

  protected onCaption(change: { localId: string; caption: string }): void {
    this.photosTouched.set(true);
    this.store.setCaption(change.localId, change.caption);
  }

  protected retry(): void {
    void this.store.init(this.id() ?? null);
  }

  protected async save(submit: boolean): Promise<void> {
    this.submitError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitError.set('Vui lòng kiểm tra lại các trường được đánh dấu đỏ.');
      return;
    }
    if (this.store.uploading()) {
      this.submitError.set('Ảnh đang được tải lên, vui lòng đợi trong giây lát.');
      return;
    }
    const value = this.form.getRawValue();
    const result = await this.store.save(value.projectId, value.date ? toIsoDate(value.date) : '', this.toContent(), submit);
    if (result.ok && result.queued) {
      this.saved.set(true);
      this.notification.info('Đang mất mạng: nhật ký đã lưu trên máy và sẽ tự đồng bộ khi có mạng trở lại.');
      await this.router.navigate(['/site-diaries']);
      return;
    }
    if (result.ok) {
      this.saved.set(true);
      this.notification.success(submit ? 'Đã lưu và gửi nhật ký để duyệt.' : 'Đã lưu nhật ký nháp.');
      await this.router.navigate(['/site-diaries', result.diary.id]);
      return;
    }
    if (result.code === 'DIARY_EXISTS') {
      this.form.controls.date.setErrors({ duplicate: true });
      this.form.controls.date.markAsTouched();
    }
    this.submitError.set(result.message);
  }

  private fillForm(diary: SiteDiary): void {
    this.form.controls.labor.clear();
    diary.labor.forEach((entry) => this.form.controls.labor.push(laborGroup(entry.crew, entry.headcount)));
    this.form.controls.equipment.clear();
    diary.equipment.forEach((entry) =>
      this.form.controls.equipment.push(equipmentGroup(entry.name, entry.quantity, entry.hours)),
    );
    this.form.controls.workItems.clear();
    diary.workItems.forEach((item) =>
      this.form.controls.workItems.push(workItemGroup(item.description, item.unit, item.quantity)),
    );
    this.form.controls.incidents.clear();
    diary.incidents.forEach((incident) => this.form.controls.incidents.push(incidentGroup(incident)));

    this.form.patchValue({
      projectId: diary.projectId,
      date: parseIsoDate(diary.date),
      morning: diary.weather.morning,
      afternoon: diary.weather.afternoon,
      minTemp: diary.weather.minTemp,
      maxTemp: diary.weather.maxTemp,
      notes: diary.notes,
    });
    // Dự án và ngày không đổi được sau khi đã lập.
    this.form.controls.projectId.disable();
    this.form.controls.date.disable();
    this.form.markAsPristine();
  }

  private toContent(): DiaryContent {
    const value = this.form.getRawValue();
    return {
      weather: { morning: value.morning, afternoon: value.afternoon, minTemp: value.minTemp, maxTemp: value.maxTemp },
      labor: value.labor.map((entry) => ({ crew: entry.crew.trim(), headcount: entry.headcount ?? 0 })),
      equipment: value.equipment.map((entry) => ({
        name: entry.name.trim(),
        quantity: entry.quantity ?? 1,
        hours: entry.hours,
      })),
      workItems: value.workItems.map((item) => ({
        description: item.description.trim(),
        unit: item.unit.trim(),
        quantity: item.quantity ?? 0,
      })),
      incidents: value.incidents.map((incident) => ({
        ...incident,
        description: incident.description.trim(),
        actionTaken: incident.actionTaken.trim(),
      })),
      notes: value.notes.trim(),
      photos: this.store.uploadedPhotos(),
    };
  }
}
