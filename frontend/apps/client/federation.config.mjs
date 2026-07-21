import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'client',

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
      {
        overrides: {
          '@angular/core': { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package', includeSecondaries: { keepAll: true } },
          '@angular/common/locales/pl': { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
        },
      },
    ),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Host-internal libs — skip dla Vite HMR
    '@erp/client/feature',
    '@erp/client/contract',
    '@erp/client/ui',
    '@erp/client/util',
    // Niewykorzystywane w runtime
    '@ng-web-apis/common',
    '@ng-web-apis/platform',
    '@ng-web-apis/screen-orientation',
    '@ng-web-apis/resize-observer',
    '@ng-web-apis/mutation-observer',
    '@taiga-ui/font-watcher',
    '@maskito/kit',
    'libphonenumber-js/core',
    '@maskito/phone',
    '@ng-web-apis/intersection-observer',
    '@jsverse/utils',
    '@softarc/native-federation/domain',
  ],

  features: {
    denseChunking: true
  }
});
