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

  const taigaShared = [
    {
      libraryName: '@taiga-ui/cdk',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      }
    },
    {
      libraryName: '@taiga-ui/core',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      }
    },
    {
      libraryName: '@taiga-ui/kit',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      }
    },
    {
      libraryName: '@taiga-ui/layout',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      }
    },
    {
      libraryName: '@taiga-ui/polymorpheus',
      sharedConfig: {
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      }
    }
  ];

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
    ...taigaShared,
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
