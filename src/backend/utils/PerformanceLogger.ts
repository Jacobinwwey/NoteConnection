import * as os from 'os';

interface StepMetric {
    name: string;
    durationMs: number;
    endHeap: number;
    endRSS: number;
    maxGPU: number;
}

export class PerformanceLogger {
    private static stepStartTimes: Map<string, number> = new Map();
    private static stepStartCpu: Map<string, NodeJS.CpuUsage> = new Map();
    private static stepHistory: StepMetric[] = [];
    
    private static maxHeap: number = 0;
    private static maxRSS: number = 0;
    private static maxGPUMemory: number = 0; // Session Peak
    private static currentStepGPU: number = 0; // Peak during current step (simplified)

    static logSystemInfo() {
        console.log(`[System] Platform: ${os.platform()} ${os.release()}`);
        console.log(`[System] CPU: ${os.cpus()[0].model} (${os.cpus().length} cores)`);
        console.log(`[System] Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
    }

    static updatePeakMemory() {
        const mem = process.memoryUsage();
        if (mem.heapUsed > this.maxHeap) this.maxHeap = mem.heapUsed;
        if (mem.rss > this.maxRSS) this.maxRSS = mem.rss;
    }

    static recordGPUUsage(bytes: number) {
        if (bytes > this.maxGPUMemory) this.maxGPUMemory = bytes;
        if (bytes > this.currentStepGPU) this.currentStepGPU = bytes;
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
        this.currentStepGPU = 0; // Reset for this step (rough approx for nested steps)
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
        const duration = endTime - startTime; // Keep exact number for summary
        
        const userTime = (endCpu.user / 1000).toFixed(2);
        const systemTime = (endCpu.system / 1000).toFixed(2);

        const mem = process.memoryUsage();

        console.log(`[Perf] Finished: ${stepName}`);
        console.log(`[Perf] Time: ${duration.toFixed(2)}ms`);
        console.log(`[Perf] CPU (User/Sys): ${userTime}ms / ${systemTime}ms`);
        console.log(`[Perf] Memory (Heap/RSS): ${this.formatMemory(mem.heapUsed)} / ${this.formatMemory(mem.rss)}`);
        
        // Store metric
        this.stepHistory.push({
            name: stepName,
            durationMs: duration,
            endHeap: mem.heapUsed,
            endRSS: mem.rss,
            maxGPU: this.currentStepGPU
        });

        console.log('--------------------------------------------------');
        
        this.stepStartTimes.delete(stepName);
        this.stepStartCpu.delete(stepName);
    }

    static printSummary() {
        console.log("\n==================== PERFORMANCE SUMMARY ====================");
        const headers = `| ${"Stage".padEnd(30)} | ${"Time (ms)".padEnd(12)} | ${"Max Heap".padEnd(12)} | ${"Max RSS".padEnd(12)} | ${"Max VRAM".padEnd(12)} |`;
        console.log(headers);
        console.log("|" + "-".repeat(32) + "+" + "-".repeat(14) + "+" + "-".repeat(14) + "+" + "-".repeat(14) + "+" + "-".repeat(14) + "|");

        let totalTime = 0;
        
        this.stepHistory.forEach(step => {
            totalTime += step.durationMs;
            const line = `| ${step.name.substring(0, 30).padEnd(30)} | ${step.durationMs.toFixed(0).padEnd(12)} | ${this.formatMemory(step.endHeap).padEnd(12)} | ${this.formatMemory(step.endRSS).padEnd(12)} | ${(step.maxGPU > 0 ? this.formatMemory(step.maxGPU) : '-').padEnd(12)} |`;
            console.log(line);
        });

        console.log("|" + "-".repeat(32) + "+" + "-".repeat(14) + "+" + "-".repeat(14) + "+" + "-".repeat(14) + "+" + "-".repeat(14) + "|");
        const totalLine = `| ${"TOTAL / PEAK".padEnd(30)} | ${totalTime.toFixed(0).padEnd(12)} | ${this.formatMemory(this.maxHeap).padEnd(12)} | ${this.formatMemory(this.maxRSS).padEnd(12)} | ${this.formatMemory(this.maxGPUMemory).padEnd(12)} |`;
        console.log(totalLine);
        console.log("=============================================================\n");
    }

    private static formatMemory(bytes: number): string {
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }
}
