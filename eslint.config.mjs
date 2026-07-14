import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          // Pozwalamy linterowi na swobodne importy w plikach konfiguracyjnych
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
            '@ngrx/.*'
          ],

          depConstraints: [
            // --- 1. ZASADY DOMENOWE (SCOPE) ---
            {
              sourceTag: 'scope:host',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:host'],
            },
            {
              sourceTag: 'scope:catalog',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:catalog'],
            },
            {
              sourceTag: 'scope:inventory',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:inventory'],
            },
            {
              sourceTag: 'scope:sales',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:sales'],
            },
            {
              sourceTag: 'scope:dms',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:dms'],
            },
            {
              sourceTag: 'scope:task-management',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:task-management'],
            },
            {
              sourceTag: 'scope:notification',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:notification'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },

            // --- 2. ZASADY WARSTW TECHNICZNYCH (TYPE) ---
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:feature', 'type:contract', 'type:ui', 'type:data-access', 'type:util', 'type:auth', 'type:env'],
            },
            {
              sourceTag: 'type:contract',
              onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:auth', 'type:data-access', 'type:util', 'type:env'],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: ['type:ui', 'type:data-access', 'type:util', 'type:auth'],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:data-access', 'type:util'],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:util'],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util', 'type:data-access'],
            },
            {
              sourceTag: 'type:auth',
              onlyDependOnLibsWithTags: ['type:auth'],
            },
            {
              sourceTag: 'type:env',
              onlyDependOnLibsWithTags: ['type:env'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/remote-api.providers.ts'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    // Override or add rules here
    rules: {
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/explicit-function-return-type': ['error'],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
      ],
    },
  },
  {
    files: [
      '**/libs/shared/ui/**/*.ts',
      '**/libs/shared/ui/**/*.html',
      '**/libs/modules/catalog/**/*.ts',
      '**/libs/modules/catalog/**/*.html',
      '**/libs/modules/dms/ui/**/*.ts',
      '**/libs/modules/dms/ui/**/*.html'
    ],
    rules: {
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/label-has-associated-control': 'off',
      '@angular-eslint/component-selector': 'off',
      '@angular-eslint/directive-selector': 'off',
    },
  },
];
