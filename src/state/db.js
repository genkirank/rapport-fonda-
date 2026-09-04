/**
 * LocalStorage wrapper to manage databases
 */

const STORAGE_KEYS = {
    LIVE_JOURNAL: 'live_journal_db',
    BACKTEST: 'backtest_db',
    CONFIG: 'app_config',
    DAILY_WATCHLIST: 'daily_watchlist_db',
    FEAR_GREED: 'fear_greed_db',
    CURRENCY_PERFORMANCE: 'currency_performance_db',
    CENTRAL_BANKS: 'central_banks_db'
};

const DEFAULT_CONFIG = {
    initialCapital: 10000,
    activeStrategy: 'Swing Trading'
};

export class Database {
    constructor() {
        this.initialize();
    }

    initialize() {
        // Ensure schemas exist
        if (!localStorage.getItem(STORAGE_KEYS.LIVE_JOURNAL)) {
            localStorage.setItem(STORAGE_KEYS.LIVE_JOURNAL, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.BACKTEST)) {
            localStorage.setItem(STORAGE_KEYS.BACKTEST, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
            localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(DEFAULT_CONFIG));
        }
        if (!localStorage.getItem(STORAGE_KEYS.DAILY_WATCHLIST)) {
            localStorage.setItem(STORAGE_KEYS.DAILY_WATCHLIST, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.FEAR_GREED)) {
            localStorage.setItem(STORAGE_KEYS.FEAR_GREED, JSON.stringify({ value: 24, classification: 'Extreme Fear' }));
        }
        if (!localStorage.getItem(STORAGE_KEYS.CURRENCY_PERFORMANCE)) {
            localStorage.setItem(STORAGE_KEYS.CURRENCY_PERFORMANCE, JSON.stringify([
                { currency: 'USD', value: 1.2 },
                { currency: 'EUR', value: -0.5 },
                { currency: 'GBP', value: 0.3 },
                { currency: 'JPY', value: -1.1 },
                { currency: 'CAD', value: 0.1 },
                { currency: 'AUD', value: -0.2 },
                { currency: 'CHF', value: -0.4 },
                { currency: 'NZD', value: -0.3 }
            ]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.CENTRAL_BANKS)) {
            localStorage.setItem(STORAGE_KEYS.CENTRAL_BANKS, JSON.stringify([
                { bank: 'FED', stance: 'Restrictif' },
                { bank: 'ECB', stance: 'Restrictif' },
                { bank: 'BOE', stance: 'Neutre' },
                { bank: 'BOJ', stance: 'Accommodant' },
                { bank: 'RBA', stance: 'Restrictif' },
                { bank: 'RBNZ', stance: 'Accommodant' },
                { bank: 'SNB', stance: 'Accommodant' },
                { bank: 'BOC', stance: 'Neutre' }
            ]));
        }
    }

    get(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || null;
        } catch (e) {
            console.error(`Error parsing ${key} from localStorage`, e);
            return null;
        }
    }

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Error saving ${key} to localStorage`, e);
        }
    }

    getLiveJournal() {
        return this.get(STORAGE_KEYS.LIVE_JOURNAL) || [];
    }

    addLiveTrade(trade) {
        const journal = this.getLiveJournal();
        journal.push(trade);
        this.set(STORAGE_KEYS.LIVE_JOURNAL, journal);
        return journal;
    }

    deleteLiveTrade(tradeN) {
        const journal = this.getLiveJournal();
        const updatedJournal = journal.filter(t => t.tradeN !== tradeN);
        this.set(STORAGE_KEYS.LIVE_JOURNAL, updatedJournal);
        return updatedJournal;
    }

    getBacktests() {
        return this.get(STORAGE_KEYS.BACKTEST) || [];
    }

    addBacktest(backtest) {
        const backtests = this.getBacktests();
        backtests.push(backtest);
        this.set(STORAGE_KEYS.BACKTEST, backtests);
        return backtests;
    }
    
    getConfig() {
        return this.get(STORAGE_KEYS.CONFIG);
    }

    updateConfig(updates) {
        const config = this.getConfig();
        const newConfig = { ...config, ...updates };
        this.set(STORAGE_KEYS.CONFIG, newConfig);
        return newConfig;
    }

    getWatchlist() {
        return this.get(STORAGE_KEYS.DAILY_WATCHLIST) || [];
    }

    saveWatchlist(watchlist) {
        this.set(STORAGE_KEYS.DAILY_WATCHLIST, watchlist);
        return watchlist;
    }

    getFearGreed() {
        return this.get(STORAGE_KEYS.FEAR_GREED) || { value: 24, classification: 'Extreme Fear' };
    }

    saveFearGreed(data) {
        this.set(STORAGE_KEYS.FEAR_GREED, data);
        return data;
    }

    getCurrencyPerformance() {
        return this.get(STORAGE_KEYS.CURRENCY_PERFORMANCE) || [];
    }

    saveCurrencyPerformance(data) {
        this.set(STORAGE_KEYS.CURRENCY_PERFORMANCE, data);
        return data;
    }

    getCentralBanks() {
        return this.get(STORAGE_KEYS.CENTRAL_BANKS) || [];
    }

    saveCentralBanks(data) {
        this.set(STORAGE_KEYS.CENTRAL_BANKS, data);
        return data;
    }
}

export const db = new Database();
