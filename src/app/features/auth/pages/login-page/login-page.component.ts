import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputTextModule } from 'primeng/inputtext';
import { AuthStore } from '../../../../core/auth/auth.store';
import { APP_NAME } from '../../../../core/config/app-title.strategy';
import { DEMO_ACCOUNTS, DemoAccount } from '../../../../core/config/demo-accounts';
import { DemoDataService } from '../../../../core/demo/demo-data.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { RoleLabelPipe } from '../../../../shared/pipes/role-label.pipe';
import { ConfirmDialogService } from '../../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';

interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
}

const DEMO_ROLE_ICONS: Readonly<Record<DemoAccount['role'], string>> = {
  ADMIN: 'admin_panel_settings',
  PROJECT_MANAGER: 'manage_accounts',
  SITE_ENGINEER: 'engineering',
  CLIENT: 'business_center',
};

/** Chỉ chấp nhận đường dẫn nội bộ để tránh open redirect. */
function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : '/dashboard';
}

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RoleLabelPipe,
    ButtonModule,
    IconComponent,
    ProgressSpinnerModule,
    ...FIELD,
    InputTextModule,
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  private readonly router = inject(Router);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notification = inject(NotificationService);
  protected readonly auth = inject(AuthStore);
  protected readonly demoData = inject(DemoDataService);

  /** Query param ?returnUrl= (gắn qua withComponentInputBinding). */
  readonly returnUrl = input<string>();

  protected readonly appName = APP_NAME;
  protected readonly demoAccounts = this.demoData.enabled ? DEMO_ACCOUNTS : [];
  protected readonly demoRoleIcons = DEMO_ROLE_ICONS;
  protected readonly hidePassword = signal(true);
  protected readonly resetting = signal(false);
  protected readonly submitting = computed(() => this.auth.isLoading());

  protected readonly form = new FormGroup<LoginForm>({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const success = await this.auth.login(this.form.getRawValue());
    if (success) {
      this.notification.success(`Xin chào, ${this.auth.user()?.fullName ?? ''}!`);
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
    }
  }

  protected async loginAs(account: DemoAccount): Promise<void> {
    if (this.submitting()) {
      return;
    }
    this.form.setValue({ email: account.email, password: account.password });
    await this.submit();
  }

  protected async resetDemoData(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Reset dữ liệu demo',
      message: 'Toàn bộ thay đổi sẽ bị xoá và dữ liệu mẫu ban đầu được khôi phục. Tiếp tục?',
      confirmText: 'Reset dữ liệu',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.resetting.set(true);
    try {
      await this.demoData.reset();
    } catch {
      this.resetting.set(false);
      this.notification.error('Không thể reset dữ liệu demo. Vui lòng thử lại.');
    }
  }
}
