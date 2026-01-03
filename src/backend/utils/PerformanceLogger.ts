import * as os from 'os';

export class PerformanceLogger {
    private static stepStartTimes: Map<string, number> = new Map();
    private static stepStartCpu: Map<string, NodeJS.CpuUsage> = new Map();

    static logSystemInfo() {
        console.log(`[System] Platform: ${os.platform()} ${os.release()}`);
        console.log(`[System] CPU: ${os.cpus()[0].model} (${os.cpus().length} cores)`);
        console.log(`[System] Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
    }

    static start(stepName: string) {
        this.stepStartTimes.set(stepName, performance.now());
        this.stepStartCpu.set(stepName, process.cpuUsage());
        console.log(`[Perf] Starting: ${stepName}`);
        const mem = process.memoryUsage();
        console.log(`[Perf] Initial Memory: ${this.formatMemory(mem.heapUsed)} / ${this.formatMemory(mem.rss)} (Heap/RSS)`);
    }

    static end(stepName: string) {
        const startTime = this.stepStartTimes.get(stepName);
        const startCpu = this.stepStartCpu.get(stepName);

        if (startTime === undefined || startCpu === undefined) {
            console.warn(`[Perf] Step '${stepName}' was not started.`);
            return;
        }

        const endTime = performance.now();
        const endCpu = process.cpuUsage(startCpu);
        const duration = (endTime - startTime).toFixed(2);
        
        // CPU usage is in microseconds. Convert to ms for display.
        const userTime = (endCpu.user / 1000).toFixed(2);
        const systemTime = (endCpu.system / 1000).toFixed(2);

        const mem = process.memoryUsage();

        console.log(`[Perf] Finished: ${stepName}`);
        console.log(`[Perf] Time: ${duration}ms`);
        console.log(`[Perf] CPU (User/Sys): ${userTime}ms / ${systemTime}ms`);
        console.log(`[Perf] Memory (Heap/RSS): ${this.formatMemory(mem.heapUsed)} / ${this.formatMemory(mem.rss)}`);
        console.log('--------------------------------------------------');
        
        this.stepStartTimes.delete(stepName);
        this.stepStartCpu.delete(stepName);
    }

    private static formatMemory(bytes: number): string {
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }
}
