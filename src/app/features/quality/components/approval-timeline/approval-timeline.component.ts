import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ApprovalStep, InspectionStatus } from '../../models/quality.model';

type StepState = 'approved' | 'rejected' | 'current' | 'waiting';

interface TimelineStep extends ApprovalStep {
  readonly state: StepState;
  readonly icon: string;
}

const ICONS: Readonly<Record<StepState, string>> = {
  approved: 'check_circle',
  rejected: 'cancel',
  current: 'pending',
  waiting: 'radio_button_unchecked',
};

/** Các cấp duyệt của phiếu nghiệm thu: đã duyệt / trả lại / đang chờ / chưa tới. */
@Component({
  selector: 'app-approval-timeline',
  imports: [DatePipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="steps">
      @for (step of steps(); track step.level) {
        <li class="step" [class]="'step step--' + step.state">
          <mat-icon class="step__icon">{{ step.icon }}</mat-icon>
          <div class="step__body">
            <p class="step__title">Cấp {{ step.level }} · {{ step.label }}</p>
            @if (step.by && step.at) {
              <p class="step__meta">
                {{ step.decision === 'APPROVED' ? 'Duyệt' : 'Trả lại' }} bởi {{ step.by.fullName }} · {{ step.at | date: 'HH:mm dd/MM/yyyy' }}
              </p>
              @if (step.note) {
                <p class="step__note">“{{ step.note }}”</p>
              }
            } @else {
              <p class="step__meta">{{ step.state === 'current' ? 'Đang chờ duyệt' : 'Chưa tới lượt' }}</p>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .steps {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .step {
      position: relative;
      display: flex;
      gap: 12px;
      padding-bottom: 16px;
    }
    .step:not(:last-child)::before {
      content: '';
      position: absolute;
      top: 28px;
      bottom: 0;
      left: 11px;
      width: 2px;
      background: var(--mat-sys-outline-variant);
    }
    .step__icon {
      flex: none;
      color: var(--mat-sys-outline);
    }
    .step--approved .step__icon {
      color: var(--app-success);
    }
    .step--rejected .step__icon {
      color: var(--mat-sys-error);
    }
    .step--current .step__icon {
      color: var(--mat-sys-tertiary);
    }
    .step__title {
      margin: 0;
      font: var(--mat-sys-title-small);
    }
    .step__meta,
    .step__note {
      margin: 2px 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .step__note {
      font-style: italic;
    }
  `,
})
export class ApprovalTimelineComponent {
  readonly approvals = input.required<readonly ApprovalStep[]>();
  readonly status = input.required<InspectionStatus>();
  readonly currentLevel = input<number | null>(null);

  protected readonly steps = computed<TimelineStep[]>(() =>
    this.approvals().map((step) => {
      const state: StepState =
        step.decision === 'APPROVED'
          ? 'approved'
          : step.decision === 'REJECTED'
            ? 'rejected'
            : this.status() === 'IN_REVIEW' && step.level === this.currentLevel()
              ? 'current'
              : 'waiting';
      return { ...step, state, icon: ICONS[state] };
    }),
  );
}
