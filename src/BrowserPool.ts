/**
 * © 2026 FutureFoundAI. All rights reserved.
 */

import { Browser } from 'puppeteer';
import puppeteer from 'puppeteer';

/**
 * Singleton class for managing a shared Puppeteer browser instance
 * to avoid repeated browser launches.
 */
export class BrowserPool {
    private static instance: Browser | null = null;
    private static isLaunching = false;
    private static launchPromise: Promise<Browser> | null = null;

    /**
     * Get or create the shared browser instance
     */
    static async getBrowser(): Promise<Browser> {
        // If already have instance, return it
        if (this.instance && this.instance.isConnected()) {
            return this.instance;
        }

        // If currently launching, wait for it
        if (this.isLaunching && this.launchPromise) {
            return this.launchPromise;
        }

        // Launch new browser
        this.isLaunching = true;
        this.launchPromise = puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
            ],
            headless: true,
        });

        try {
            this.instance = await this.launchPromise;
            this.isLaunching = false;
            return this.instance;
        } catch (error) {
            this.isLaunching = false;
            this.launchPromise = null;
            throw error;
        }
    }

    /**
     * Close the browser instance
     */
    static async close(): Promise<void> {
        if (this.instance) {
            await this.instance.close();
            this.instance = null;
            this.launchPromise = null;
        }
    }

    /**
     * Check if browser is running
     */
    static isRunning(): boolean {
        return this.instance !== null && this.instance.isConnected();
    }
}

// Cleanup on process exit
process.on('exit', () => {
    if (BrowserPool.isRunning()) {
        BrowserPool.close().catch(() => {
            // Ignore errors during shutdown
        });
    }
});
