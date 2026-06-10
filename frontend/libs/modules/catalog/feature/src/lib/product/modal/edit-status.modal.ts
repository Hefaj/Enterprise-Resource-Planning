import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { TagModule } from 'primeng/tag';

export type ProductStatus = 'Aktywny' | 'Draft' | 'Wycofany' | 'Archiwum';

export interface EditStatusDialogData {
  products: { uuid: string; sku: string; status?: string }[];
  onSave: (uuid: string, status: ProductStatus) => Promise<void>;
}

const STATUS_OPTIONS: { label: string; value: ProductStatus; severity: string; icon: string }[] = [
  { label: 'Aktywny', value: 'Aktywny', severity: 'success', icon: 'pi pi-check-circle' },
  { label: 'Draft', value: 'Draft', severity: 'warn', icon: 'pi pi-pencil' },
  { label: 'Wycofany', value: 'Wycofany', severity: 'danger', icon: 'pi pi-ban' },
  { label: 'Archiwum', value: 'Archiwum', severity: 'secondary', icon: 'pi pi-inbox' },
];

/**
 * Modal edycji statusu produktu.
 * Wyświetla dropdown z dostępnymi statusami i podglądem obecnego statusu.
 */
@Component({
  selector: 'catalog-edit-status-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, SelectModule, TagModule],
  template: `
    @let _products = products();
    @let _saving = saving();
    @let _error = error();

    <div class="edit-status-modal">
      <p class="text-surface-600 dark:text-surface-400 text-sm mb-4">
        Zmienisz status dla
        <strong>{{ _products.length }}</strong>
        {{ _products.length === 1 ? 'produktu' : 'produktów' }}:
      </p>

      <!-- Produkty z obecnym statusem -->
      <div class="products-list mb-4">
        @for (p of _products; track p.uuid) {
          <div class="product-row">
            <span class="product-sku">{{ p.sku }}</span>
            @if (p.status) {
              <span class="current-status">{{ p.status }}</span>
            }
          </div>
        }
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
        <div class="field">
          <label for="status-select" class="field-label">
            Nowy status
            <span class="required-mark">*</span>
          </label>
          <p-select
            id="status-select"
            formControlName="status"
            [options]="statusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Wybierz status"
            [showClear]="false"
            styleClass="w-full"
          >
            <ng-template #item let-opt>
              <div class="status-option">
                <i [class]="opt.icon" [style.color]="'var(--p-' + opt.severity + '-500)'"></i>
                <span>{{ opt.label }}</span>
              </div>
            </ng-template>
            <ng-template #selectedItem let-opt>
              @if (opt) {
                <div class="status-option">
                  <i [class]="opt.icon" [style.color]="'var(--p-' + opt.severity + '-500)'"></i>
                  <span>{{ opt.label }}</span>
                </div>
              }
            </ng-template>
          </p-select>
          @if (form.controls.status.invalid && form.controls.status.touched) {
            <small class="field-error">Wybierz status</small>
          }
        </div>

        @if (_error) {
          <div class="error-banner">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ _error }}</span>
          </div>
        }

        <div class="modal-footer">
          <button
            pButton
            type="button"
            label="Anuluj"
            severity="secondary"
            [text]="true"
            (click)="onCancel()"
            [disabled]="_saving"
          ></button>
          <button
            pButton
            type="submit"
            label="Zmień status"
            [loading]="_saving"
            [disabled]="form.invalid || _saving"
            icon="pi pi-sync"
          ></button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .edit-status-modal { padding: 0.25rem 0; min-width: 400px; }
    .products-list { display: flex; flex-direction: column; gap: 0.35rem; }
    .product-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.4rem 0.75rem; border-radius: 0.5rem;
      background: var(--p-surface-50); border: 1px solid var(--p-surface-100);
    }
    :host-context(.dark) .product-row,
    :host-context([data-theme="dark"]) .product-row {
      background: var(--p-surface-900); border-color: var(--p-surface-800);
    }
    .product-sku { font-size: 0.875rem; font-weight: 600; font-family: monospace; color: var(--p-surface-700); }
    :host-context(.dark) .product-sku,
    :host-context([data-theme="dark"]) .product-sku { color: var(--p-surface-300); }
    .current-status {
      font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 0.75rem;
      background: var(--p-surface-200); color: var(--p-surface-600);
    }
    .status-option { display: flex; align-items: center; gap: 0.5rem; }
    .error-banner {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem;
      background: var(--p-red-50); border: 1px solid var(--p-red-200);
      border-radius: 0.5rem; color: var(--p-red-700); font-size: 0.875rem;
    }
    .field { display: flex; flex-direction: column; gap: 0.4rem; }
    .field-label { font-size: 0.875rem; font-weight: 600; color: var(--p-surface-700); }
    :host-context(.dark) .field-label,
    :host-context([data-theme="dark"]) .field-label { color: var(--p-surface-300); }
    .required-mark { color: var(--p-red-500); margin-left: 2px; }
    .field-error { color: var(--p-red-500); font-size: 0.75rem; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 0.75rem;
      padding-top: 0.5rem; border-top: 1px solid var(--p-surface-100);
    }
    :host-context(.dark) .modal-footer,
    :host-context([data-theme="dark"]) .modal-footer { border-color: var(--p-surface-800); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditStatusModalComponent {
  private dialogRef = inject(DynamicDialogRef);
  private dialogConfig = inject(DynamicDialogConfig);

  protected saving = signal(false);
  protected error = signal<string | null>(null);
  protected readonly statusOptions = STATUS_OPTIONS;

  protected products = computed<EditStatusDialogData['products']>(() =>
    this.dialogConfig?.data?.products ?? []
  );

  protected form = new FormGroup({
    status: new FormControl<ProductStatus | null>(null, [Validators.required]),
  });

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.error.set(null);

    const status = this.form.value.status!;
    const onSave: EditStatusDialogData['onSave'] = this.dialogConfig?.data?.onSave;

    try {
      for (const product of this.products()) {
        if (onSave) {
          await onSave(product.uuid, status);
        } else {
          await new Promise<void>((r) => setTimeout(r, 300));
          console.log(`[Mock] PATCH /product/${product.uuid}/status →`, { status });
        }
      }
      this.dialogRef?.close({ success: true, status });
    } catch (e: any) {
      this.error.set(e?.message || 'Wystąpił błąd podczas zapisu.');
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancel(): void {
    this.dialogRef?.close({ success: false });
  }
}
