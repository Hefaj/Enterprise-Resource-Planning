/** Wiersz grupy (dział) albo liścia (zagadnienie) spłaszczonej tabeli przestawnej raportu godzin. */
export type ErpReportPivotRow =
  | { readonly kind: 'group'; readonly code: string; readonly name: string; readonly hoursByPeriod: ReadonlyMap<string, number>; readonly total: number }
  | { readonly kind: 'leaf'; readonly groupCode: string; readonly key: string; readonly hoursByPeriod: ReadonlyMap<string, number>; readonly total: number };
