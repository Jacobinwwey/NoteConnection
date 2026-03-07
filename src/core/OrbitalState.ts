import type { PathResult } from './PathEngine';

export class OrbitalState {
  private storageKey: string;
  private completedIds: Set<string>;
  private collapsedIds: Set<string>;
  private expansionOrder: string[];
  private stickyClaimEnabled: boolean;
  private currentCentralId: string | null;
  private learningPath: PathResult | null;
  private mode: 'domain' | 'diffusion';
  private retainHistory: boolean;

  constructor(storageKey = 'noteconnection_orbital_progress') {
    this.storageKey = storageKey;
    this.completedIds = new Set();
    this.collapsedIds = new Set();
    this.expansionOrder = [];
    this.stickyClaimEnabled = true;
    this.currentCentralId = null;
    this.learningPath = null;
    this.mode = 'domain';
    this.retainHistory = true;
    this.load();
  }

  private load(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) {
        return;
      }

      const data = JSON.parse(saved) as {
        retainHistory?: boolean;
        completedIds?: string[];
        collapsedIds?: string[];
        expansionOrder?: string[];
        stickyClaimEnabled?: boolean;
        currentCentralId?: string | null;
        mode?: 'domain' | 'diffusion';
      };

      if (data.retainHistory !== undefined) {
        this.retainHistory = data.retainHistory;
      }
      if (!this.retainHistory) {
        return;
      }

      this.completedIds = new Set(data.completedIds || []);
      this.collapsedIds = new Set(data.collapsedIds || []);
      this.expansionOrder = data.expansionOrder || [];
      if (data.stickyClaimEnabled !== undefined) {
        this.stickyClaimEnabled = data.stickyClaimEnabled;
      }
      this.currentCentralId = data.currentCentralId || null;
      this.mode = data.mode || 'domain';
    } catch (error) {
      console.warn('OrbitalState Load Error', error);
    }
  }

  private save(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    if (!this.retainHistory) {
      localStorage.removeItem(this.storageKey);
      return;
    }

    try {
      const data = {
        completedIds: Array.from(this.completedIds),
        collapsedIds: Array.from(this.collapsedIds),
        expansionOrder: this.expansionOrder,
        stickyClaimEnabled: this.stickyClaimEnabled,
        currentCentralId: this.currentCentralId,
        mode: this.mode,
        retainHistory: this.retainHistory,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('OrbitalState Save Error', error);
    }
  }

  updateSettings(config?: { retainHistory?: boolean }): void {
    if (!config || typeof config.retainHistory !== 'boolean') {
      return;
    }

    this.retainHistory = config.retainHistory;
    if (!this.retainHistory) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.storageKey);
      }
      return;
    }

    this.save();
  }

  markComplete(nodeId: string): string | null {
    this.completedIds.add(nodeId);

    if (this.learningPath && Array.isArray(this.learningPath.nodes)) {
      const currentIndex = this.learningPath.nodes.findIndex((node) => node.id === nodeId);
      for (let index = currentIndex + 1; index < this.learningPath.nodes.length; index += 1) {
        const next = this.learningPath.nodes[index];
        if (!this.completedIds.has(next.id)) {
          this.currentCentralId = next.id;
          this.save();
          return next.id;
        }
      }
    }

    this.save();
    return null;
  }

  setLearningPath(path: PathResult | null): void {
    this.learningPath = path;
    if (path && Array.isArray(path.nodes) && path.nodes.length > 0 && !this.currentCentralId) {
      const first = path.nodes.find((node) => !this.completedIds.has(node.id));
      this.currentCentralId = first ? first.id : path.nodes[0].id;
    }
    this.save();
  }

  switchCentral(nodeId: string | null, autoReconstruct = false): boolean {
    this.currentCentralId = nodeId;
    this.save();
    return autoReconstruct;
  }

  getProgress(): { completed: number; total: number } {
    const total = this.learningPath && Array.isArray(this.learningPath.nodes) ? this.learningPath.nodes.length : 0;
    return { completed: this.completedIds.size, total };
  }

  getCompletedIds(): string[] {
    return Array.from(this.completedIds);
  }

  reset(): void {
    this.completedIds.clear();
    this.collapsedIds.clear();
    this.expansionOrder = [];
    this.currentCentralId = null;
    this.learningPath = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }

  static truncateLabel(label: string, maxLen = 15): string {
    if (!label || label.length <= maxLen) {
      return label || '';
    }
    return label.substring(0, maxLen) + '...';
  }

  toggleCollapse(nodeId: string): boolean {
    if (this.collapsedIds.has(nodeId)) {
      this.collapsedIds.delete(nodeId);
      if (!this.expansionOrder.includes(nodeId)) {
        this.expansionOrder.push(nodeId);
      }
      this.save();
      return false;
    }

    this.collapsedIds.add(nodeId);
    this.expansionOrder = this.expansionOrder.filter((id) => id !== nodeId);
    this.save();
    return true;
  }

  isCollapsed(nodeId: string): boolean {
    return this.collapsedIds.has(nodeId);
  }

  collapseAll(): void {
    this.expansionOrder = [];
    this.save();
  }

  setStickyClaim(enabled: boolean): void {
    this.stickyClaimEnabled = enabled;
    this.save();
  }
}
