/**
 * Simple Dependency Injection Container
 * Used to register and resolve services throughout the application.
 */
export class ServiceContainer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private services: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private singletons: Map<string, any> = new Map();

  /**
   * Register a service implementation for a given token.
   * @param token - Service identifier (e.g., 'IStorageProvider')
   * @param implementation - The concrete implementation or factory function
   * @param singleton - If true, the same instance is returned on every resolve
   */
  register<T>(token: string, implementation: T | (() => T), singleton = true): void {
    this.services.set(token, { implementation, singleton });
  }

  /**
   * Resolve a service by its token.
   * @param token - Service identifier
   * @returns The registered implementation
   */
  resolve<T>(token: string): T {
    const registration = this.services.get(token);
    
    if (!registration) {
      throw new Error(`Service '${token}' not registered in container`);
    }

    const { implementation, singleton } = registration;

    // If singleton and already instantiated, return cached instance
    if (singleton && this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    // If implementation is a factory function, invoke it
    const instance = typeof implementation === 'function' ? implementation() : implementation;

    // Cache if singleton
    if (singleton) {
      this.singletons.set(token, instance);
    }

    return instance as T;
  }

  /**
   * Check if a service is registered
   */
  has(token: string): boolean {
    return this.services.has(token);
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.singletons.clear();
  }
}
