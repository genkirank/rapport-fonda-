import { db } from './db.js';
import { supabaseService } from './supabase.js';

/**
 * Simple state manager using Observer pattern
 */
class Store {
    constructor() {
        this.state = {
            activeView: 'macro', // 'macro', 'entry', 'tracker', 'report', 'auth'
            user: null,
            isAuthenticated: false,
            config: db.getConfig(),
            liveJournal: db.getLiveJournal() || [],
            backtests: db.getBacktests() || [],
            watchlist: db.getWatchlist() || [],
            fearGreed: db.getFearGreed(),
            currencyPerformance: db.getCurrencyPerformance() || [],
            centralBanks: db.getCentralBanks() || []
        };
        this.listeners = [];
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    getState() {
        return this.state;
    }

    // Auth actions
    setUser(user) {
        this.state.user = user;
        this.state.isAuthenticated = !!user;
        this.notify();
    }

    async initAuth() {
        const user = await supabaseService.init();
        this.state.user = user;
        this.state.isAuthenticated = !!user;
        this.notify();
        return user;
    }

    async logout() {
        await supabaseService.signOut();
        this.state.user = null;
        this.state.isAuthenticated = false;
        this.notify();
    }

    // Navigation Action
    setActiveView(view) {
        this.state.activeView = view;
        this.notify();
    }

    updateConfig(updates) {
        this.state.config = db.updateConfig(updates);
        this.notify();
    }

    addTrade(tradeData) {
        this.state.liveJournal = db.addLiveTrade(tradeData);
        this.notify();
    }

    deleteTrade(tradeId) {
        this.state.liveJournal = db.deleteLiveTrade(tradeId);
        this.notify();
    }

    addBacktest(backtestData) {
        this.state.backtests = db.addBacktest(backtestData);
        this.notify();
    }

    saveWatchlist(watchlist) {
        this.state.watchlist = db.saveWatchlist(watchlist);
        this.notify();
    }

    updateWatchlist(watchlistData) {
        this.saveWatchlist(watchlistData);
    }

    updateFearGreed(value, classification) {
        const fearGreedObj = { value: parseInt(value) || 0, classification };
        this.state.fearGreed = db.saveFearGreed(fearGreedObj);
        this.notify();
    }

    updateCurrencyPerformance(data) {
        this.state.currencyPerformance = db.saveCurrencyPerformance(data);
        this.notify();
    }

    updateCentralBanks(data) {
        this.state.centralBanks = db.saveCentralBanks(data);
        this.notify();
    }
}

export const store = new Store();
