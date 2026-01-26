
import { bootstrap } from '../src/bootstrap.js';
import { ServiceContainer } from '../src/di/ServiceContainer.js';
import { IStorageProvider } from '../src/interfaces/IStorageProvider.js';
import chalk from 'chalk';

async function verify() {
  console.log(chalk.blue('🔍 Verifying Plugin System...'));

  try {
    // Bootstrap the application (loads plugins)
    const container = await bootstrap();

    // Resolve IStorageProvider
    console.log(chalk.gray('Resolving IStorageProvider...'));
    const storageFactory = container.resolve<(dir: string) => IStorageProvider>('IStorageProvider');
    const storage = storageFactory('/tmp/test');

    // Check if it's the Enterprise implementation
    // The default FileSystemStorage doesn't have 'accountId' property, but Cloudflare example does.
    // Or we can check the constructor name if we didn't minify.
    
    // In our example Enterprise plugin, checking constructor name might work if imported,
    // but here we are using the interface.
    // Let's just try to call a method and see if it throws "Not implemented" (which the mock does).
    
    console.log(chalk.gray('Checking implementation...'));
    const name = storage.constructor.name;
    console.log(`Implementation Class: ${chalk.yellow(name)}`);

    if (name === 'CloudflareStorageProvider') {
      console.log(chalk.green('✅ SUCCESS: Enterprise Plugin loaded and overrode Storage Provider!'));
    } else if (name === 'FileSystemStorage') {
      console.log(chalk.red('❌ FAILURE: Still using default FileSystemStorage. Plugin not loaded.'));
      process.exit(1);
    } else {
      console.log(chalk.yellow(`warning: Unknown implementation '${name}'. Verification inconclusive.`));
    }

  } catch (err) {
    console.error(chalk.red('❌ Verification Failed:'), err);
    process.exit(1);
  }
}

verify();
