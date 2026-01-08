import * as os from 'os';

export class PerformanceLogger {
    private static stepStartTimes: Map<string, number> = new Map();
    private static stepStartCpu: Map<string, NodeJS.CpuUsage> = new Map();
    private static maxHeap: number = 0;
    private static maxRSS: number = 0;
    private static maxGPUMemory: number = 0; // Placeholder for GPU memory

    static logSystemInfo() {
        console.log(`[System] Platform: ${os.platform()} ${os.release()}`);
        console.log(`[System] CPU: ${os.cpus()[0].model} (${os.cpus().length} cores)`);
        console.log(`[System] Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
    }

    static updatePeakMemory() {
        const mem = process.memoryUsage();
        if (mem.heapUsed > this.maxHeap) this.maxHeap = mem.heapUsed;
        if (mem.rss > this.maxRSS) this.maxRSS = mem.rss;
        // GPU memory tracking would require binding to gpu.js or driver, which is complex.
        // For now, we leave it as 0 or manually update if we had a way.
    }

    static getPeakMemory() {
        return {
            heap: this.formatMemory(this.maxHeap),
            rss: this.formatMemory(this.maxRSS),
            gpu: this.formatMemory(this.maxGPUMemory)
        };
    }

    static start(stepName: string) {
        this.updatePeakMemory();
        this.stepStartTimes.set(stepName, performance.now());
        this.stepStartCpu.set(stepName, process.cpuUsage());
        console.log(`[Perf] Starting: ${stepName}`);
        const mem = process.memoryUsage();
        console.log(`[Perf] Initial Memory: ${this.formatMemory(mem.heapUsed)} / ${this.formatMemory(mem.rss)} (Heap/RSS)`);
    }

    static end(stepName: string) {
        this.updatePeakMemory();
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
        console.log(`[Perf] Peak Memory (Session): Heap ${this.formatMemory(this.maxHeap)} / RSS ${this.formatMemory(this.maxRSS)}`);
        if (this.maxGPUMemory > 0) {
             console.log(`[Perf] Peak GPU Memory: ${this.formatMemory(this.maxGPUMemory)}`);
        }
        console.log('--------------------------------------------------');
        
        this.stepStartTimes.delete(stepName);
        this.stepStartCpu.delete(stepName);
    }

    private static formatMemory(bytes: number): string {
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }
}
