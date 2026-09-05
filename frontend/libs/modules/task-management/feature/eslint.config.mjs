import nx from '@nx/eslint-plugin';
import baseConfig from '../../../../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'lib',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: ['lib', 'erp', 'task-management'],
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
  {
    // Granica warstwy: feature komponuje ekran z gotowych erp-*, nie renderuje surowego
    // <table>/<select>/<input>. Reguła działa na szablonie wyekstrahowanym przez procesor
    // `extract-inline-html` (stąd `**/*.html` — dotyczy wirtualnych plików szablonu, prawdziwych
    // .html moduł nie ma). Nowy przypadek wymaga albo użycia erp-* (task-management/ui lub
    // shared/ui), albo jawnie udokumentowanego wyjątku w osobnym pliku konfiguracji, z
    // właścicielem i powodem w komentarzu przy tym wyjątku.
    files: ['**/*.html'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Element[name="table"]',
          message: 'Surowy <table> w feature jest zakazany — użyj erp-table (shared/ui) albo domenowego edytora z task-management/ui.',
        },
        {
          selector: 'Element[name="select"]',
          message: 'Surowy <select> w feature jest zakazany — użyj erp-input-picker/erp-toggle-group (shared/ui).',
        },
        {
          selector: 'Element[name="input"]',
          message: 'Surowy <input> w feature jest zakazany — użyj erp-input* (shared/ui).',
        },
      ],
    },
  },
  // Brak wyjątków: upload plików (issue-attachments) renderuje się przez `erp-file-upload-list`
  // (shared/ui), a macierz przejść workflow (project-workflow-scheme) przez `erp-workflow-editor`
  // (task-management/ui) — oba poza zasięgiem tej reguły. Nowy surowy <table>/<select>/<input>
  // w feature wymaga albo erp-*, albo świadomego wyjątku w bloku poniżej z komentarzem
  // wyjaśniającym właściciela i powód pozostawienia natywnego elementu.
];
