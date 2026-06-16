import { ModuleFederationConfig } from '@nx/module-federation';
import * as fs from 'fs';
import * as path from 'path';

export function createModuleFederationConfig(baseConfig: ModuleFederationConfig): ModuleFederationConfig {
  const tsconfigPath = path.join(__dirname, '../../tsconfig.base.json');
  let paths: Record<string, string[]> = {};
  
  try {
    if (fs.existsSync(tsconfigPath)) {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      paths = tsconfig.compilerOptions?.paths || {};
    } else {
      console.warn(`[Module Federation Shared] tsconfig.base.json not found at ${tsconfigPath}`);
    }
  } catch (err) {
    console.error('Failed to read tsconfig.base.json for module federation:', err);
  }

  const dynamicSharedLibs = Object.keys(paths)
    .filter(key => key.startsWith('@erp/shared/') && key.split('/').length === 3)
    .map(libName => ({
      libraryName: libName,
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false as const,
      },
    }));

  // Ensure default primeng and all of its entry points are shared dynamically
  const primengShared: any[] = [
    {
      libraryName: 'primeng',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      },
    }
  ];

  try {
    const primengPkgPath = require.resolve('primeng/package.json');
    if (fs.existsSync(primengPkgPath)) {
      const primengPkg = JSON.parse(fs.readFileSync(primengPkgPath, 'utf-8'));
      if (primengPkg.exports) {
        Object.keys(primengPkg.exports).forEach(exp => {
          if (exp.startsWith('./') && exp !== './package.json') {
            const subPath = exp.replace('./', 'primeng/');
            primengShared.push({
              libraryName: subPath,
              sharedConfig: {
                singleton: true,
                strictVersion: false,
                requiredVersion: false,
              }
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('[Module Federation Shared] Could not dynamically load primeng package.json:', err);
  }

  const angularShared = [
    {
      libraryName: '@angular/core',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      }
    },
    {
      libraryName: '@angular/common',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      }
    },
    {
      libraryName: '@angular/router',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      }
    },
    {
      libraryName: '@jsverse/transloco',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      }
    }
  ];

  // Merge client's own additionalShared config with dynamic path configurations
  const mergedShared = [
    ...dynamicSharedLibs,
    ...angularShared,
    ...primengShared,
    ...(baseConfig.additionalShared || [])
  ];

  // Deduplicate libraries to avoid warnings/errors
  const seen = new Set<string>();
  const deduplicatedShared = mergedShared.filter(item => {
    const lib = typeof item === 'string' ? item : item.libraryName;
    if (seen.has(lib)) {
      return false;
    }
    seen.add(lib);
    return true;
  });

  return {
    ...baseConfig,
    additionalShared: deduplicatedShared
  };
}
