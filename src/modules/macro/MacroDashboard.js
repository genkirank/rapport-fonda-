import { store } from '../../state/store.js';
import { supabaseService } from '../../state/supabase.js';
import {
    isTradeClosed,
    computeCurrencyStrengthMatrix,
    computeGlobalExposure
} from '../../utils/calculations.js';
import { openCloseTradeModal, showAppToast } from '../entry/CloseTradeModal.js';

const DEFAULT_WEEKLY_REPORT_WATCHLIST = [
    {
        ticker: 'USD/CAD',
        dailyBias: 'Bullish',
        fourHourBias: 'Bullish',
        keyLevel: '1.3917',
        invalidation: '1.3879',
        notes: 'Divergence Fed (statu quo prolongé) vs BoC (baisse 25 bps intégrée) + choc pétrolier. Cassure H1 validée, SL sécurisé au BE.'
    },
    {
        ticker: 'AUD/NZD',
        dailyBias: 'Bullish',
        fourHourBias: 'Bullish',
        keyLevel: 'Zone 50% Fibo Weekly',
        invalidation: 'Sous creux H1',
        notes: 'Divergence RBA hawkish (2 hausses pricées) vs RBNZ attentiste/dovish. Attente de retracement sur les 50% Fibo Weekly + cassure H1.'
    },
    {
        ticker: 'EUR/USD',
        dailyBias: 'Bearish',
        fourHourBias: 'Bearish',
        keyLevel: 'Pullback résistance H4',
        invalidation: 'Invalidation structure H4',
        notes: 'Pression énergétique directe sur la zone euro vs prime de liquidité USD et Fed patiente. Sais: Baissier | Retail: 65% Long ( signal short ).'
    },
    {
        ticker: 'NZD/USD',
        dailyBias: 'Bearish',
        fourHourBias: 'Bearish',
        keyLevel: '0.5738',
        invalidation: '0.5912',
        notes: 'RBNZ dovish face à une Fed sans baisse + aversion au risque géopolitique pénalisant le NZD. En position short (SL au BE, TP1 touché).'
    },
    {
        ticker: 'USD/JPY',
        dailyBias: 'Bearish',
        fourHourBias: 'Bearish',
        keyLevel: '159.45',
        invalidation: '160.20',
        notes: 'Surveillance intervention BoJ / MoF sur la zone des 160.00 + risque de débouclage carry trade en cas d\'escalade géopolitique.'
    },
    {
        ticker: 'GBP/USD',
        dailyBias: 'Bearish',
        fourHourBias: 'Bearish',
        keyLevel: 'Cassure support D1/H4',
        invalidation: 'Au-dessus dernier sommet H1',
        notes: 'Stagflation UK et BoE divisée face au dollar soutenu par les taux US. En attente de cassure baissière validée en H1.'
    }
];

function normalizeReportTicker(rawPair) {
    if (!rawPair || typeof rawPair !== 'string') return '';
    const trimmed = rawPair.trim();
    const slashMatch = trimmed.match(/\b([A-Za-z]{3})\s*\/\s*([A-Za-z]{3})\b/);
    if (slashMatch) {
        return `${slashMatch[1].toUpperCase()}/${slashMatch[2].toUpperCase()}`;
    }
    const concatMatch = trimmed.match(/\b(EUR|USD|GBP|JPY|CHF|CAD|AUD|NZD|XAU|XAG|BTC|ETH)\s*[-_]?\s*(EUR|USD|GBP|JPY|CHF|CAD|AUD|NZD)\b/i);
    if (concatMatch) {
        return `${concatMatch[1].toUpperCase()}/${concatMatch[2].toUpperCase()}`;
    }
    const firstToken = trimmed.split(/[\s(·\-]+/)[0].toUpperCase();
    if (firstToken.length === 6 && !firstToken.includes('/')) {
        return `${firstToken.slice(0, 3)}/${firstToken.slice(3)}`;
    }
    return firstToken;
}

function mapReportBiasToDashboard(rawBias, rawPair = '', rawNotes = '') {
    const b = String(rawBias || '').toLowerCase().trim();
    if (b.includes('haussier') || b.includes('bull') || b === 'long') return 'Bullish';
    if (b.includes('baissier') || b.includes('bear') || b === 'short') return 'Bearish';
    if (b.includes('neutre') || b.includes('neutral')) return 'Neutral';

    const ctx = `${rawPair} ${rawNotes}`.toLowerCase();
    if (ctx.includes('short bias') || ctx.includes(' short') || ctx.includes('baissier') || ctx.includes('baisse')) {
        return 'Bearish';
    }
    if (ctx.includes('long bias') || ctx.includes(' long') || ctx.includes('haussier') || ctx.includes('hausse')) {
        return 'Bullish';
    }
    return 'Neutral';
}

function convertReportSessionToWatchlist(sessionObj) {
    if (!sessionObj || typeof sessionObj !== 'object') return [];

    // Support direct array of watchlist items if stored in report_state
    if (Array.isArray(sessionObj.watchlist) && sessionObj.watchlist.length > 0) {
        return sessionObj.watchlist.map(item => {
            const ticker = normalizeReportTicker(item.ticker || item.pair || '');
            if (!ticker) return null;
            const dailyBias = mapReportBiasToDashboard(item.dailyBias || item.bias, item.pair || item.ticker, item.notes);
            return {
                ticker,
                dailyBias,
                fourHourBias: item.fourHourBias ? mapReportBiasToDashboard(item.fourHourBias) : dailyBias,
                keyLevel: item.keyLevel || '',
                invalidation: item.invalidation || '',
                notes: item.notes || item.catalyst || ''
            };
        }).filter(Boolean);
    }

    const watchCards = Array.isArray(sessionObj.watchCards) ? sessionObj.watchCards : [];
    const fields = (sessionObj.fields && typeof sessionObj.fields === 'object') ? sessionObj.fields : {};

    if (watchCards.length === 0) return [];

    const converted = [];
    watchCards.forEach((card, idx) => {
        if (!card) return;
        const rawPair = card.pair || fields[`wc-pair-${idx}`] || '';
        const ticker = normalizeReportTicker(rawPair);
        if (!ticker) return;

        const rawBias = card.bias || fields[`wbias-val-${idx}`] || '';
        const fundNote = String(fields[`wc-fund-${idx}`] || card.fundamental || card.notes || '').replace(/\s+/g, ' ').trim();
        const techNote = String(fields[`wss-note-${idx}-0`] || '').replace(/\s+/g, ' ').trim();

        const extrasParts = [];
        const sais = card.extras?.sais || fields[`wextra-txt-${idx}-sais`];
        const retail = card.extras?.retail || fields[`wextra-txt-${idx}-retail`];
        const yields = card.extras?.yields || fields[`wextra-txt-${idx}-yields`];
        if (sais) extrasParts.push(`Sais: ${String(sais).trim()}`);
        if (retail) extrasParts.push(`Retail: ${String(retail).trim()}`);
        if (yields) extrasParts.push(`Yields: ${String(yields).trim()}`);

        const dailyBias = mapReportBiasToDashboard(rawBias, rawPair, `${fundNote} ${techNote}`);

        const noteSegments = [];
        if (fundNote) noteSegments.push(fundNote);
        if (techNote) noteSegments.push(`Plan Tech: ${techNote}`);
        if (extrasParts.length > 0) noteSegments.push(extrasParts.join(' | '));

        // Check if there is a fallback default entry for this ticker to enrich keyLevel/invalidation if not explicitly parsed
        const fallbackMatch = DEFAULT_WEEKLY_REPORT_WATCHLIST.find(d => d.ticker === ticker);
        const notes = noteSegments.join(' — ') || (fallbackMatch ? fallbackMatch.notes : '');

        converted.push({
            ticker,
            dailyBias,
            fourHourBias: dailyBias,
            keyLevel: card.keyLevel || (fallbackMatch ? fallbackMatch.keyLevel : ''),
            invalidation: card.invalidation || (fallbackMatch ? fallbackMatch.invalidation : ''),
            notes
        });
    });

    return converted;
}

export function renderMacroDashboard(state = {}) {
    const container = document.createElement('div');
    container.className = 'macro-dashboard';

    try {
        const safeState = state && typeof state === 'object' ? state : {};
        let localWatchlist = Array.isArray(safeState.watchlist)
            ? JSON.parse(JSON.stringify(safeState.watchlist.filter(Boolean)))
            : [];
        let watchlistSaveTimer = null;

        const currentBalance = store.getCurrentBalance ? store.getCurrentBalance() : 10000;
        const safeJournal = Array.isArray(safeState.liveJournal) ? safeState.liveJournal.filter(Boolean) : [];
        const openTrades = safeJournal.filter(t => !isTradeClosed(t));
        const exposure = computeGlobalExposure(safeJournal, currentBalance);

        const centralBanks = Array.isArray(safeState.centralBanks) && safeState.centralBanks.length > 0
            ? safeState.centralBanks.filter(Boolean)
            : [
                { bank: 'FED', stance: 'Restrictif' },
                { bank: 'ECB', stance: 'Restrictif' },
                { bank: 'BOE', stance: 'Neutre' },
                { bank: 'BOJ', stance: 'Accommodant' },
                { bank: 'RBA', stance: 'Restrictif' },
                { bank: 'RBNZ', stance: 'Accommodant' },
                { bank: 'SNB', stance: 'Accommodant' },
                { bank: 'BOC', stance: 'Neutre' }
            ];

        let currencyPerformance = Array.isArray(safeState.currencyPerformance) && safeState.currencyPerformance.length > 0
            ? [...safeState.currencyPerformance.filter(Boolean)]
            : [
                { currency: 'USD', value: 1.2 },
                { currency: 'EUR', value: -0.5 },
                { currency: 'GBP', value: 0.3 },
                { currency: 'JPY', value: -1.1 },
                { currency: 'CAD', value: 0.1 },
                { currency: 'AUD', value: -0.2 },
                { currency: 'CHF', value: -0.4 },
                { currency: 'NZD', value: -0.3 }
            ];

        // Sort G10 currencies dynamically from Strongest to Weakest on load
        currencyPerformance.sort((a, b) => (parseFloat(b && b.value) || 0) - (parseFloat(a && a.value) || 0));

        const fng = (safeState.fearGreed && typeof safeState.fearGreed === 'object')
            ? safeState.fearGreed
            : { value: 24, classification: 'Extreme Fear' };
        const matrix = computeCurrencyStrengthMatrix(currencyPerformance);

        const exposureRatio = Math.min(100, (exposure.totalRiskPct / (exposure.maxAllowedPct || 2)) * 100);
        const exposureColor = exposure.isOverExposed
            ? 'var(--color-loss)'
            : (exposure.totalRiskPct >= 1.5 ? '#f59e0b' : 'var(--color-win)');

        container.innerHTML = `
        <style>
            @keyframes pulse-glow {
                0% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.7); }
                70% { box-shadow: 0 0 0 8px rgba(0, 230, 118, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0); }
            }
            @keyframes alert-pulse {
                0% { box-shadow: 0 0 0 0 rgba(255, 82, 82, 0.6); }
                70% { box-shadow: 0 0 0 10px rgba(255, 82, 82, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 82, 82, 0); }
            }
            .glow-dot {
                width: 8px;
                height: 8px;
                background-color: var(--color-win);
                border-radius: 50%;
                display: inline-block;
                animation: pulse-glow 2s infinite;
            }
            .active-trade-item {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: var(--spacing-md);
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-md);
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
            }
            .watchlist-card {
                background-color: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-md);
                padding: var(--spacing-md);
                transition: transform var(--transition-fast), box-shadow var(--transition-fast);
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .watchlist-card:hover {
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
                border-color: #3f3f46;
            }
        </style>

        <div class="card-header" style="margin-bottom: var(--spacing-md); flex-wrap: wrap; gap: 12px;">
            <div>
                <h2>Macro Insights — Desk Scanner</h2>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">Matrice de force G10, exposition globale en direct et sas d'armement Watchlist.</p>
            </div>
        </div>

        <!-- TOP ELITE BANNER: 1. Currency Strength Matrix Arbitrage + 2. Live Risk Exposure Monitor -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
            <!-- Top Arbitrage Macro du Jour -->
            <div class="card" id="top-arbitrage-banner" style="background: linear-gradient(135deg, rgba(0, 191, 165, 0.08) 0%, rgba(18, 19, 22, 0.95) 100%); border: 1px solid rgba(0, 191, 165, 0.3); display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
                <!-- Dynamically rendered by renderArbitrageBanner() -->
            </div>

            <!-- Live Global Risk & Exposure Monitor -->
            <div class="card" style="border: 1px solid ${exposure.isOverExposed ? 'var(--color-loss)' : 'var(--border-color)'}; ${exposure.isOverExposed ? 'animation: alert-pulse 2s infinite; background: rgba(255, 82, 82, 0.06);' : ''} display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div>
                        <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-secondary); font-weight: 700;">Moniteur de Risque & Exposition Directe</span>
                        <h3 style="margin-top: 4px; font-size: 1.15rem; display: flex; align-items: center; gap: 10px;">
                            <span>Exposition Actuelle :</span>
                            <span class="mono-text" style="color: ${exposureColor}; font-weight: 800;">
                                ${exposure.totalRiskPct.toFixed(2)}% / ${exposure.maxAllowedPct.toFixed(1)}% Max autorisé
                            </span>
                        </h3>
                    </div>
                    <span style="padding: 4px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 800; background: ${exposure.isOverExposed ? 'rgba(255, 82, 82, 0.2)' : 'rgba(0, 230, 118, 0.12)'}; color: ${exposureColor}; border: 1px solid ${exposureColor};">
                        ${exposure.isOverExposed ? '⚠️ ALERTE SUR-EXPOSITION' : '✓ RISQUE MAÎTRISÉ'}
                    </span>
                </div>

                <div>
                    <div style="width: 100%; height: 8px; background: var(--bg-tertiary); border-radius: 999px; overflow: hidden; border: 1px solid var(--border-color);">
                        <div style="width: ${exposureRatio}%; height: 100%; background: ${exposureColor}; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.8rem; color: var(--text-secondary);">
                        <span>Positions ouvertes (OPEN) : <strong style="color: var(--text-primary);">${exposure.openCount}</strong></span>
                        <span>Risque total engagé : <strong class="mono-text" style="color: var(--text-primary);">$${exposure.totalRiskUsd.toFixed(2)}</strong> sur <strong class="mono-text">$${currentBalance.toLocaleString('en-US')}</strong></span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 3-CARD MACRO OVERVIEW GRID -->
        <div class="grid-layout" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
            <!-- Fear & Greed Index Card -->
            <div class="card" id="fear-greed-gauge" style="display: flex; flex-direction: column; justify-content: space-between;">
                <h3>Sentiment — Fear & Greed</h3>
                <div style="display: flex; flex-direction: column; gap: var(--spacing-sm); margin-top: var(--spacing-sm);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary); width: 60px;">Index:</span>
                        <input type="number" id="fng-value-input" min="0" max="100" value="${fng.value}" style="flex: 1; padding: 6px; font-weight: bold; text-align: center; font-family: var(--font-mono);" />
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary); width: 60px;">Régime:</span>
                        <select id="fng-classification-select" style="flex: 1; padding: 6px; font-weight: bold; border-radius: var(--border-radius-sm);">
                            <option value="Extreme Fear" ${fng.classification === 'Extreme Fear' ? 'selected' : ''}>Extreme Fear 🔴</option>
                            <option value="Fear" ${fng.classification === 'Fear' ? 'selected' : ''}>Fear 🟠</option>
                            <option value="Neutral" ${fng.classification === 'Neutral' ? 'selected' : ''}>Neutral 🟡</option>
                            <option value="Greed" ${fng.classification === 'Greed' ? 'selected' : ''}>Greed 🟢</option>
                            <option value="Extreme Greed" ${fng.classification === 'Extreme Greed' ? 'selected' : ''}>Extreme Greed 🟢</option>
                        </select>
                    </div>
                    <button id="fetch-fng-btn" style="background-color: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 8px; font-size: 0.82rem; font-weight: 600; border-radius: var(--border-radius-sm); cursor: pointer; margin-top: 4px;">
                        Actualiser via API Live 🔄
                    </button>
                </div>
            </div>
            
            <!-- Weekly Currency Strength Matrix Card (Sorted Strongest -> Weakest) -->
            <div class="card" id="currency-ranking" style="max-height: 290px; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h3 style="font-size: 1rem;">Currency Strength (G10)</h3>
                    <button type="button" id="sort-currencies-btn" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--color-accent); padding: 4px 8px; font-size: 0.72rem; font-weight: 700; border-radius: 6px; cursor: pointer;">
                        ⇅ Trier Forte ➔ Faible
                    </button>
                </div>
                <div id="currency-perf-list" style="display: flex; flex-direction: column; gap: 6px;">
                    <!-- Injected via renderCurrencyMatrixList() -->
                </div>
            </div>
            
            <!-- Central Bank Stance Card -->
            <div class="card" id="central-banks" style="max-height: 290px; overflow-y: auto;">
                <h3 style="font-size: 1rem; margin-bottom: 8px;">Central Bank Stances</h3>
                <div id="central-banks-list" style="display: flex; flex-direction: column; gap: 6px;">
                    ${centralBanks.map((b, idx) => `
                        <div class="bank-row" data-index="${idx}" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; gap: var(--spacing-sm);">
                            <span style="font-weight: 700; font-size: 0.85rem;">${b.bank}</span>
                            <select class="bank-stance-select" style="width: 130px; padding: 4px 8px; font-weight: bold; font-size: 0.8rem; border-radius: 6px;">
                                <option value="Restrictif" ${b.stance === 'Restrictif' ? 'selected' : ''}>Restrictif 🔴</option>
                                <option value="Neutre" ${b.stance === 'Neutre' ? 'selected' : ''}>Neutre 🟡</option>
                                <option value="Accommodant" ${b.stance === 'Accommodant' ? 'selected' : ''}>Accommodant 🟢</option>
                            </select>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <!-- CONTROL CENTER: 1. Active Positions (OPEN) + 2. Actionable Watchlist (Sas de tir) -->
        <div class="card">
            <div class="card-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: var(--spacing-md); margin-bottom: var(--spacing-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--spacing-md);">
                <div>
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <h3 style="font-size: 1.25rem;">Sas de Tir — Watchlist Actionnable & Positions Actives</h3>
                        <span id="watchlist-sync-status" style="font-size: 0.74rem; color: var(--color-win); background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.25); padding: 3px 10px; border-radius: 999px; font-weight: 700;">
                            ✓ Auto-Sync Cloud (500ms)
                        </span>
                    </div>
                    <p style="color: var(--text-secondary); font-size: 0.84rem; margin-top: 4px;">Préparez vos zones triggers, niveaux d'invalidation (SL) et armez directement vos setups vers le calculateur MT5.</p>
                </div>
                <div style="display: flex; gap: var(--spacing-sm); align-items: center; flex-wrap: wrap;">
                    <button type="button" id="import-report-watchlist-btn" style="background: rgba(0, 191, 165, 0.14); color: var(--color-accent); border: 1px solid rgba(0, 191, 165, 0.45); padding: 8px 14px; font-size: 0.82rem; font-weight: 800; border-radius: var(--border-radius-sm); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0, 191, 165, 0.15);">
                        📥 Importer la Watchlist du Rapport Hebdo
                    </button>
                    <input type="text" id="new-ticker-input" placeholder="ex: EUR/USD" style="text-transform: uppercase; width: 130px; padding: 8px 12px; font-size: 0.85rem; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm); font-weight: 700;" />
                    <button id="add-ticker-btn" style="background-color: var(--color-accent); color: #052623; padding: 8px 16px; font-size: 0.85rem; font-weight: 800; border-radius: var(--border-radius-sm); box-shadow: 0 2px 8px rgba(0, 191, 165, 0.25); cursor: pointer;">+ Ajouter Paire</button>
                </div>
            </div>

            <!-- Active Open Positions -->
            <div id="active-trades-container" style="margin-bottom: var(--spacing-xl);">
                <h4 style="color: var(--text-secondary); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: var(--spacing-md); display: flex; align-items: center; gap: 8px;">
                    <span class="glow-dot"></span>
                    Positions Actives en Cours (${openTrades.length} OPEN)
                </h4>
                <div id="active-trades-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: var(--spacing-md);">
                    <!-- Injected via renderActiveTrades() -->
                </div>
            </div>

            <!-- Actionable Daily Watchlist -->
            <div>
                <h4 style="color: var(--text-secondary); font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: var(--spacing-md); display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: var(--color-accent);"></span>
                    Watchlist Macro Actionnable (<span id="watchlist-count-badge">${localWatchlist.length}</span>)
                </h4>
                <div id="watchlist-items-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: var(--spacing-md);">
                    <!-- Injected via renderWatchlist() -->
                </div>
            </div>
        </div>
    `;

    // Render Top Arbitrage Macro Banner dynamically
    function renderArbitrageBanner() {
        const banner = container.querySelector('#top-arbitrage-banner');
        if (!banner) return;
        const m = computeCurrencyStrengthMatrix(currencyPerformance);
        const sSign = m.strongest.value >= 0 ? '+' : '';
        const wSign = m.weakest.value >= 0 ? '+' : '';

        banner.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                <div>
                    <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-accent); font-weight: 800;">⚡ Top Arbitrage Macro du Jour (Matrice G10)</span>
                    <div style="margin-top: 6px; font-size: 1.05rem; font-weight: 800; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="color: var(--color-win);">🟢 ${m.strongest.currency} Fort (${sSign}${m.strongest.value}%)</span>
                        <span style="color: var(--text-muted);">vs</span>
                        <span style="color: var(--color-loss);">🔴 ${m.weakest.currency} Faible (${wSign}${m.weakest.value}%)</span>
                    </div>
                </div>
                <span class="mono-text" style="font-size: 0.75rem; padding: 4px 8px; border-radius: 6px; background: rgba(255,255,255,0.05); color: var(--text-secondary);">
                    Spread: ${m.spread}%
                </span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);">
                <span style="font-size: 0.85rem; color: var(--text-primary);">
                    ➔ Focus <strong>${m.canonicalDirection} ${m.canonicalPair}</strong> <span style="color: var(--text-secondary); font-size: 0.78rem;">(ou ${m.canonicalDirection === 'Long' ? 'Short' : 'Long'} ${m.inversePair})</span>
                </span>
                <button type="button" id="arm-top-arbitrage-btn" style="background: var(--color-accent); color: #052623; padding: 6px 12px; font-size: 0.78rem; font-weight: 800; border-radius: 6px; cursor: pointer;">
                    ⚡ Armer ${m.canonicalPair} (${m.canonicalDirection})
                </button>
            </div>
        `;

        const armArbBtn = banner.querySelector('#arm-top-arbitrage-btn');
        if (armArbBtn) {
            armArbBtn.addEventListener('click', () => {
                store.armTradeSetup({
                    ticker: m.canonicalPair,
                    direction: m.canonicalDirection,
                    dailyBias: m.canonicalBias,
                    fourHourBias: m.canonicalBias,
                    keyLevel: '',
                    invalidation: '',
                    notes: `Arbitrage G10 : ${m.strongest.currency} Fort (${sSign}${m.strongest.value}%) vs ${m.weakest.currency} Faible (${wSign}${m.weakest.value}%)`
                });
            });
        }
    }

    // Render G10 Currency Strength List
    function renderCurrencyMatrixList() {
        const listEl = container.querySelector('#currency-perf-list');
        if (!listEl) return;

        listEl.innerHTML = currencyPerformance.map((c, idx) => {
            const val = parseFloat(c.value) || 0;
            const isPositive = val >= 0;
            const colorStyle = isPositive ? 'color: var(--color-win);' : 'color: var(--color-loss);';
            const rankBadge = idx === 0
                ? '<span style="font-size:0.68rem; padding:1px 6px; border-radius:4px; background:var(--color-win-transparent); color:var(--color-win); font-weight:800;">#1 FORT</span>'
                : (idx === currencyPerformance.length - 1
                    ? '<span style="font-size:0.68rem; padding:1px 6px; border-radius:4px; background:var(--color-loss-transparent); color:var(--color-loss); font-weight:800;">#8 FAIBLE</span>'
                    : `<span style="font-size:0.7rem; color:var(--text-muted); font-family:var(--font-mono);">#${idx + 1}</span>`);

            return `
                <div class="currency-row" data-index="${idx}" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${rankBadge}
                        <span style="font-weight: 800; font-size: 0.85rem;">${c.currency}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <input type="number" step="0.01" class="currency-perf-input" value="${val}" style="width: 72px; text-align: right; font-weight: 800; padding: 4px 6px; font-family: var(--font-mono); font-size: 0.85rem; border: 1px solid var(--border-color); background: var(--bg-tertiary); border-radius: 6px; ${colorStyle}" />
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">%</span>
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.currency-perf-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.closest('.currency-row').getAttribute('data-index'));
                const val = parseFloat(e.target.value) || 0;
                currencyPerformance[index].value = val;
                e.target.style.color = val >= 0 ? 'var(--color-win)' : 'var(--color-loss)';
                store.updateCurrencyPerformance(currencyPerformance, { silent: true });
                renderArbitrageBanner();
            });
        });
    }

    container.querySelector('#sort-currencies-btn').addEventListener('click', () => {
        currencyPerformance.sort((a, b) => (parseFloat(b.value) || 0) - (parseFloat(a.value) || 0));
        store.updateCurrencyPerformance(currencyPerformance, { silent: true });
        renderCurrencyMatrixList();
        renderArbitrageBanner();
    });

    // 1. Hook up Fear & Greed Index Events
    const fngValInput = container.querySelector('#fng-value-input');
    const fngClassSelect = container.querySelector('#fng-classification-select');
    const fetchFngBtn = container.querySelector('#fetch-fng-btn');

    const updateFngState = () => {
        const val = parseInt(fngValInput.value) || 50;
        const classification = fngClassSelect.value;
        store.updateFearGreed(val, classification, { silent: true });
    };

    fngValInput.addEventListener('input', updateFngState);
    fngClassSelect.addEventListener('change', updateFngState);

    fetchFngBtn.addEventListener('click', async () => {
        fetchFngBtn.innerText = 'Connexion API... 🔄';
        fetchFngBtn.disabled = true;
        try {
            const res = await fetch('https://api.alternative.me/fng/');
            const data = await res.json();
            if (data && data.data && data.data[0]) {
                const val = parseInt(data.data[0].value) || 50;
                const classification = data.data[0].value_classification;
                fngValInput.value = val;
                fngClassSelect.value = classification;
                store.updateFearGreed(val, classification, { silent: true });
                showAppToast(`Fear & Greed Index actualisé : ${val} (${classification})`);
            }
        } catch (e) {
            showAppToast("Impossible de récupérer l'indice Fear & Greed.", false);
        } finally {
            fetchFngBtn.innerText = 'Actualiser via API Live 🔄';
            fetchFngBtn.disabled = false;
        }
    });

    // 2. Hook up Central Bank Stance Events
    const stanceSelects = container.querySelectorAll('.bank-stance-select');
    const updateBankSelectStyle = (select) => {
        if (select.value === 'Restrictif') {
            select.style.color = 'var(--color-loss)';
            select.style.borderColor = 'var(--color-loss)';
            select.style.backgroundColor = 'var(--color-loss-transparent)';
        } else if (select.value === 'Accommodant') {
            select.style.color = 'var(--color-win)';
            select.style.borderColor = 'var(--color-win)';
            select.style.backgroundColor = 'var(--color-win-transparent)';
        } else {
            select.style.color = 'var(--text-secondary)';
            select.style.borderColor = 'var(--border-color)';
            select.style.backgroundColor = 'var(--bg-secondary)';
        }
    };

    stanceSelects.forEach(select => {
        updateBankSelectStyle(select);
        select.addEventListener('change', (e) => {
            const index = parseInt(e.target.closest('.bank-row').getAttribute('data-index'));
            centralBanks[index].stance = e.target.value;
            store.updateCentralBanks(centralBanks, { silent: true });
            updateBankSelectStyle(e.target);
        });
    });

    function updateSelectColor(select) {
        if (select.value === 'Bullish') {
            select.style.color = 'var(--color-win)';
            select.style.borderColor = 'var(--color-win)';
            select.style.backgroundColor = 'var(--color-win-transparent)';
        } else if (select.value === 'Bearish') {
            select.style.color = 'var(--color-loss)';
            select.style.borderColor = 'var(--color-loss)';
            select.style.backgroundColor = 'var(--color-loss-transparent)';
        } else {
            select.style.color = 'var(--text-secondary)';
            select.style.borderColor = 'var(--border-color)';
            select.style.backgroundColor = 'var(--bg-secondary)';
        }
    }

    const syncStatusEl = container.querySelector('#watchlist-sync-status');

    function updateLocalWatchlistFromDOM() {
        const cards = container.querySelectorAll('.watchlist-card');
        localWatchlist = Array.from(cards).map(card => ({
            ticker: card.getAttribute('data-ticker'),
            dailyBias: card.querySelector('.daily-bias-select').value,
            fourHourBias: card.querySelector('.fourhour-bias-select').value,
            keyLevel: card.querySelector('.trigger-level-input').value,
            invalidation: card.querySelector('.sl-level-input').value,
            notes: card.querySelector('.notes-textarea').value
        }));
    }

    function scheduleWatchlistAutoSave(immediate = false) {
        if (watchlistSaveTimer) clearTimeout(watchlistSaveTimer);

        if (syncStatusEl) {
            syncStatusEl.textContent = '⏳ Sync en cours...';
            syncStatusEl.style.color = 'var(--color-accent)';
        }

        const commitSave = () => {
            store.updateWatchlist(localWatchlist, { silent: true });
            if (syncStatusEl) {
                syncStatusEl.textContent = '✓ Auto-Sync Cloud (500ms)';
                syncStatusEl.style.color = 'var(--color-win)';
            }
        };

        if (immediate) {
            commitSave();
        } else {
            watchlistSaveTimer = setTimeout(commitSave, 500);
        }
    }

    // Render Active OPEN Positions with "[ 🏁 Clôturer le trade ]" button
    function renderActiveTrades() {
        const activeListContainer = container.querySelector('#active-trades-list');
        if (!activeListContainer) return;
        
        if (openTrades.length === 0) {
            activeListContainer.innerHTML = `
                <div style="padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--border-radius-md); color: var(--text-secondary); font-size: 0.88rem; grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid var(--border-color);">
                    <span>Aucune position active (OPEN) sur le desk actuellement. Armez un setup ci-dessous ou ouvrez un ordre MT5.</span>
                    <button type="button" id="empty-open-new-trade-btn" style="background: rgba(0, 191, 165, 0.15); color: var(--color-accent); border: 1px solid rgba(0, 191, 165, 0.35); padding: 6px 14px; font-size: 0.8rem; font-weight: 700; border-radius: 6px; cursor: pointer;">
                        + Calculateur MT5 & Entrée
                    </button>
                </div>
            `;
            const goEntryBtn = activeListContainer.querySelector('#empty-open-new-trade-btn');
            if (goEntryBtn) {
                goEntryBtn.addEventListener('click', () => store.setActiveView('entry'));
            }
            return;
        }
        
        activeListContainer.innerHTML = openTrades.map((trade, idx) => {
            const isLong = trade.direction === 'Long';
            const entryFormatted = trade.entryDate
                ? new Date(trade.entryDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—';
            const riskUsd = Number(trade.risk || 0).toFixed(2);
            const riskPct = Number(trade.riskPct || 1).toFixed(2);

            return `
                <div class="active-trade-item" data-open-idx="${idx}">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 6px; background-color: var(--color-win-transparent); color: var(--color-win); font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">
                                <span class="glow-dot"></span> OPEN
                            </span>
                            <span style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary);">${trade.ticker}</span>
                            <span style="font-size: 0.74rem; color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);">${trade.timeFrame || '1H'}</span>
                        </div>
                        <span class="${isLong ? 'text-win' : 'text-loss'}" style="font-weight: 800; font-size: 0.82rem; padding: 3px 10px; border-radius: 6px; background: ${isLong ? 'var(--color-win-transparent)' : 'var(--color-loss-transparent)'};">
                            ${trade.direction} ${trade.lotSize ? `• ${trade.lotSize} Lots` : ''}
                        </span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 0.78rem;">
                        <div>
                            <span style="font-size: 0.68rem; color: var(--text-secondary); display: block;">Ouverture</span>
                            <span style="font-weight: 600; color: var(--text-primary);">${entryFormatted}</span>
                        </div>
                        <div>
                            <span style="font-size: 0.68rem; color: var(--text-secondary); display: block;">Prix Entrée</span>
                            <span class="mono-text" style="font-weight: 700; color: var(--text-primary);">${trade.entryPrice != null ? trade.entryPrice : '—'}</span>
                        </div>
                        <div>
                            <span style="font-size: 0.68rem; color: var(--text-secondary); display: block;">Stop-Loss</span>
                            <span class="mono-text" style="font-weight: 700; color: var(--color-loss);">${trade.stopLoss != null ? trade.stopLoss : '—'}</span>
                        </div>
                        <div>
                            <span style="font-size: 0.68rem; color: var(--text-secondary); display: block;">Risque</span>
                            <span class="mono-text" style="font-weight: 700; color: var(--text-primary);">$${riskUsd} (${riskPct}%)</span>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.04);">
                        <span style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${trade.strategy || 'Setup'} • ${trade.environment || 'Live'}
                        </span>
                        <button type="button" class="close-open-trade-btn" data-open-idx="${idx}" style="background: var(--color-win); color: #052623; padding: 6px 14px; font-size: 0.8rem; font-weight: 800; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 230, 118, 0.25);">
                            🏁 Clôturer le trade
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        activeListContainer.querySelectorAll('.close-open-trade-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-open-idx'));
                const tradeToClose = openTrades[idx];
                if (tradeToClose) {
                    openCloseTradeModal(tradeToClose);
                }
            });
        });
    }

    // Render Actionable Watchlist Cards (Pair, D1 Bias, H4 Bias, Trigger Zone, Forecast SL, Fundamental Catalyst, [ ⚡ Armer ce Setup ])
    function renderWatchlist() {
        const listContainer = container.querySelector('#watchlist-items-container');
        const countBadge = container.querySelector('#watchlist-count-badge');
        if (countBadge) {
            countBadge.textContent = String(localWatchlist.length);
        }
        if (!listContainer) return;
        
        if (localWatchlist.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-watchlist" style="text-align: center; padding: var(--spacing-xl); background: var(--bg-tertiary); border: 1px dashed var(--border-color); border-radius: var(--border-radius-md); color: var(--text-secondary); grid-column: 1 / -1; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                    <span>Aucune paire dans le sas de tir Watchlist. Importez directement vos paires clés depuis le Rapport Hebdo ou ajoutez une paire manuellement ci-dessus.</span>
                    <button type="button" id="empty-import-report-watchlist-btn" style="background: rgba(0, 191, 165, 0.16); color: var(--color-accent); border: 1px solid rgba(0, 191, 165, 0.45); padding: 8px 16px; font-size: 0.84rem; font-weight: 800; border-radius: var(--border-radius-sm); cursor: pointer;">
                        📥 Importer la Watchlist du Rapport Hebdo
                    </button>
                </div>
            `;
            const emptyImportBtn = listContainer.querySelector('#empty-import-report-watchlist-btn');
            if (emptyImportBtn) {
                emptyImportBtn.addEventListener('click', () => importWatchlistFromWeeklyReport());
            }
            return;
        }
        
        listContainer.innerHTML = localWatchlist.map(item => `
            <div class="watchlist-card" data-ticker="${item.ticker}">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; gap: 8px;">
                    <h4 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin: 0;">${item.ticker}</h4>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button type="button" class="arm-trade-btn" data-ticker="${item.ticker}" style="background: var(--color-accent); color: #052623; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; display: flex; align-items: center; gap: 5px; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 191, 165, 0.25);">
                            ⚡ Armer ce Setup
                        </button>
                        <button type="button" class="remove-watchlist-btn" data-ticker="${item.ticker}" style="background: transparent; padding: 5px 8px; color: var(--color-loss); border: 1px solid var(--color-loss-transparent); border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer;" title="Retirer de la Watchlist">
                            ✕
                        </button>
                    </div>
                </div>

                <!-- Row 1: D1 Bias & H4 Bias -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Biais D1</label>
                        <select class="daily-bias-select" style="width: 100%; border: 1px solid var(--border-color); border-radius: 6px; font-weight: 700; padding: 7px 10px; font-size: 0.82rem; cursor: pointer;">
                            <option value="Neutral" ${item.dailyBias === 'Neutral' ? 'selected' : ''}>Neutral 🟡</option>
                            <option value="Bullish" ${item.dailyBias === 'Bullish' ? 'selected' : ''}>Bullish 🟢</option>
                            <option value="Bearish" ${item.dailyBias === 'Bearish' ? 'selected' : ''}>Bearish 🔴</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Biais H4</label>
                        <select class="fourhour-bias-select" style="width: 100%; border: 1px solid var(--border-color); border-radius: 6px; font-weight: 700; padding: 7px 10px; font-size: 0.82rem; cursor: pointer;">
                            <option value="Neutral" ${item.fourHourBias === 'Neutral' ? 'selected' : ''}>Neutral 🟡</option>
                            <option value="Bullish" ${item.fourHourBias === 'Bullish' ? 'selected' : ''}>Bullish 🟢</option>
                            <option value="Bearish" ${item.fourHourBias === 'Bearish' ? 'selected' : ''}>Bearish 🔴</option>
                        </select>
                    </div>
                </div>

                <!-- Row 2: Trigger Zone (Entry Price) & Forecast Stop-Loss -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Zone Trigger / Prix Entrée</label>
                        <input type="text" class="trigger-level-input mono-text" value="${item.keyLevel || ''}" placeholder="ex: 1.0850" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 0.82rem; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; font-weight: 700;" />
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Stop-Loss Prévisionnel</label>
                        <input type="text" class="sl-level-input mono-text" value="${item.invalidation || ''}" placeholder="ex: 1.0815" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 0.82rem; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--color-loss); border-radius: 6px; font-weight: 700;" />
                    </div>
                </div>

                <!-- Row 3: Fundamental Catalyst -->
                <div>
                    <label style="display: block; font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; font-weight: 700;">Catalyseur Fondamental & Plan</label>
                    <textarea class="notes-textarea" rows="2" placeholder="Divergence banque centrale, CPI attendu, structure HTF..." style="width: 100%; resize: vertical; box-sizing: border-box; font-size: 0.84rem; padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">${item.notes || ''}</textarea>
                </div>
            </div>
        `).join('');
        
        listContainer.querySelectorAll('select').forEach(select => {
            updateSelectColor(select);
            select.addEventListener('change', (e) => {
                updateSelectColor(e.target);
                updateLocalWatchlistFromDOM();
                scheduleWatchlistAutoSave();
            });
        });

        listContainer.querySelectorAll('input, textarea').forEach(el => {
            el.addEventListener('input', () => {
                updateLocalWatchlistFromDOM();
                scheduleWatchlistAutoSave();
            });
        });

        listContainer.querySelectorAll('.remove-watchlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ticker = e.currentTarget.getAttribute('data-ticker');
                localWatchlist = localWatchlist.filter(item => item.ticker !== ticker);
                renderWatchlist();
                scheduleWatchlistAutoSave(true);
            });
        });

        // Direct Action: "[ ⚡ Armer ce Setup ]" -> Trade Entry with Ticker, Direction & Stop-Loss prefilled
        listContainer.querySelectorAll('.arm-trade-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                updateLocalWatchlistFromDOM();
                scheduleWatchlistAutoSave(true);

                const ticker = e.currentTarget.getAttribute('data-ticker');
                const item = localWatchlist.find(w => w.ticker === ticker);
                if (!item) return;

                let suggestedDirection = 'Long';
                if (item.dailyBias === 'Bearish' || (item.dailyBias === 'Neutral' && item.fourHourBias === 'Bearish')) {
                    suggestedDirection = 'Short';
                } else if (item.dailyBias === 'Bullish' || (item.dailyBias === 'Neutral' && item.fourHourBias === 'Bullish')) {
                    suggestedDirection = 'Long';
                }

                store.armTradeSetup({
                    ticker: item.ticker,
                    direction: suggestedDirection,
                    dailyBias: item.dailyBias,
                    fourHourBias: item.fourHourBias,
                    keyLevel: item.keyLevel || '',
                    invalidation: item.invalidation || '',
                    notes: item.notes || ''
                });
            });
        });
    }

    // Bridge: Import Watchlist from Weekly Report (fonda_session_v1 / report_state / Cloud report_state)
    const importReportWatchlistBtn = container.querySelector('#import-report-watchlist-btn');

    async function importWatchlistFromWeeklyReport() {
        updateLocalWatchlistFromDOM();
        if (importReportWatchlistBtn) {
            importReportWatchlistBtn.disabled = true;
            importReportWatchlistBtn.textContent = '⏳ Import du Rapport Hebdo...';
        }

        try {
            const candidateKeys = [
                'fonda_session_v1',
                'sixnueve-report-session-v1',
                'sixnueve-report-session-backup',
                'sixnueve-report-editor-session-v2',
                'report_state'
            ];

            let extractedItems = [];

            for (const key of candidateKeys) {
                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) continue;
                    const parsed = JSON.parse(raw);
                    const candidate = convertReportSessionToWatchlist(parsed);
                    // Ensure it's not just the blank 1-card unedited template
                    const isBlankTemplate = candidate.length === 1 && candidate[0].ticker === 'EUR/USD' && !parsed?.fields?.['wc-fund-0'];
                    if (candidate.length > 0 && !isBlankTemplate) {
                        extractedItems = candidate;
                        break;
                    }
                } catch (e) {
                    console.warn(`[MacroDashboard] Lecture ${key} ignorée:`, e);
                }
            }

            // If localStorage didn't have the report session yet, query Supabase public.report_state
            if (extractedItems.length === 0) {
                const cloudReportData = await supabaseService.fetchCloudReportState();
                if (cloudReportData) {
                    try {
                        localStorage.setItem('fonda_session_v1', JSON.stringify(cloudReportData));
                    } catch (e) {}
                    const cloudCandidate = convertReportSessionToWatchlist(cloudReportData);
                    if (cloudCandidate.length > 0) {
                        extractedItems = cloudCandidate;
                    }
                }
            }

            // Fallback to the 6 key pairs from the Weekly Report if no session was found in storage
            if (extractedItems.length === 0) {
                extractedItems = DEFAULT_WEEKLY_REPORT_WATCHLIST.map(item => ({ ...item }));
            }

            // Merge/inject into localWatchlist (update existing tickers or append new ones)
            let addedCount = 0;
            let updatedCount = 0;

            extractedItems.forEach(imported => {
                const existingIdx = localWatchlist.findIndex(w => w.ticker === imported.ticker);
                if (existingIdx !== -1) {
                    localWatchlist[existingIdx] = {
                        ...localWatchlist[existingIdx],
                        dailyBias: imported.dailyBias || localWatchlist[existingIdx].dailyBias,
                        fourHourBias: imported.fourHourBias || imported.dailyBias || localWatchlist[existingIdx].fourHourBias,
                        keyLevel: imported.keyLevel || localWatchlist[existingIdx].keyLevel || '',
                        invalidation: imported.invalidation || localWatchlist[existingIdx].invalidation || '',
                        notes: imported.notes || localWatchlist[existingIdx].notes || ''
                    };
                    updatedCount++;
                } else {
                    localWatchlist.push({
                        ticker: imported.ticker,
                        dailyBias: imported.dailyBias || 'Neutral',
                        fourHourBias: imported.fourHourBias || imported.dailyBias || 'Neutral',
                        keyLevel: imported.keyLevel || '',
                        invalidation: imported.invalidation || '',
                        notes: imported.notes || ''
                    });
                    addedCount++;
                }
            });

            renderWatchlist();
            scheduleWatchlistAutoSave(true);

            const tickersList = extractedItems.map(i => i.ticker).join(', ');
            showAppToast(`Watchlist Hebdo importée (${addedCount} ajoutées, ${updatedCount} mises à jour) : ${tickersList}`);
        } catch (err) {
            console.error('[MacroDashboard] Erreur import Watchlist Rapport Hebdo:', err);
            showAppToast("Erreur lors de l'import de la Watchlist du Rapport Hebdo.", false);
        } finally {
            if (importReportWatchlistBtn) {
                importReportWatchlistBtn.disabled = false;
                importReportWatchlistBtn.textContent = '📥 Importer la Watchlist du Rapport Hebdo';
            }
        }
    }

    if (importReportWatchlistBtn) {
        importReportWatchlistBtn.addEventListener('click', () => {
            importWatchlistFromWeeklyReport();
        });
    }

    const newTickerInput = container.querySelector('#new-ticker-input');
    const addTickerBtn = container.querySelector('#add-ticker-btn');
    
    addTickerBtn.addEventListener('click', () => {
        updateLocalWatchlistFromDOM();
        let ticker = newTickerInput.value.trim().toUpperCase();
        if (!ticker) {
            showAppToast('Veuillez entrer une paire (ex: EUR/USD).', false);
            return;
        }
        
        if (ticker.length === 6 && !ticker.includes('/')) {
            ticker = ticker.slice(0, 3) + '/' + ticker.slice(3);
        }
        
        if (localWatchlist.some(item => item.ticker === ticker)) {
            showAppToast(`${ticker} est déjà dans la Watchlist.`, false);
            return;
        }
        
        localWatchlist.push({
            ticker,
            dailyBias: 'Neutral',
            fourHourBias: 'Neutral',
            keyLevel: '',
            invalidation: '',
            notes: ''
        });
        
        newTickerInput.value = '';
        renderWatchlist();
        scheduleWatchlistAutoSave(true);
    });

    newTickerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addTickerBtn.click();
        }
    });

        renderArbitrageBanner();
        renderCurrencyMatrixList();
        renderActiveTrades();
        renderWatchlist();
    } catch (err) {
        console.error('[MacroDashboard] Erreur critique lors du montage de renderMacroDashboard :', err, err?.stack);
        container.innerHTML = `
            <div class="card" style="border: 1px solid var(--color-loss); background: rgba(255, 82, 82, 0.08); padding: 24px;">
                <h3 style="color: var(--color-loss); margin-bottom: 8px;">⚠️ Erreur d'affichage — Macro Insights</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 12px;">Une exception JavaScript a été interceptée lors du montage du module Macro Insights :</p>
                <pre class="mono-text" style="background: #09090b; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); color: var(--color-loss); font-size: 0.8rem; overflow-x: auto;">${err?.message || String(err)}</pre>
            </div>
        `;
    }

    return container;
}

