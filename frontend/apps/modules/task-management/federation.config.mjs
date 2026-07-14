import { withNativeFederation, shareAll } from '@angular-architects/native-federation/config';

export default withNativeFederation({
  name: 'task-management',



  exposes: {
    './contract': './frontend/libs/modules/task-management/contract/src/index.ts',
  },

  shared: {
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package' },
      {
        overrides: {
          // includeSecondaries is an opt-out of ignoreUnusedDeps, so all of
          // @angular/core is shared to prevent mismatches.
          '@angular/core': { singleton: true, strictVersion: true, requiredVersion: 'auto', build: 'package', includeSecondaries: { keepAll: true } },
        },
      },
    ),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Add further packages you don't need at runtime
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

  // Please read our FAQ about sharing libs:
  // https://shorturl.at/jmzH0

  features: {
    // ignoreUnusedDeps is enabled by default now
    // ignoreUnusedDeps: true,

    // Opt-in: groups chunks in remoteEntry.json for smaller metadata file
    denseChunking: true
  }
});
