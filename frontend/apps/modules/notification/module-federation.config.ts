import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'notification',
  exposes: {
    './contract': 'frontend/libs/modules/notification/contract/src/index.ts',
    './JobPopover': 'frontend/libs/modules/notification/feature/src/lib/job/job-popover/job-popover.component.ts',
  },
};

/**
 * Nx requires a default export of the config to allow correct resolution of the module federation graph.
 **/
export default config;
