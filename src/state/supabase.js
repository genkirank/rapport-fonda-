/**
 * Central Supabase Client & Authentication Helper
 */

const SUPABASE_URL = 'https://axgemnwcpqwsotkxdmjb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4Z2VtbndjcHF3c290a3hkbWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODgwNTMsImV4cCI6MjEwNTY2NDA1M30.KzehvmFvPMTK2EDWthEzmpeC6A6kBKNdG5wcVM6gXas';

export class SupabaseService {
    constructor() {
        this.client = (typeof window !== 'undefined' && window.supabase)
            ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
            : null;
        this.currentUser = this.getCachedUser();
        this.session = null;
    }

    getClient() {
        if (!this.client && typeof window !== 'undefined' && window.supabase) {
            this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        return this.client;
    }

    getCachedUser() {
        if (typeof window === 'undefined') return null;
        try {
            // 1. Check for guest session
            const guest = localStorage.getItem('app_guest_session');
            if (guest) {
                return JSON.parse(guest);
            }
            // 2. Check for cached Supabase session token
            const directToken = localStorage.getItem('sb-axgemnwcpqwsotkxdmjb-auth-token');
            if (directToken) {
                const parsed = JSON.parse(directToken);
                if (parsed && (parsed.user || parsed.currentSession?.user)) {
                    return parsed.user || parsed.currentSession.user;
                }
            }
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
                    const parsed = JSON.parse(localStorage.getItem(k));
                    if (parsed && (parsed.user || parsed.currentSession?.user)) {
                        return parsed.user || parsed.currentSession.user;
                    }
                }
            }
        } catch (e) {
            console.warn('Error reading cached auth user:', e);
        }
        return null;
    }

    async init(onAuthChangeCallback) {
        // Fast path: already have a cached guest session
        const guest = typeof window !== 'undefined' ? localStorage.getItem('app_guest_session') : null;
        if (guest) {
            try {
                this.currentUser = JSON.parse(guest);
                return this.currentUser;
            } catch (e) {}
        }

        const client = this.getClient();
        if (!client) return this.currentUser;

        // Setup live auth change listener
        if (client.auth && client.auth.onAuthStateChange) {
            client.auth.onAuthStateChange((event, session) => {
                this.session = session;
                this.currentUser = session?.user || null;
                if (onAuthChangeCallback) {
                    onAuthChangeCallback(this.currentUser, event);
                }
            });
        }

        try {
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            this.session = data?.session || null;
            this.currentUser = data?.session?.user || null;
            return this.currentUser;
        } catch (e) {
            console.warn('Supabase session init warning:', e.message);
            // Fallback to cached user if offline or slow
            return this.currentUser;
        }
    }

    async signIn(email, password) {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('app_guest_session');
        }
        const client = this.getClient();
        if (!client) throw new Error('Supabase client indisponible.');

        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;

        this.session = data.session;
        this.currentUser = data.user;
        return data;
    }

    async signUp(email, password) {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('app_guest_session');
        }
        const client = this.getClient();
        if (!client) throw new Error('Supabase client indisponible.');

        const { data, error } = await client.auth.signUp({
            email,
            password
        });
        if (error) throw error;

        this.session = data.session;
        this.currentUser = data.user;
        return data;
    }

    async signOut() {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('app_guest_session');
        }
        const client = this.getClient();
        if (client) {
            try {
                await client.auth.signOut();
            } catch (e) {
                console.error(e);
            }
        }
        this.session = null;
        this.currentUser = null;
    }

    getUser() {
        return this.currentUser;
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    // ── Supabase Cloud Trades Synchronization ─────────────────────────
    buildTradeCloudPayload(trade) {
        const isClosed = trade.status === 'CLOSED' || (trade.status !== 'OPEN' && Boolean(trade.exitDate));
        const status = isClosed ? 'CLOSED' : 'OPEN';

        const meta = {
            _meta: true,
            status: status,
            timeFrame: trade.timeFrame || '1H',
            riskUsd: trade.risk != null ? Number(trade.risk) : 0,
            riskPct: trade.riskPct != null ? Number(trade.riskPct) : 1,
            plannedReward: trade.plannedReward != null ? Number(trade.plannedReward) : 0,
            entryPrice: trade.entryPrice != null && trade.entryPrice !== '' ? Number(trade.entryPrice) : null,
            stopLoss: trade.stopLoss != null && trade.stopLoss !== '' ? Number(trade.stopLoss) : null,
            takeProfit: trade.takeProfit != null && trade.takeProfit !== '' ? Number(trade.takeProfit) : null,
            exitPrice: trade.exitPrice != null && trade.exitPrice !== '' ? Number(trade.exitPrice) : null,
            lotSize: trade.lotSize != null && trade.lotSize !== '' ? Number(trade.lotSize) : null,
            stopLossPips: trade.stopLossPips != null ? Number(trade.stopLossPips) : null,
            exitDate: isClosed ? (trade.exitDate || new Date().toISOString()) : null,
            macroDailyBias: trade.macroDailyBias || 'Non défini',
            macro4hBias: trade.macro4hBias || 'Non défini',
            macroAligned: trade.macroAligned !== undefined ? trade.macroAligned : null,
            lessonNote: trade.lessons || ''
        };

        return {
            user_id: this.currentUser.id,
            account_type: trade.environment || 'Live',
            pair: trade.ticker || '',
            direction: trade.direction || 'Long',
            entry_price: trade.entryPrice != null && trade.entryPrice !== '' ? Number(trade.entryPrice) : null,
            exit_price: trade.exitPrice != null && trade.exitPrice !== '' ? Number(trade.exitPrice) : null,
            stop_loss: trade.stopLoss != null && trade.stopLoss !== '' ? Number(trade.stopLoss) : null,
            take_profit: trade.takeProfit != null && trade.takeProfit !== '' ? Number(trade.takeProfit) : null,
            pnl: isClosed && trade.netDollar != null ? Number(trade.netDollar) : 0,
            pnl_r: isClosed && trade.realizedR != null ? Number(trade.realizedR) : 0,
            pnl_usd: isClosed && trade.netDollar != null ? Number(trade.netDollar) : 0,
            risk_percentage: trade.riskPct != null ? Number(trade.riskPct) : (trade.risk != null ? Number(trade.risk) : 1),
            setup_category: trade.strategy || null,
            setup_grade: trade.grade || null,
            session: trade.session || null,
            psychology: trade.psychology || null,
            rules_respected: trade.rulesRespected !== undefined
                ? Boolean(trade.rulesRespected)
                : (!trade.psychology || !String(trade.psychology).includes('FOMO')),
            exit_type: status,
            exit_reason: trade.timeFrame || null,
            lessons: JSON.stringify(meta),
            entry_date: trade.entryDate ? new Date(trade.entryDate).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    mapCloudRowToTrade(ct, tradeN = 1, runningBalance = 10000) {
        let meta = {};
        let rawLessonText = '';
        if (ct.lessons && typeof ct.lessons === 'string') {
            if (ct.lessons.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(ct.lessons);
                    if (parsed && parsed._meta) {
                        meta = parsed;
                        rawLessonText = parsed.lessonNote || '';
                    }
                } catch (e) {
                    rawLessonText = ct.lessons;
                }
            } else {
                rawLessonText = ct.lessons;
            }
        }

        const status = meta.status || (ct.exit_type === 'OPEN' ? 'OPEN' : 'CLOSED');
        const isClosed = status === 'CLOSED';
        const entryDate = ct.entry_date || new Date().toISOString();
        const exitDate = isClosed ? (meta.exitDate || ct.updated_at || ct.entry_date) : null;

        const riskPct = meta.riskPct != null ? Number(meta.riskPct) : (Number(ct.risk_percentage) || 1);
        const riskUsd = meta.riskUsd != null
            ? Number(meta.riskUsd)
            : Number(ct.risk_percentage) || Number(((runningBalance * riskPct) / 100).toFixed(2));

        const netDollar = isClosed ? (Number(ct.pnl_usd ?? ct.pnl) || 0) : 0;
        const realizedR = isClosed
            ? (ct.pnl_r != null ? Number(ct.pnl_r) : (riskUsd > 0 ? Number((netDollar / riskUsd).toFixed(2)) : 0))
            : 0;
        const plannedReward = meta.plannedReward != null ? Number(meta.plannedReward) : realizedR;
        const entryPrice = ct.entry_price != null ? Number(ct.entry_price) : (meta.entryPrice ?? null);
        const exitPrice = ct.exit_price != null ? Number(ct.exit_price) : (meta.exitPrice ?? null);
        const stopLoss = ct.stop_loss != null ? Number(ct.stop_loss) : (meta.stopLoss ?? null);
        const takeProfit = ct.take_profit != null ? Number(ct.take_profit) : (meta.takeProfit ?? null);
        const lotSize = meta.lotSize != null ? Number(meta.lotSize) : null;
        const stopLossPips = meta.stopLossPips != null ? Number(meta.stopLossPips) : null;

        let holdingTime = 'En cours';
        let daysDifference = 0;
        if (isClosed && exitDate) {
            const diffMs = Math.max(0, new Date(exitDate).getTime() - new Date(entryDate).getTime());
            daysDifference = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            holdingTime = `${hours}h ${minutes}m`;
        }

        const entryDateObj = new Date(entryDate);
        const result = !isClosed ? 'Open' : (netDollar > 0 ? 'Win' : (netDollar < 0 ? 'Loss' : 'Break Even'));
        const progressionNet = isClosed ? Number((runningBalance + netDollar).toFixed(2)) : runningBalance;

        return {
            tradeN,
            cloudId: ct.id,
            status,
            entryDate,
            exitDate,
            ticker: (ct.pair || '').toUpperCase(),
            direction: ct.direction || 'Long',
            timeFrame: meta.timeFrame || ct.exit_reason || '1H',
            environment: ct.account_type || 'Live',
            strategy: ct.setup_category || '',
            session: ct.session || '',
            grade: ct.setup_grade || 'Setup A+ (Parfait)',
            psychology: ct.psychology || 'Respect du Plan 🟢',
            rulesRespected: ct.rules_respected !== undefined ? Boolean(ct.rules_respected) : true,
            entryPrice,
            exitPrice,
            stopLoss,
            takeProfit,
            lotSize,
            stopLossPips,
            risk: riskUsd,
            riskPct,
            plannedReward,
            realizedR,
            netDollar,
            lessons: rawLessonText,
            percentGross: isClosed && runningBalance > 0 ? Number(((netDollar / runningBalance) * 100).toFixed(2)) : 0,
            result,
            daysDifference,
            holdingTime,
            dayOfWeek: entryDateObj.toLocaleDateString('en-US', { weekday: 'long' }),
            month: entryDateObj.toLocaleDateString('en-US', { month: 'long' }),
            quarter: `Q${Math.floor((entryDateObj.getMonth() + 3) / 3)}`,
            year: entryDateObj.getFullYear(),
            progressionNet,
            macroDailyBias: meta.macroDailyBias || 'Non défini',
            macro4hBias: meta.macro4hBias || 'Non défini',
            macroAligned: meta.macroAligned !== undefined ? meta.macroAligned : null
        };
    }

    async fetchCloudTrades() {
        const client = this.getClient();
        if (!client || !this.currentUser || this.currentUser.isGuest) return [];

        try {
            const { data, error } = await client.from('trades')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('entry_date', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn('fetchCloudTrades warning:', err.message);
            return [];
        }
    }

    async saveCloudTrade(trade) {
        const client = this.getClient();
        if (!client || !this.currentUser || this.currentUser.isGuest) return null;

        try {
            const payload = this.buildTradeCloudPayload(trade);
            const { data, error } = await client.from('trades')
                .insert(payload)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            console.warn('saveCloudTrade warning:', err.message);
            return null;
        }
    }

    async updateCloudTrade(cloudId, trade) {
        const client = this.getClient();
        if (!client || !this.currentUser || this.currentUser.isGuest || !cloudId) return null;

        try {
            const payload = this.buildTradeCloudPayload(trade);
            delete payload.user_id;
            const { data, error } = await client.from('trades')
                .update(payload)
                .eq('id', cloudId)
                .eq('user_id', this.currentUser.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            console.warn('updateCloudTrade warning:', err.message);
            return null;
        }
    }

    async deleteCloudTrade(tradeId) {
        const client = this.getClient();
        if (!client || !this.currentUser || this.currentUser.isGuest || !tradeId) return;

        try {
            await client.from('trades')
                .delete()
                .eq('id', tradeId)
                .eq('user_id', this.currentUser.id);
        } catch (err) {
            console.warn('deleteCloudTrade warning:', err.message);
        }
    }

    // ── Supabase Cloud Macro Watchlist Synchronization ────────────────
    async fetchCloudWatchlist() {
        const client = this.getClient();
        if (!client || !this.currentUser || this.currentUser.isGuest) return null;

        try {
            const { data, error } = await client.from('macro_watchlist')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            if (!data) return null;

            return data.map(row => ({
                id: row.id,
                ticker: row.pair,
                dailyBias: row.daily_bias || 'Neutral',
                fourHourBias: row.h4_bias || 'Neutral',
                notes: row.catalyst || '',
                keyLevel: row.key_level || '',
                invalidation: row.invalidation || ''
            }));
        } catch (err) {
            console.warn('fetchCloudWatchlist warning:', err.message);
            return null;
        }
    }

    async syncWatchlistToCloud(watchlist) {
        const client = this.getClient();
        if (!client || !this.currentUser || this.currentUser.isGuest) return false;

        try {
            // Clear existing watchlist items for this user and insert the updated snapshot
            const { error: delError } = await client.from('macro_watchlist')
                .delete()
                .eq('user_id', this.currentUser.id);

            if (delError) throw delError;

            if (!watchlist || watchlist.length === 0) return true;

            const rows = watchlist.map(item => ({
                user_id: this.currentUser.id,
                pair: item.ticker,
                daily_bias: item.dailyBias || 'Neutral',
                h4_bias: item.fourHourBias || 'Neutral',
                catalyst: item.notes || '',
                key_level: item.keyLevel || null,
                invalidation: item.invalidation || null
            }));

            const { error: insError } = await client.from('macro_watchlist')
                .insert(rows);

            if (insError) throw insError;
            return true;
        } catch (err) {
            console.warn('syncWatchlistToCloud warning:', err.message);
            return false;
        }
    }

    // ── Supabase Cloud Report State Reader (for Watchlist Bridge) ─────
    async fetchCloudReportState() {
        const client = this.getClient();
        if (!client || !this.currentUser || this.currentUser.isGuest) return null;

        try {
            const { data, error } = await client.from('report_state')
                .select('data')
                .eq('user_id', this.currentUser.id)
                .maybeSingle();

            if (error) throw error;
            return data?.data || null;
        } catch (err) {
            console.warn('fetchCloudReportState warning:', err.message);
            return null;
        }
    }
}

export const supabaseService = new SupabaseService();


