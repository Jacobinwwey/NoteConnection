/**
 * Settings Manager Module
 * Handles configuration persistence, defaults, and application.
 */

const defaultSettings = {
    physics: {
        chargeStrength: -300,
        linkDistance: 100,
        collisionRadius: 20
    },
    visuals: {
        edgeOpacity: 0.6,
        baseNodeSize: 5
    }
};

class SettingsManager {
    constructor() {
        this.settings = this.load();
        this.listeners = [];
    }

    load() {
        const saved = localStorage.getItem('nc_settings');
        if (saved) {
            try {
                // Merge saved settings with defaults to ensure new keys exist
                const parsed = JSON.parse(saved);
                return this.deepMerge(defaultSettings, parsed);
            } catch (e) {
                console.error("Failed to parse settings", e);
                return JSON.parse(JSON.stringify(defaultSettings));
            }
        }
        return JSON.parse(JSON.stringify(defaultSettings));
    }

    save() {
        localStorage.setItem('nc_settings', JSON.stringify(this.settings));
        this.notify();
    }

    get(category, key) {
        return this.settings[category][key];
    }

    set(category, key, value) {
        if (!this.settings[category]) this.settings[category] = {};
        this.settings[category][key] = value;
        this.save();
    }

    // Helper for deep merging defaults
    deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], this.deepMerge(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    }

    // Observer pattern for live updates
    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        this.listeners.forEach(cb => cb(this.settings));
    }
    
    reset() {
        this.settings = JSON.parse(JSON.stringify(defaultSettings));
        this.save();
    }
}

const settingsManager = new SettingsManager();
window.settingsManager = settingsManager; // Expose globally
