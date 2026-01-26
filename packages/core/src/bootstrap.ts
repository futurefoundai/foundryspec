import { ServiceContainer } from './di/ServiceContainer.js';
import { ConfigStore } from './ConfigStore.js';
import { PluginManager } from './services/PluginManager.js';
import { FileSystemStorage } from './adapters/FileSystemStorage.js';
import { LocalCommentSystem } from './services/LocalCommentService.js';
import { IStorageProvider } from './interfaces/IStorageProvider.js';
import { ICommentSystem } from './interfaces/ICommentSystem.js';

/**
 * Bootstrap the application:
 * 1. Create DI container
 * 2. Register default services
 * 3. Load plugins (which may override defaults)
 */
export async function bootstrap(): Promise<ServiceContainer> {
  const container = new ServiceContainer();
  const config = new ConfigStore();

  // Register default implementations
  // These will be overridden by plugins if they provide alternatives
  container.register<ConfigStore>('ConfigStore', config);

  // Storage provider factory - creates instance for a specific project
  container.register<(storageDir: string) => IStorageProvider>(
    'IStorageProvider',
    () => (storageDir: string) => new FileSystemStorage(storageDir),
    true
  );

  // Comment system factory
  container.register<(storage: IStorageProvider) => ICommentSystem>(
    'ICommentSystem',
    () => (storage: IStorageProvider) => new LocalCommentSystem(storage),
    true
  );

  // Load plugins
  const pluginManager = new PluginManager(container, config);
  await pluginManager.loadPlugins();

  return container;
}
