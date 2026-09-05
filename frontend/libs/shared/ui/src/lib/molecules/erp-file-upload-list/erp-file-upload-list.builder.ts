import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpFileUploadListConfig, ErpFileUploadListItem } from './erp-file-upload-list.types';

export class ErpFileUploadListBuilder extends ErpBaseBuilder<ErpFileUploadListConfig> {
  public setItems(items: MaybeSignal<readonly ErpFileUploadListItem[]>): this {
    this._data.items = items;
    return this;
  }

  public setCanEdit(canEdit: MaybeSignal<boolean>): this {
    this._data.canEdit = canEdit;
    return this;
  }

  public setMultiple(multiple: MaybeSignal<boolean>): this {
    this._data.multiple = multiple;
    return this;
  }

  public setAccept(accept: MaybeSignal<string>): this {
    this._data.accept = accept;
    return this;
  }

  public setMaxFilesPerSelection(max: number): this {
    this._data.maxFilesPerSelection = max;
    return this;
  }

  public setAddLabel(label: MaybeSignal<Translatable>): this {
    this._data.addLabel = label;
    return this;
  }

  public setEmptyLabel(label: MaybeSignal<Translatable>): this {
    this._data.emptyLabel = label;
    return this;
  }

  public setPreviewLabel(label: MaybeSignal<Translatable>): this {
    this._data.previewLabel = label;
    return this;
  }

  public setDownloadLabel(label: MaybeSignal<Translatable>): this {
    this._data.downloadLabel = label;
    return this;
  }

  public setRemoveLabel(label: MaybeSignal<Translatable>): this {
    this._data.removeLabel = label;
    return this;
  }

  public setUploadingLabel(fn: (uploaded: number, total: number) => Translatable): this {
    this._data.uploadingLabel = fn;
    return this;
  }

  public setUploadFailedLabel(label: MaybeSignal<Translatable>): this {
    this._data.uploadFailedLabel = label;
    return this;
  }

  public setTooManyFilesLabel(label: MaybeSignal<Translatable>): this {
    this._data.tooManyFilesLabel = label;
    return this;
  }

  public setOnUpload(fn: (files: readonly File[], onProgress: (uploaded: number) => void) => Promise<void>): this {
    this._data.onUpload = fn;
    return this;
  }

  public setOnPreview(fn: (item: ErpFileUploadListItem) => void): this {
    this._data.onPreview = fn;
    return this;
  }

  public setOnDownload(fn: (item: ErpFileUploadListItem) => void | Promise<void>): this {
    this._data.onDownload = fn;
    return this;
  }

  public setOnRemove(fn: (item: ErpFileUploadListItem) => void | Promise<void>): this {
    this._data.onRemove = fn;
    return this;
  }
}
