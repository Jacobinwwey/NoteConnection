import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class CrashLogger {
    private static logFilePath = path.join(process.cwd(), 'crash.log');

    static log(error: any, context: string = 'General') {
        const timestamp = new Date().toISOString();
        const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
        const logEntry = `[${timestamp}] [${context}] [PID:${process.pid}] Error: ${errorMessage}\n` +
                         `System: ${os.platform()} ${os.release()} | Mem: ${(os.freemem() / 1024 / 1024).toFixed(2)}MB / ${(os.totalmem() / 1024 / 1024).toFixed(2)}MB\n` +
                         `--------------------------------------------------------------------------------\n`;

        // Synchronous write to ensure log is written even if process crashes immediately after
        try {
            fs.appendFileSync(this.logFilePath, logEntry);
            console.error(`[CrashLogger] Error logged to ${this.logFilePath}`);
        } catch (writeErr) {
            console.error('[CrashLogger] Failed to write to log file:', writeErr);
            console.error('Original Error:', error);
        }
    }

    static initGlobalHandlers() {
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            CrashLogger.log(error, 'UncaughtException');
            process.exit(1); // Exit is mandatory for uncaught exceptions to avoid undefined state
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            CrashLogger.log(reason, 'UnhandledRejection');
        });
    }
}
