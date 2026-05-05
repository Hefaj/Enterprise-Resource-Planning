import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpDatePicker } from './erp-datepicker.component';

export class ErpDatePickerBuilder extends ErpInputBaseBuilder<ErpDatePicker> {
  public setShowIcon(showIcon = true): this {
    this._data.showIcon = showIcon;
    return this;
  }

  public setDateFormat(dateFormat: string): this {
    this._data.dateFormat = dateFormat;
    return this;
  }

  public setSelectionMode(mode: 'single' | 'multiple' | 'range'): this {
    this._data.selectionMode = mode;
    return this;
  }

  public setView(view: 'date' | 'month' | 'year'): this {
    this._data.view = view;
    return this;
  }

  public setShowTime(showTime = true): this {
    this._data.showTime = showTime;
    return this;
  }

  public setHourFormat(format: '12' | '24'): this {
    this._data.hourFormat = format;
    return this;
  }
}
