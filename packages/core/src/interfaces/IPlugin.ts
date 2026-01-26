import { ServiceContainer } from '../di/ServiceContainer.js';
import { ConfigStore } from '../ConfigStore.js';

/**
 * Interface that all FoundrySpec plugins must implement.
 * Plugins can register their own implementations of core services.
 */
export interface IPlugin {
  /**
   * Unique plugin identifier (e.g., '@futurefoundaihq/foundryspec-enterprise')
   */
  name: string;

  /**
   * Plugin version
   */
  version: string;

  /**
   * Called during application startup to register services.
   * @param container - DI container to register services
   * @param config - Global configuration store
   */
  register(container: ServiceContainer, config: ConfigStore): Promise<void>;
}
