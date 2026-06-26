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
          prefix: ['lib', 'erp', 'catalog'],
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.html'],
    rules: {
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/label-has-associated-control': 'off',
      '@angular-eslint/prefer-inject': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
];

