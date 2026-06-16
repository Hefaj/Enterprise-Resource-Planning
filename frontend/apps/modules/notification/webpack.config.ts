import { withModuleFederation } from '@nx/module-federation/angular';
import { createModuleFederationConfig } from '../../module-federation.shared';
import config from './module-federation.config';

/**
 * DTS Plugin is disabled in Nx Workspaces as Nx already provides Typing support for Module Federation
 * The DTS Plugin can be enabled by setting dts: true
 * Learn more about the DTS Plugin here: https://module-federation.io/configure/dts.html
 */
export default withModuleFederation(createModuleFederationConfig(config), { dts: false });
