/**
 * Parsowanie CSV raportu `taskmgmt.hours-by-department` (RPT-002) na tabelę przestawną,
 * renderowaną wprost na stronie — patrz `docs/frontend/task-management-pages.md` §9.4.
 *
 * <p>Kolumny CSV (stałe, ustalone przez definicję raportu backendu):
 * <c>department_code, department_name, zagadnienie_key, period, hours</c>.</p>
 *
 * <p><b>Rozwinięcie kończy się na zagadnieniu</b> — CSV nie niesie tytułu ani klucza
 * konkretnego zgłoszenia, więc nie ma czego renderować głębiej (PERM-005 AC2:
 * kierownictwo czytające ten raport nie musi mieć dostępu do listy zgłoszeń).</p>
 */

export interface ReportPivotZagadnienieRow {
  readonly key: string;
  readonly hoursByPeriod: ReadonlyMap<string, number>;
  readonly total: number;
}

export interface ReportPivotDepartmentRow {
  readonly code: string;
  readonly name: string;
  readonly hoursByPeriod: ReadonlyMap<string, number>;
  readonly total: number;
  readonly zagadnienia: readonly ReportPivotZagadnienieRow[];
}

export interface ReportPivotData {
  readonly periods: readonly string[];
  readonly departments: readonly ReportPivotDepartmentRow[];
}

/** Prosty parser linii CSV z obsługą pól cytowanych (`"a, b"` → jedna wartość) — wystarczający
 * dla zamkniętego, znanego kształtu tego jednego raportu; nie pretenduje do ogólnego CSV. */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  values.push(current);
  return values;
}

/** Wynik generycznego parsowania — nagłówki w kolejności CSV plus wiersze jako tekst surowy
 * (bez wiedzy o typach kolumn), do renderowania zwykłą tabelą. */
export interface ReportRowsData {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/**
 * Parser generyczny dla czterech definicji RPT-003 innych niż `hours-by-department` — w
 * odróżnieniu od {@link parseReportCsvToPivot} nie zna z góry kształtu kolumn (każda z tych
 * definicji ma inny), więc nie buduje pivotu, tylko zwraca nagłówek i wiersze wprost. Front
 * (`report.component.ts`) tłumaczy nazwy kolumn na etykiety przez statyczną mapę i rozwiązuje
 * gołe uuidy (typu, przypisanego, sprintu) na nazwy przez już wczytane orkiestratory.
 */
export function parseReportCsvToRows(csvText: string): ReportRowsData {
  const lines = csvText.split(/\r\n|\n/).filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines
    .slice(1)
    .map((line) => parseCsvLine(line))
    .filter((cols) => !(cols.length === 1 && cols[0].trim() === ''));

  return { headers, rows };
}

export function parseReportCsvToPivot(csvText: string): ReportPivotData {
  const lines = csvText.split(/\r\n|\n/).filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { periods: [], departments: [] };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const colIndex = {
    code: header.indexOf('department_code'),
    name: header.indexOf('department_name'),
    key: header.indexOf('zagadnienie_key'),
    period: header.indexOf('period'),
    hours: header.indexOf('hours'),
  };

  const periods = new Set<string>();
  const departments = new Map<string, { name: string; zagadnienia: Map<string, Map<string, number>> }>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 1 && cols[0].trim() === '') {
      continue;
    }

    const code = colIndex.code >= 0 ? (cols[colIndex.code] ?? '') : '';
    const name = colIndex.name >= 0 ? (cols[colIndex.name] ?? '') : '';
    const zagadnienieKey = colIndex.key >= 0 ? (cols[colIndex.key] ?? '') : '';
    const period = colIndex.period >= 0 ? (cols[colIndex.period] ?? '') : '';
    const hours = colIndex.hours >= 0 ? Number(cols[colIndex.hours]) || 0 : 0;

    periods.add(period);

    let dept = departments.get(code);
    if (!dept) {
      dept = { name, zagadnienia: new Map() };
      departments.set(code, dept);
    }

    let zagMap = dept.zagadnienia.get(zagadnienieKey);
    if (!zagMap) {
      zagMap = new Map();
      dept.zagadnienia.set(zagadnienieKey, zagMap);
    }

    zagMap.set(period, (zagMap.get(period) ?? 0) + hours);
  }

  const sortedPeriods = [...periods].sort();

  const departmentRows: ReportPivotDepartmentRow[] = [...departments.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, dept]) => {
      const zagadnienia: ReportPivotZagadnienieRow[] = [...dept.zagadnienia.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, hoursByPeriod]) => ({
          key,
          hoursByPeriod,
          total: [...hoursByPeriod.values()].reduce((sum, h) => sum + h, 0),
        }));

      const deptHoursByPeriod = new Map<string, number>();
      for (const zag of zagadnienia) {
        for (const [period, hours] of zag.hoursByPeriod) {
          deptHoursByPeriod.set(period, (deptHoursByPeriod.get(period) ?? 0) + hours);
        }
      }

      return {
        code,
        name: dept.name,
        hoursByPeriod: deptHoursByPeriod,
        total: [...deptHoursByPeriod.values()].reduce((sum, h) => sum + h, 0),
        zagadnienia,
      };
    });

  return { periods: sortedPeriods, departments: departmentRows };
}
