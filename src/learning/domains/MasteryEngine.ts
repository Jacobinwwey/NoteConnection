/** MasteryEngine domain — L3: Mastery diagnostics, learning paths, study sessions.
 * Domain-level analysis complements KLP's deep methods with:
 * - Mastery trend analysis across sequential diagnoses
 * - Path quality metrics (prerequisite completeness, confidence distribution)
 * - Session plan budget validation against domain constraints
 * - Misconception severity trend tracking
 */
export interface MasteryPlatform {
    diagnoseMastery(request: any): Promise<any>;
    queryMasteryMisconceptions(request: any): Promise<any>;
    buildLearningPath(request: any): Promise<any>;
    buildStudySession(request: any): Promise<any>;
    queryStudySessionHistory(request: any): Promise<any>;
    executeStudySessionAction(request: any): Promise<any>;
    executeStudySessionPlan(request: any): Promise<any>;
    updateStudySessionOrchestrationConfig(request: any): Promise<any>;
}

export class MasteryEngine {
    private pathGenerationCount = 0;
    private sessionBuildCount = 0;
    private sessionExecutionCount = 0;
    private actionExecutionCount = 0;
    private masteryDiagnosticCount = 0;
    private lastPathGeneratedAt: string | null = null;

    // Domain-level analysis state
    private masteryTrendSnapshots: Array<{
        generatedAt: string;
        averageMasteryBefore: number;
        averageMasteryAfter: number;
        updatedCount: number;
        gainPct: number;
    }> = [];
    private misconceptionTrendSnapshots: Array<{
        generatedAt: string;
        totalItems: number;
        averageSeverity: number;
        highSeverityCount: number;
        topErrorTag: string | null;
    }> = [];
    private pathQualityHistory: Array<{
        generatedAt: string;
        totalNodes: number;
        prerequisiteCoveragePct: number;
        averagePriority: number;
        actionKindDistribution: Record<string, number>;
    }> = [];
    private sessionBudgetViolations: Array<{
        generatedAt: string;
        violation: string;
        observed: number;
        limit: number;
    }> = [];

    // Domain budget constraints
    private readonly budgets = {
        maxActionsPerSession: 60,
        maxEstimatedMinutesPerSession: 480,
        minEvidenceCoveragePct: 30,
        maxActionsPerAtom: 5,
        minActionKindDiversity: 2,
    };

    constructor(private readonly platform: MasteryPlatform) {}

    async diagnoseMastery(r: any) {
        this.masteryDiagnosticCount++;
        const response = await this.platform.diagnoseMastery(r);

        // Domain-level mastery trend analysis
        this.recordMasteryTrendSnapshot(response);
        const trend = this.computeMasteryTrend(10);

        return {
            ...response,
            _domain: {
                diagnosticNumber: this.masteryDiagnosticCount,
                trend,
            },
        };
    }

    async queryMisconceptions(r: any) {
        const response = await this.platform.queryMasteryMisconceptions(r);

        // Domain-level misconception trend analysis
        this.recordMisconceptionSnapshot(response);
        const trend = this.computeMisconceptionTrend(8);

        // Augment misconception items with domain-level risk classification
        const items = (response?.items || []).map((item: any) => ({
            ...item,
            riskLevel: this.classifyMisconceptionRisk(item),
        }));

        return { ...response, items, _domain: { trend } };
    }

    async buildLearningPath(r: any) {
        this.pathGenerationCount++;
        this.lastPathGeneratedAt = new Date().toISOString();

        this.validatePathRequest(r);

        // Domain-level budget validation for path parameters
        this.validatePathBudgets(r);

        const response = await this.platform.buildLearningPath(r);

        // Record path quality metrics
        this.recordPathQuality(response);

        return this.augmentPathResponse(response);
    }

    async buildStudySession(r: any) {
        this.sessionBuildCount++;

        // Domain-level session budget validation
        this.validateSessionBudgets(r);

        const response = await this.platform.buildStudySession(r);

        // Domain-level session quality analysis
        const quality = this.analyzeSessionQuality(response);

        return { ...response, _domain: { sessionBuildNumber: this.sessionBuildCount, quality } };
    }

    async querySessionHistory(r: any) {
        const response = await this.platform.queryStudySessionHistory(r);

        // Domain-level history aggregation
        const records = response?.records || [];
        const aggregated = this.aggregateSessionHistory(records);

        return { ...response, _domain: { aggregated } };
    }

    async executeSessionAction(r: any) {
        this.actionExecutionCount++;

        // Validate action against per-atom budget
        const atomBudget = this.checkAtomActionBudget(r);
        if (!atomBudget.ok) {
            this.sessionBudgetViolations.push({
                generatedAt: new Date().toISOString(),
                violation: `atom_action_budget:${r?.action?.atomId}`,
                observed: atomBudget.count,
                limit: this.budgets.maxActionsPerAtom,
            });
            this.pruneViolations();
        }

        const response = await this.platform.executeStudySessionAction(r);
        return response;
    }

    async executeSessionPlan(r: any) {
        this.sessionExecutionCount++;

        // Domain-level plan validation
        this.validatePlanExecution(r);

        const response = await this.platform.executeStudySessionPlan(r);

        // Augment with domain-level execution telemetry
        return {
            ...response,
            _domain: {
                executionNumber: this.sessionExecutionCount,
                planSize: Array.isArray(r?.actions) ? r.actions.length : 0,
                pathStrategy: r?.pathStrategy ?? 'default',
            },
        };
    }

    async updateOrchestrationConfig(r: any) {
        return this.platform.updateStudySessionOrchestrationConfig(r);
    }

    // ─── Public accessors ───────────────────────────────────────────

    getPathGenerationCount(): number { return this.pathGenerationCount; }
    getSessionExecutionCount(): number { return this.sessionExecutionCount; }

    getDiagnosticsSummary() {
        return {
            masteryDiagnosticCount: this.masteryDiagnosticCount,
            pathGenerationCount: this.pathGenerationCount,
            lastPathGeneratedAt: this.lastPathGeneratedAt,
            sessionBuildCount: this.sessionBuildCount,
            sessionExecutionCount: this.sessionExecutionCount,
            actionExecutionCount: this.actionExecutionCount,
            masteryTrend: this.computeMasteryTrend(5),
            misconceptionTrend: this.computeMisconceptionTrend(5),
            budgetViolationCount: this.sessionBudgetViolations.length,
            recentBudgetViolations: this.sessionBudgetViolations.slice(-5),
        };
    }

    getMasteryTrendSnapshots(): readonly any[] { return [...this.masteryTrendSnapshots]; }
    getBudgetViolations(): readonly any[] { return [...this.sessionBudgetViolations]; }

    // ─── Private: validation ────────────────────────────────────────

    private validatePathRequest(r: any): void {
        if (!r) throw new Error('Learning path request is required.');
        const targetId = String(r?.targetId ?? '').trim();
        if (!targetId && !r?.targetIds?.length) {
            throw new Error('At least one targetId is required to build a learning path.');
        }
    }

    private validatePathBudgets(r: any): void {
        const maxMastery = Number(r?.maxMasteryPaths);
        const maxDivergence = Number(r?.maxDivergencePaths);
        if (maxMastery > 12) throw new Error('maxMasteryPaths exceeds domain limit of 12.');
        if (maxDivergence > 12) throw new Error('maxDivergencePaths exceeds domain limit of 12.');
    }

    private validateSessionBudgets(r: any): void {
        const maxActions = Number(r?.maxActions);
        if (maxActions > this.budgets.maxActionsPerSession) {
            throw new Error(
                `maxActions (${maxActions}) exceeds domain budget of ${this.budgets.maxActionsPerSession}.`
            );
        }
    }

    private validatePlanExecution(r: any): void {
        if (!r) throw new Error('Study session plan execution request is required.');
        if (!r?.userId) throw new Error('userId is required for plan execution.');
        const actions = Array.isArray(r?.actions) ? r.actions : [];
        if (actions.length === 0 && !r?.focusAtomIds?.length) {
            throw new Error('Plan must contain at least one action or focusAtomId.');
        }
        if (actions.length > this.budgets.maxActionsPerSession) {
            throw new Error(
                `Plan action count (${actions.length}) exceeds session budget of ${this.budgets.maxActionsPerSession}.`
            );
        }
    }

    // ─── Private: augmentation ──────────────────────────────────────

    private augmentPathResponse(response: any): any {
        const nodes = Array.isArray(response?.nodes) ? response.nodes : [];
        const masteryPaths = Array.isArray(response?.masteryPaths) ? response.masteryPaths : [];
        const divergencePaths = Array.isArray(response?.divergencePaths) ? response.divergencePaths : [];

        // Compute prerequisite coverage
        const prerequisiteCoveragePct = this.computePrerequisiteCoverage(masteryPaths, divergencePaths);

        return {
            ...response,
            _domain: {
                pathLength: nodes.length,
                generatedAt: this.lastPathGeneratedAt,
                generationNumber: this.pathGenerationCount,
                hasPrerequisites: nodes.some((n: any) => n?.prerequisites?.length > 0),
                estimatedDurationMinutes: nodes.length * 15,
                prerequisiteCoveragePct,
                masteryPathCount: masteryPaths.length,
                divergencePathCount: divergencePaths.length,
            },
        };
    }

    // ─── Private: mastery trend analysis ────────────────────────────

    private recordMasteryTrendSnapshot(response: any): void {
        const summary = response?.summary || {};
        const before = Number(summary.averageMasteryBefore || 0);
        const after = Number(summary.averageMasteryAfter || 0);
        const gainPct = before > 0 ? Number(((after - before) / before * 100).toFixed(2)) : 0;

        this.masteryTrendSnapshots.push({
            generatedAt: new Date().toISOString(),
            averageMasteryBefore: before,
            averageMasteryAfter: after,
            updatedCount: summary.updatedCount || 0,
            gainPct,
        });
        if (this.masteryTrendSnapshots.length > 50) this.masteryTrendSnapshots.shift();
    }

    private computeMasteryTrend(n: number): {
        direction: string;
        recentGainPct: number;
        windowAvgGainPct: number;
        snapshots: number;
    } {
        const window = this.masteryTrendSnapshots.slice(-n);
        if (window.length < 2) {
            return {
                direction: 'insufficient_data',
                recentGainPct: window[0]?.gainPct ?? 0,
                windowAvgGainPct: window[0]?.gainPct ?? 0,
                snapshots: window.length,
            };
        }
        const mid = Math.floor(window.length / 2);
        const recentAvg = window.slice(-mid).reduce((s, e) => s + e.gainPct, 0) / mid;
        const earlierAvg = window.slice(0, mid).reduce((s, e) => s + e.gainPct, 0) / mid;
        const delta = recentAvg - earlierAvg;

        return {
            direction: delta > 3 ? 'accelerating' : delta > 0.5 ? 'improving' : delta < -3 ? 'declining' : delta < -0.5 ? 'slowing' : 'stable',
            recentGainPct: window[window.length - 1].gainPct,
            windowAvgGainPct: Number((window.reduce((s, e) => s + e.gainPct, 0) / window.length).toFixed(2)),
            snapshots: window.length,
        };
    }

    // ─── Private: misconception trend analysis ──────────────────────

    private recordMisconceptionSnapshot(response: any): void {
        const items = Array.isArray(response?.items) ? response.items : [];
        const highSeverityCount = items.filter((i: any) => (i.severityScore || 0) >= 0.7).length;
        const averageSeverity = items.length > 0
            ? Number((items.reduce((s: number, i: any) => s + (i.severityScore || 0), 0) / items.length).toFixed(4))
            : 0;
        const topItem = items.length > 0 ? items[0] : null;

        this.misconceptionTrendSnapshots.push({
            generatedAt: new Date().toISOString(),
            totalItems: items.length,
            averageSeverity,
            highSeverityCount,
            topErrorTag: topItem?.errorTag ?? null,
        });
        if (this.misconceptionTrendSnapshots.length > 50) this.misconceptionTrendSnapshots.shift();
    }

    private computeMisconceptionTrend(n: number): {
        direction: string;
        recentAvgSeverity: number;
        highSeverityTrend: string;
        snapshots: number;
    } {
        const window = this.misconceptionTrendSnapshots.slice(-n);
        if (window.length < 2) {
            return {
                direction: 'insufficient_data',
                recentAvgSeverity: window[0]?.averageSeverity ?? 0,
                highSeverityTrend: 'stable',
                snapshots: window.length,
            };
        }
        const mid = Math.floor(window.length / 2);
        const recentAvg = window.slice(-mid).reduce((s, e) => s + e.averageSeverity, 0) / mid;
        const earlierAvg = window.slice(0, mid).reduce((s, e) => s + e.averageSeverity, 0) / mid;
        const delta = recentAvg - earlierAvg;

        const recentHigh = window.slice(-mid).reduce((s, e) => s + e.highSeverityCount, 0);
        const earlierHigh = window.slice(0, mid).reduce((s, e) => s + e.highSeverityCount, 0);

        return {
            direction: delta < -0.05 ? 'resolving' : delta > 0.05 ? 'worsening' : 'stable',
            recentAvgSeverity: Number(recentAvg.toFixed(4)),
            highSeverityTrend: recentHigh < earlierHigh ? 'decreasing' : recentHigh > earlierHigh ? 'increasing' : 'stable',
            snapshots: window.length,
        };
    }

    private classifyMisconceptionRisk(item: any): string {
        const severity = Number(item?.severityScore || 0);
        const count = Number(item?.count || 0);
        if (severity >= 0.8 && count >= 5) return 'critical';
        if (severity >= 0.6) return 'high';
        if (severity >= 0.35) return 'moderate';
        return 'low';
    }

    // ─── Private: path quality metrics ──────────────────────────────

    private recordPathQuality(response: any): void {
        const masteryPaths = Array.isArray(response?.masteryPaths) ? response.masteryPaths : [];
        const divergencePaths = Array.isArray(response?.divergencePaths) ? response.divergencePaths : [];
        const allActions = [...masteryPaths, ...divergencePaths].flatMap((p: any) => p.actions || []);
        const totalNodes = allActions.length;
        const prerequisiteCoveragePct = this.computePrerequisiteCoverage(masteryPaths, divergencePaths);
        const averagePriority = totalNodes > 0
            ? Number((allActions.reduce((s: number, a: any) => s + (a.priority || 0), 0) / totalNodes).toFixed(2))
            : 0;

        const actionKindDistribution: Record<string, number> = {};
        for (const action of allActions) {
            const kind = String(action.kind || 'unknown');
            actionKindDistribution[kind] = (actionKindDistribution[kind] || 0) + 1;
        }

        this.pathQualityHistory.push({
            generatedAt: new Date().toISOString(),
            totalNodes,
            prerequisiteCoveragePct,
            averagePriority,
            actionKindDistribution,
        });
        if (this.pathQualityHistory.length > 50) this.pathQualityHistory.shift();
    }

    private computePrerequisiteCoverage(
        masteryPaths: any[],
        divergencePaths: any[]
    ): number {
        const allPaths = [...masteryPaths, ...divergencePaths];
        let totalPrerequisites = 0;
        let coveredPrerequisites = 0;

        for (const path of allPaths) {
            const prerequisites = Array.isArray(path?.prerequisites) ? path.prerequisites : [];
            totalPrerequisites += prerequisites.length;
            for (const prereq of prerequisites) {
                const prereqId = String(prereq?.id || prereq);
                const isCovered = allPaths.some((p: any) =>
                    p.targetAtomId === prereqId ||
                    (p.actions || []).some((a: any) => a.atomId === prereqId)
                );
                if (isCovered) coveredPrerequisites++;
            }
        }

        return totalPrerequisites > 0
            ? Number(((coveredPrerequisites / totalPrerequisites) * 100).toFixed(1))
            : 100;
    }

    // ─── Private: session quality analysis ──────────────────────────

    private analyzeSessionQuality(response: any): {
        actionKindDiversity: number;
        evidenceCoveragePct: number;
        averagePriority: number;
        withinBudget: boolean;
        budgetWarnings: string[];
    } {
        const actions = Array.isArray(response?.actions) ? response.actions : [];
        const summary = response?.summary || {};

        const kinds = new Set(actions.map((a: any) => String(a.kind || '')));
        const evidenceCoveragePct = (summary.evidenceCoverageRatio ?? 0) * 100;
        const averagePriority = actions.length > 0
            ? Number((actions.reduce((s: number, a: any) => s + (a.priority || 0), 0) / actions.length).toFixed(2))
            : 0;

        const budgetWarnings: string[] = [];
        if (actions.length > this.budgets.maxActionsPerSession * 0.8) {
            budgetWarnings.push(`Action count (${actions.length}) near budget limit (${this.budgets.maxActionsPerSession}).`);
        }
        if (evidenceCoveragePct < this.budgets.minEvidenceCoveragePct) {
            budgetWarnings.push(`Evidence coverage (${Number(evidenceCoveragePct).toFixed(1)}%) below minimum (${this.budgets.minEvidenceCoveragePct}%).`);
        }
        if (kinds.size < this.budgets.minActionKindDiversity) {
            budgetWarnings.push(`Action kind diversity (${kinds.size}) below recommended minimum (${this.budgets.minActionKindDiversity}).`);
        }

        return {
            actionKindDiversity: kinds.size,
            evidenceCoveragePct: Number(evidenceCoveragePct.toFixed(1)),
            averagePriority,
            withinBudget: budgetWarnings.length === 0,
            budgetWarnings,
        };
    }

    // ─── Private: session history aggregation ───────────────────────

    private aggregateSessionHistory(records: any[]): {
        totalSessions: number;
        totalActions: number;
        averageMasteryDelta: number;
        averageTutorConfidence: number;
    } {
        let totalActions = 0;
        let masteryDeltaSum = 0;
        let confidenceSum = 0;

        for (const record of records) {
            totalActions += Math.max(0, Math.floor(Number(record.executedCount || 0)));
            masteryDeltaSum += Number(record.averageMasteryDelta || 0);
            confidenceSum += Number(record.averageTutorConfidence || 0);
        }

        return {
            totalSessions: records.length,
            totalActions,
            averageMasteryDelta: records.length > 0
                ? Number((masteryDeltaSum / records.length).toFixed(6))
                : 0,
            averageTutorConfidence: records.length > 0
                ? Number((confidenceSum / records.length).toFixed(4))
                : 0,
        };
    }

    // ─── Private: atom action budget ────────────────────────────────

    private atomActionCounts = new Map<string, number>();

    private checkAtomActionBudget(r: any): { ok: boolean; count: number } {
        const atomId = String(r?.action?.atomId || '');
        if (!atomId) return { ok: true, count: 0 };
        const count = (this.atomActionCounts.get(atomId) || 0) + 1;
        this.atomActionCounts.set(atomId, count);
        return { ok: count <= this.budgets.maxActionsPerAtom, count };
    }

    private pruneViolations(): void {
        if (this.sessionBudgetViolations.length > 100) {
            this.sessionBudgetViolations.shift();
        }
    }
}