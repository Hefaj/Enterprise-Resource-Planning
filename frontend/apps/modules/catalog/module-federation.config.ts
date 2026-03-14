import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'catalog',
  exposes: {
    './Routes': 'frontend/apps/modules/catalog/src/app/remote-entry/entry.routes.ts',
    './MenuDefinition': 'frontend/apps/modules/catalog/src/app/remote-entry/entry.menu.ts',
  },
};

/**
 * Nx requires a default export of the config to allow correct resolution of the module federation graph.
 **/
export default config;
