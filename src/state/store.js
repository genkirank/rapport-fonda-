import { db } from './db.js';
import { supabaseService } from './supabase.js';
import { closeTradeRecord, recalculateProgression, isTradeClosed } from '../utils/calculations.js';

/**
 * Central state manager using Observer pattern
 */
class Store {
    constructor() {
        const cachedUser = supabaseService.getUser();
        const config = db.getConfig() || { initialCapital: 10000, activeStrategy: 'Swing Trading' };
        const rawJournal = db.getLiveJournal() || [];

        this.state = {
            activeView: 'macro', // 'macro', 'entry', 'tracker', 'report', 'auth'
            user: cachedUser,
            isAuthenticated: !!cachedUser,
            config: config,
            liveJournal: recalculateProgression(rawJournal, config.initialCapital),
            backtests: db.getBacktests() || [],
            watchlist: db.getWatchlist() || [],
            fearGreed: db.getFearGreed(),
            currencyPerformance: db.getCurrencyPerformance() || [],
            centralBanks: db.getCentralBanks() || [],
            pendingTradeSetup: null
        };
        this.listeners = [];
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify(options = {}) {
        this.listeners.forEach(listener => listener(this.state, options));
    }

    getState() {
        return this.state;
    }

    // Auth actions
    setUser(user) {
        this.state.user = user;
        this.state.isAuthenticated = !!user;
        this.notify();
        if (user && !user.isGuest) {
            this.syncAllFromCloud();
        }
    }

    async initAuth() {
        const user = await supabaseService.init((updatedUser) => {
            this.state.user = updatedUser;
            this.state.isAuthenticated = !!updatedUser;
            this.notify();
            if (updatedUser && !updatedUser.isGuest) {
                this.syncAllFromCloud();
            }
        });
        this.state.user = user;
        this.state.isAuthenticated = !!user;
        this.notify();
        if (user && !user.isGuest) {
            await this.syncAllFromCloud();
        }
        return user;
    }

    async logout() {
        await supabaseService.signOut();
        this.state.user = null;
        this.state.isAuthenticated = false;
        this.notify();
    }

    // Navigation & Watchlist -> Trade Entry Bridge
    setActiveView(view) {
        this.state.activeView = view;
        this.notify();
    }

    armTradeSetup(setupData) {
        this.state.pendingTradeSetup = {
            ticker: setupData.ticker || '',
            direction: setupData.direction || 'Long',
            dailyBias: setupData.dailyBias || 'Neutral',
            fourHourBias: setupData.fourHourBias || 'Neutral',
            keyLevel: setupData.keyLevel || '',
            invalidation: setupData.invalidation || '',
            notes: setupData.notes || ''
        };
        this.state.activeView = 'entry';
        this.notify();
    }

    consumePendingTradeSetup() {
        const setup = this.state.pendingTradeSetup;
        this.state.pendingTradeSetup = null;
        return setup;
    }

    updateConfig(updates) {
        this.state.config = db.updateConfig(updates);
        this.notify();
    }

    getCurrentBalance() {
        const initialCap = Number(this.state.config?.initialCapital) || 10000;
        const closedTrades = (this.state.liveJournal || []).filter(isTradeClosed);
        if (closedTrades.length === 0) return initialCap;
        return Number(closedTrades[closedTrades.length - 1].progressionNet) || initialCap;
    }

    addTrade(tradeData) {
        const initialCap = Number(this.state.config?.initialCapital) || 10000;
        const rawJournal = db.addLiveTrade(tradeData);
        this.state.liveJournal = recalculateProgression(rawJournal, initialCap);
        db.saveLiveJournal(this.state.liveJournal);
        this.notify();

        // Asynchronously sync to Supabase Cloud Trades
        if (this.state.user && !this.state.user.isGuest) {
            supabaseService.saveCloudTrade(tradeData).then(cloudTrade => {
                if (cloudTrade && cloudTrade.id) {
                    tradeData.cloudId = cloudTrade.id;
                    db.saveLiveJournal(this.state.liveJournal);
                }
            }).catch(err => console.warn('Cloud trade sync error:', err));
        }
    }

    closeTrade(tradeId, closeData) {
        const initialCap = Number(this.state.config?.initialCapital) || 10000;
        const currentBalance = this.getCurrentBalance();
        let closedTradeRef = null;

        const updatedJournal = db.updateLiveTrade(tradeId, (existingTrade) => {
            closedTradeRef = closeTradeRecord(existingTrade, closeData, currentBalance);
            return closedTradeRef;
        });

        this.state.liveJournal = recalculateProgression(updatedJournal, initialCap);
        db.saveLiveJournal(this.state.liveJournal);
        this.notify();

        // Sync closed trade to Supabase Cloud
        if (closedTradeRef && this.state.user && !this.state.user.isGuest) {
            if (closedTradeRef.cloudId) {
                supabaseService.updateCloudTrade(closedTradeRef.cloudId, closedTradeRef)
                    .catch(err => console.warn('Cloud trade close update error:', err));
            } else {
                supabaseService.saveCloudTrade(closedTradeRef).then(cloudTrade => {
                    if (cloudTrade && cloudTrade.id) {
                        closedTradeRef.cloudId = cloudTrade.id;
                        db.saveLiveJournal(this.state.liveJournal);
                    }
                }).catch(err => console.warn('Cloud trade close insert error:', err));
            }
        }

        return closedTradeRef;
    }

    deleteTrade(tradeId) {
        const initialCap = Number(this.state.config?.initialCapital) || 10000;
        const trade = (this.state.liveJournal || []).find(
            t => String(t.tradeN) === String(tradeId) || (t.cloudId && String(t.cloudId) === String(tradeId))
        );
        const remaining = db.deleteLiveTrade(trade ? (trade.tradeN ?? trade.cloudId) : tradeId);
        this.state.liveJournal = recalculateProgression(remaining, initialCap);
        db.saveLiveJournal(this.state.liveJournal);
        this.notify();

        // Delete from cloud if applicable
        if (trade && trade.cloudId && this.state.user && !this.state.user.isGuest) {
            supabaseService.deleteCloudTrade(trade.cloudId);
        }
    }

    async syncAllFromCloud() {
        if (!this.state.user || this.state.user.isGuest) return;
        await Promise.all([
            this.syncTradesFromCloud(),
            this.syncWatchlistFromCloud()
        ]);
    }

    async syncTradesFromCloud() {
        if (!this.state.user || this.state.user.isGuest) return;
        try {
            const cloudTrades = await supabaseService.fetchCloudTrades();
            const initialCap = Number(this.state.config?.initialCapital) || 10000;
            const localTrades = db.getLiveJournal() || [];

            if (cloudTrades && cloudTrades.length > 0) {
                let runningBalance = initialCap;
                const mappedCloud = cloudTrades.map((ct, idx) => {
                    const mapped = supabaseService.mapCloudRowToTrade(ct, idx + 1, runningBalance);
                    if (mapped.status === 'CLOSED') {
                        runningBalance = mapped.progressionNet;
                    }
                    return mapped;
                });

                // Preserve any unsynced local trades and push them to Cloud
                const unsyncedLocals = localTrades.filter(lt => {
                    if (lt.cloudId) return false;
                    return !mappedCloud.some(mc =>
                        mc.ticker === lt.ticker &&
                        Math.abs(new Date(mc.entryDate).getTime() - new Date(lt.entryDate).getTime()) < 10000
                    );
                });

                for (const unsynced of unsyncedLocals) {
                    const saved = await supabaseService.saveCloudTrade(unsynced);
                    if (saved && saved.id) {
                        unsynced.cloudId = saved.id;
                    }
                    mappedCloud.push(unsynced);
                }

                const finalJournal = recalculateProgression(mappedCloud, initialCap);
                db.saveLiveJournal(finalJournal);
                this.state.liveJournal = finalJournal;
                this.notify();
            } else if (localTrades.length > 0) {
                // Cloud is empty but local has trades: push local cache to Cloud
                for (const lt of localTrades) {
                    if (!lt.cloudId) {
                        const saved = await supabaseService.saveCloudTrade(lt);
                        if (saved && saved.id) lt.cloudId = saved.id;
                    }
                }
                db.saveLiveJournal(localTrades);
            }
        } catch (e) {
            console.warn('syncTradesFromCloud error:', e);
        }
    }

    async syncWatchlistFromCloud() {
        if (!this.state.user || this.state.user.isGuest) return;
        try {
            const cloudWatchlist = await supabaseService.fetchCloudWatchlist();
            const localWatchlist = db.getWatchlist() || [];

            if (cloudWatchlist && cloudWatchlist.length > 0) {
                db.saveWatchlist(cloudWatchlist);
                this.state.watchlist = cloudWatchlist;
                this.notify();
            } else if (cloudWatchlist && cloudWatchlist.length === 0 && localWatchlist.length > 0) {
                // Seed cloud with existing local watchlist
                await supabaseService.syncWatchlistToCloud(localWatchlist);
            }
        } catch (e) {
            console.warn('syncWatchlistFromCloud error:', e);
        }
    }

    addBacktest(backtestData) {
        this.state.backtests = db.addBacktest(backtestData);
        this.notify();
    }

    saveWatchlist(watchlist, options = {}) {
        this.state.watchlist = db.saveWatchlist(watchlist);
        this.notify(options);

        if (this.state.user && !this.state.user.isGuest) {
            supabaseService.syncWatchlistToCloud(watchlist).catch(err => {
                console.warn('Watchlist cloud sync error:', err);
            });
        }
    }

    updateWatchlist(watchlistData, options = {}) {
        this.saveWatchlist(watchlistData, options);
    }

    updateFearGreed(value, classification, options = { silent: true }) {
        const fearGreedObj = { value: parseInt(value) || 0, classification };
        this.state.fearGreed = db.saveFearGreed(fearGreedObj);
        this.notify(options);
    }

    updateCurrencyPerformance(data, options = { silent: true }) {
        this.state.currencyPerformance = db.saveCurrencyPerformance(data);
        this.notify(options);
    }

    updateCentralBanks(data, options = { silent: true }) {
        this.state.centralBanks = db.saveCentralBanks(data);
        this.notify(options);
    }
}

export const store = new Store();

