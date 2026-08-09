import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiSkeleton } from '@taiga-ui/kit';
import { CatalogMultimediaOrchestrator, MultimediaVM } from '@erp/catalog/data-access';
import { MultimediaRow } from './multimedia-row.model';

export type MultimediaInfoField = 'fileName' | 'mediaType' | 'fileSize';

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: 'Zdjęcie',
  video: 'Wideo',
  audio: 'Audio',
  document: 'Dokument',
  '3d-model': 'Model 3D',
  unknown: 'Nieznany',
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Generyczna komórka tekstowa tabeli multimediów — sama rozwiązuje `MultimediaVM`
 * po `uuid` z cache orkiestratora (reaktywnie) i wyświetla wskazane pole (`field`).
 */
@Component({
  selector: 'erp-multimedia-info-cell',
  standalone: true,
  imports: [CommonModule, TuiSkeleton],
  template: `
    @if (!_vm()) {
      <span [tuiSkeleton]="true" class="rounded-sm inline-flex items-center min-w-[3rem] min-h-[1.25rem] max-w-full"></span>
    } @else {
      <span>{{ _text() }}</span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaInfoCellComponent {
  public readonly row = input.required<MultimediaRow>();
  public readonly field = input.required<MultimediaInfoField>();

  private readonly multimediaOrchestrator = inject(CatalogMultimediaOrchestrator);

  protected readonly _vm = computed<MultimediaVM | undefined>(() =>
    this.multimediaOrchestrator.getOne(this.row().uuid)()
  );

  protected readonly _text = computed(() => {
    const vm = this._vm();
    if (!vm) return '';

    switch (this.field()) {
      case 'fileName':
        return vm.fileName ?? '—';
      case 'mediaType':
        return MEDIA_TYPE_LABELS[vm.mediaType ?? ''] ?? vm.mediaType ?? '—';
      case 'fileSize':
        return vm.fileSize ? formatBytes(vm.fileSize) : '—';
      default:
        return '—';
    }
  });
}
