import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpDatePickerConfig } from './erp-datepicker.types';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

export class ErpDatePickerBuilder extends ErpBaseBuilder<ErpDatePickerConfig> {


  public setPlaceholder(placeholder: MaybeSignal<Translatable | undefined>): this {
    this._data.placeholder = placeholder;
    return this;
  }

  public setHint(hint: MaybeSignal<Translatable | undefined>): this {
    this._data.hint = hint;
    return this;
  }

  public setErrorMessages(messages: MaybeSignal<Record<string, Translatable> | undefined>): this {
    this._data.errorMessages = messages;
    return this;
  }

  public setShowIcon(showIcon: MaybeSignal<boolean | undefined> = true): this {
    this._data.showIcon = showIcon;
    return this;
  }

  public setDateFormat(dateFormat: MaybeSignal<string | undefined>): this {
    this._data.dateFormat = dateFormat;
    return this;
  }

  public setSelectionMode(mode: MaybeSignal<'single' | 'multiple' | 'range' | undefined>): this {
    this._data.selectionMode = mode;
    return this;
  }

  public setView(view: MaybeSignal<'date' | 'month' | 'year' | undefined>): this {
    this._data.view = view;
    return this;
  }

  public setShowTime(showTime: MaybeSignal<boolean | undefined> = true): this {
    this._data.showTime = showTime;
    return this;
  }

  public setHourFormat(format: MaybeSignal<'12' | '24' | undefined>): this {
    this._data.hourFormat = format;
    return this;
  }
}
