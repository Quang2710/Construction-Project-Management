import { inject, Injectable } from '@angular/core';
import { AppDialog } from '../../../../shared/ui/dialog/app-dialog.service';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogService } from '../../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { formatVnd } from '../../../../shared/utils/currency.utils';
import {
  ChangeOrderDialogComponent,
  ChangeOrderDialogData,
} from '../../components/change-order-dialog/change-order-dialog.component';
import { CostEntryDialogComponent, CostEntryDialogData } from '../../components/cost-entry-dialog/cost-entry-dialog.component';
import { DecisionDialogComponent, DecisionDialogData } from '../../components/decision-dialog/decision-dialog.component';
import { PaymentReceiptDialogComponent } from '../../components/payment-receipt-dialog/payment-receipt-dialog.component';
import { ChangeOrderDecision } from '../../data-access/cost-api.service';
import { CostStore } from '../../data-access/cost.store';
import { ChangeOrder, ChangeOrderCreate, CostEntryCreate, PaymentMilestone } from '../../models/cost.model';

const DIALOG_SIZE = { width: '600px', maxWidth: 'calc(100vw - 24px)' };

/** Mở các dialog nghiệp vụ chi phí; được cung cấp ở cấp trang Chi phí (cùng CostStore). */
@Injectable()
export class CostDialogsService {
  private readonly dialog = inject(AppDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly store = inject(CostStore);

  async addEntry(): Promise<boolean> {
    const ref = this.dialog.open<CostEntryDialogComponent, CostEntryDialogData, CostEntryCreate>(CostEntryDialogComponent, {
      ...DIALOG_SIZE,
      data: { projectCode: this.store.project()?.code ?? '', items: this.store.costItems() },
    });
    const result = await firstValueFrom(ref.afterClosed());
    return result ? this.store.addEntry(result) : false;
  }

  async proposeChangeOrder(): Promise<boolean> {
    const ref = this.dialog.open<ChangeOrderDialogComponent, ChangeOrderDialogData, ChangeOrderCreate>(
      ChangeOrderDialogComponent,
      { ...DIALOG_SIZE, data: { projectCode: this.store.project()?.code ?? '', items: this.store.costItems() } },
    );
    const result = await firstValueFrom(ref.afterClosed());
    return result ? this.store.proposeChangeOrder(result) : false;
  }

  async decide(order: ChangeOrder, decision: ChangeOrderDecision): Promise<boolean> {
    const ref = this.dialog.open<DecisionDialogComponent, DecisionDialogData, string>(DecisionDialogComponent, {
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      data: { mode: decision, order },
    });
    const note = await firstValueFrom(ref.afterClosed());
    return note === undefined ? false : this.store.decideChangeOrder(order.id, decision, note);
  }

  async invoice(payment: PaymentMilestone): Promise<boolean> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Đề nghị thanh toán',
      message: `Gửi đề nghị thanh toán đợt ${payment.order} (${payment.name}) với giá trị ${formatVnd(payment.amount)}?`,
      confirmText: 'Gửi đề nghị',
    });
    return confirmed ? this.store.invoicePayment(payment) : false;
  }

  async receive(payment: PaymentMilestone): Promise<boolean> {
    const ref = this.dialog.open<PaymentReceiptDialogComponent, PaymentMilestone, number>(PaymentReceiptDialogComponent, {
      width: '460px',
      maxWidth: 'calc(100vw - 32px)',
      data: payment,
    });
    const amount = await firstValueFrom(ref.afterClosed());
    return amount === undefined ? false : this.store.markPaid(payment, amount);
  }
}
