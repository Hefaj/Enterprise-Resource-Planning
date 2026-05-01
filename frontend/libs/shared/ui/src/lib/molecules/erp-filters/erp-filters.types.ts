import { ErpInputText } from '../../atoms/erp-input-text/erp-input-text.component';

export type ErpFilterType = 'text' | 'select' | 'switch' | 'date' | 'list';

export interface ErpFilterItem {
  id: string;
  label: string;
  type: ErpFilterType;
  config: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValue?: any;
}

export interface ErpFiltersConfig {
  items: ErpFilterItem[];
  submitButtonLabel?: string;
  showSubmitButton?: boolean;
}
