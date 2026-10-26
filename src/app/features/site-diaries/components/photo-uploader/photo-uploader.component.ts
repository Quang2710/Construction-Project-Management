import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputTextModule } from 'primeng/inputtext';
import { PhotoDraft } from '../../data-access/diary-form.store';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { FIELD } from '../../../../shared/ui/field/field.component';

/** Chọn/chụp ảnh hiện trường, xem trước, chú thích; trạng thái tải lên do store quản lý. */
@Component({
  selector: 'app-photo-uploader',
  imports: [
    ButtonModule,
    IconComponent,
    TooltipModule,
    ProgressSpinnerModule,
    ...FIELD,
    InputTextModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './photo-uploader.component.html',
  styleUrl: './photo-uploader.component.scss',
})
export class PhotoUploaderComponent {
  readonly photos = input.required<readonly PhotoDraft[]>();
  readonly locating = input(false);
  readonly gpsWarning = input<string | null>(null);
  readonly canAdd = input(true);
  readonly disabled = input(false);
  readonly maxPhotos = input(30);

  readonly filesSelected = output<File[]>();
  readonly remove = output<string>();
  readonly retry = output<string>();
  readonly captionChange = output<{ localId: string; caption: string }>();

  protected onFiles(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) {
      this.filesSelected.emit(files);
    }
  }

  protected onCaption(localId: string, event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.captionChange.emit({ localId, caption: target.value });
    }
  }
}
