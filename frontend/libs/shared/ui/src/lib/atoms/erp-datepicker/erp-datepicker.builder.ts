import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpDatePicker } from './erp-datepicker.component';

export class ErpDatePickerBuilder extends ErpInputBaseBuilder<ErpDatePicker> {
  public setShowIcon(showIcon: boolean): this {
    this._data.showIcon = showIcon;
    return this;
  }

  public setDateFormat(dateFormat: string): this {
    this._data.dateFormat = dateFormat;
    return this;
  }
}
