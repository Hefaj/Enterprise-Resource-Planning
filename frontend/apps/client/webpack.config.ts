import { withModuleFederation } from '@nx/module-federation/angular';
import { createModuleFederationConfig } from '../module-federation.shared';
import config from './module-federation.config';

/**
 * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support for Module Federation
 * The DTS Plugin can be enabled by setting dts: true
 * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function (wConfig: any): Promise<any> {
  // Pobieramy konfigurator
  const mf = await withModuleFederation(createModuleFederationConfig(config), { dts: false });

  const customConfig = await mf(wConfig);

  return customConfig;
}
