import { ServiceContainer } from '../di/ServiceContainer.js';
import { ConfigStore } from '../ConfigStore.js';
import { IPlugin } from '../interfaces/IPlugin.js';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

/**
 * Discovers and loads FoundrySpec plugins.
 */
/**
 * @foundryspec COMP_PluginManager
 */
export class PluginManager {
  private container: ServiceContainer;
  private config: ConfigStore;
  private loadedPlugins: IPlugin[] = [];

  constructor(container: ServiceContainer, config: ConfigStore) {
    this.container = container;
    this.config = config;
  }

  /**
   * Discover and load all available plugins.
   * Searches for:
   * 1. @foundryspec/enterprise
   * 2. Packages matching 'foundryspec-plugin-*'
   */
  async loadPlugins(): Promise<void> {
    const pluginCandidates = await this.discoverPlugins();

    for (const pluginPath of pluginCandidates) {
      try {
        await this.loadPlugin(pluginPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(chalk.yellow(`⚠️  Failed to load plugin ${pluginPath}: ${msg}`));
      }
    }

    if (this.loadedPlugins.length > 0) {
      console.log(chalk.cyan(`\n✨ Loaded ${this.loadedPlugins.length} plugin(s):`));
      this.loadedPlugins.forEach(p => console.log(chalk.gray(`   - ${p.name} v${p.version}`)));
    }
  }

  /**
   * Discover plugin packages in node_modules.
   */
  private async discoverPlugins(): Promise<string[]> {
    const candidates: string[] = [];
    
    // Look for plugin-* packages
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    if (await fs.pathExists(nodeModulesPath)) {
      const packages = await fs.readdir(nodeModulesPath);
      for (const pkg of packages) {
        if (pkg.startsWith('foundryspec-plugin-')) {
          candidates.push(pkg);
        }
      }
    }

    return candidates;
  }

  /**
   * Check if a package exists in node_modules.
   */
  private async packageExists(packageName: string): Promise<boolean> {
    try {
      const pkgPath = path.join(process.cwd(), 'node_modules', packageName, 'package.json');
      return await fs.pathExists(pkgPath);
    } catch {
      return false;
    }
  }

  /**
   * Load a single plugin.
   */
  private async loadPlugin(packageName: string): Promise<void> {
    // Dynamic import
    const module = await import(packageName);
    
    // Plugin should export a 'plugin' object or default export
    const plugin: IPlugin = module.plugin || module.default;
    
    if (!plugin || typeof plugin.register !== 'function') {
      throw new Error(`Package ${packageName} does not export a valid FoundrySpec plugin`);
    }

    console.log(chalk.blue(`📦 Loading plugin: ${plugin.name}...`));
    
    // Allow plugin to register its services
    await plugin.register(this.container, this.config);
    
    this.loadedPlugins.push(plugin);
  }

  /**
   * Get all loaded plugins.
   */
  getLoadedPlugins(): IPlugin[] {
    return [...this.loadedPlugins];
  }
}
