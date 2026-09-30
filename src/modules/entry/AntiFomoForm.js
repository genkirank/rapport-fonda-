import { store } from '../../state/store.js';
import {
    processTradeRecord,
    computeMacroAlignment,
    calculateMt5LotSize
} from '../../utils/calculations.js';
import { showAppToast } from './CloseTradeModal.js';

export function renderAntiFomoForm(state) {
    const container = document.createElement('div');
    container.className = 'anti-fomo-dashboard';
    
    const watchlist = state.watchlist || [];
    const pendingSetup = store.consumePendingTradeSetup();
    const defaultBalance = store.getCurrentBalance();

    const nowLocalISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

    let activeMacroContext = {
        dailyBias: 'Non défini',
        fourHourBias: 'Non défini',
        notes: ''
    };

    const getBiasBadge = (bias) => {
        if (bias === 'Bullish') return '<span style="color: var(--color-win); font-weight: 700;">🟢 Bullish</span>';
        if (bias === 'Bearish') return '<span style="color: var(--color-loss); font-weight: 700;">🔴 Bearish</span>';
        if (bias === 'Neutral') return '<span style="color: var(--text-secondary); font-weight: 600;">🟡 Neutral</span>';
        return '<span style="color: var(--text-muted);">Non défini</span>';
    };

    container.innerHTML = `
        <div class="card-header" style="margin-bottom: var(--spacing-md); flex-wrap: wrap; gap: 12px;">
            <div>
                <h2>Trade Entry & Calculateur d'Ordre MT5</h2>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">Dimensionnement de lot en temps réel, alignement macro et ouverture de position (OPEN).</p>
            </div>
        </div>
        
        <!-- Watchlist Quick Arming Banner -->
        ${watchlist.length > 0 ? `
            <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 12px 16px; margin-bottom: var(--spacing-lg); display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <span style="font-size: 0.78rem; font-weight: 800; color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.05em;">
                    ⚡ Setups Watchlist :
                </span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="watchlist-quick-chips">
                    ${watchlist.map(item => `
                        <button type="button" class="watchlist-quick-chip" data-ticker="${item.ticker}" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 999px; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 6px; color: var(--text-primary);">
                            <span style="font-weight: 800;">${item.ticker}</span>
                            <span style="font-size: 0.72rem; color: var(--text-secondary);">D1 ${item.dailyBias === 'Bullish' ? '🟢' : (item.dailyBias === 'Bearish' ? '🔴' : '🟡')} / H4 ${item.fourHourBias === 'Bullish' ? '🟢' : (item.fourHourBias === 'Bearish' ? '🔴' : '🟡')}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        <!-- MT5 LIVE LOT CALCULATOR HERO BANNER -->
        <div class="card" style="margin-bottom: var(--spacing-lg); background: linear-gradient(135deg, rgba(0, 230, 118, 0.08) 0%, rgba(18, 19, 22, 0.98) 100%); border: 1px solid rgba(0, 230, 118, 0.35); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
                <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-win); font-weight: 800;">Calculateur de Taille de Lot MT5 en Direct</span>
                <div id="mt5-lot-hero-display" class="mono-text" style="font-size: 1.75rem; font-weight: 800; color: #ffffff; margin-top: 4px;">
                    👉 Ordre MT5 : <span style="color: var(--color-win);" id="mt5-lot-value">0.00 Lots</span>
                </div>
                <div id="mt5-calc-breakdown" style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                    Renseignez le Prix d'Entrée et le Stop-Loss pour calculer automatiquement la distance en Pips et le volume MT5.
                </div>
            </div>

            <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
                <div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 14px; text-align: center; min-width: 110px;">
                    <span style="font-size: 0.7rem; color: var(--text-secondary); display: block; text-transform: uppercase;">Distance SL</span>
                    <strong id="mt5-pips-badge" class="mono-text" style="font-size: 1.05rem; color: var(--text-primary);">0.0 Pips</strong>
                </div>
                <div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 14px; text-align: center; min-width: 110px;">
                    <span style="font-size: 0.7rem; color: var(--text-secondary); display: block; text-transform: uppercase;">Risque ($)</span>
                    <strong id="mt5-risk-usd-badge" class="mono-text" style="font-size: 1.05rem; color: var(--color-loss);">$100.00</strong>
                </div>
                <div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 14px; text-align: center; min-width: 110px;">
                    <span style="font-size: 0.7rem; color: var(--text-secondary); display: block; text-transform: uppercase;">Ratio R:R</span>
                    <strong id="mt5-rr-badge" class="mono-text" style="font-size: 1.05rem; color: var(--color-accent);">—</strong>
                </div>
            </div>
        </div>

        <form id="trade-form" style="display: flex; gap: var(--spacing-lg); flex-wrap: wrap; align-items: flex-start;">
            <!-- Left Column: Capital, Risk Sizing & Discipline -->
            <div class="card" style="flex: 1; min-width: 310px; display: flex; flex-direction: column; gap: var(--spacing-md);">
                <h3 style="margin-bottom: 2px;">1. Capital, Risque & Discipline</h3>

                <div>
                    <label style="display:block; margin-bottom: 6px; font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">Balance du Compte ($)</label>
                    <input type="number" id="account-balance" step="1" value="${defaultBalance}" required style="width: 100%; box-sizing: border-box; font-family: var(--font-mono); font-weight: 800; color: var(--color-win);" />
                </div>

                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <label style="font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">Risque Souhaité *</label>
                        <div style="display: flex; gap: 4px;">
                            <button type="button" class="quick-risk-pct" data-pct="0.5" style="padding: 2px 8px; font-size: 0.72rem; background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: 4px;">0.5%</button>
                            <button type="button" class="quick-risk-pct" data-pct="1.0" style="padding: 2px 8px; font-size: 0.72rem; background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: 4px;">1%</button>
                            <button type="button" class="quick-risk-pct" data-pct="2.0" style="padding: 2px 8px; font-size: 0.72rem; background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: 4px;">2%</button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <input type="number" id="risk" required min="0.01" step="0.01" value="1.0" style="flex: 1; box-sizing: border-box; font-family: var(--font-mono); font-weight: 800;">
                        <select id="risk-unit" style="width: 80px; font-weight: 800; text-align: center; padding: 8px;">
                            <option value="%" selected>%</option>
                            <option value="$">$</option>
                        </select>
                    </div>
                    <span id="risk-computed-hint" class="mono-text" style="display: block; margin-top: 6px; font-size: 0.76rem; color: var(--color-accent);"></span>
                </div>

                <div>
                    <label style="display:block; margin-bottom: 6px; font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">Environnement & Session</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <select id="env-type" style="width: 100%; font-weight: 600;">
                            <option value="Live">Live 🔴</option>
                            <option value="Demo">Demo 🟡</option>
                            <option value="Backtest">Backtest 🧪</option>
                        </select>
                        <select id="session" style="width: 100%; font-weight: 600;">
                            <option value="London">London</option>
                            <option value="NY Morning">NY Morning</option>
                            <option value="NY Afternoon">NY Afternoon</option>
                            <option value="Asia">Asia</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; margin-bottom: 6px; font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">Stratégie / Setup & Qualité</label>
                    <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 8px;">
                        <select id="strategy-selector" style="width: 100%;">
                            <option value="Trend Continuation">Trend Continuation</option>
                            <option value="Supply & Demand Zone">Supply & Demand Zone</option>
                            <option value="Liquidity Sweep / SFP">Liquidity Sweep / SFP</option>
                            <option value="Breakout & Retest">Breakout & Retest</option>
                            <option value="Range Fade / Reversal">Range Fade / Reversal</option>
                            <option value="News Catalyst">News Catalyst</option>
                            <option value="Autre / Custom">Autre / Custom</option>
                        </select>
                        <select id="grade" style="width: 100%;">
                            <option value="Setup A+ (Parfait)">A+ (Parfait)</option>
                            <option value="Setup B (Moyen)">B (Moyen)</option>
                            <option value="Setup C (Forcé)">C (Forcé)</option>
                        </select>
                    </div>
                </div>

                <!-- Single Toggle: Respect du plan : Oui / Non -->
                <div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 12px 14px; border-radius: var(--border-radius-md); display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">Respect du plan :</span>
                    <input type="hidden" id="rules-respected-input" value="true">
                    <div style="display: inline-flex; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 3px; gap: 4px;">
                        <button type="button" id="rules-btn-yes" style="padding: 5px 14px; border-radius: 6px; font-size: 0.82rem; font-weight: 800; background: var(--color-win); color: #052623;">Oui</button>
                        <button type="button" id="rules-btn-no" style="padding: 5px 14px; border-radius: 6px; font-size: 0.82rem; font-weight: 800; background: transparent; color: var(--text-secondary);">Non</button>
                    </div>
                </div>

                <!-- Macro Watchlist Context Card -->
                <div id="macro-context-card" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 12px 14px; border-radius: var(--border-radius-md); display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-accent); font-weight: 800;">Contexte Watchlist Macro</span>
                        <span id="macro-alignment-pill" style="font-size: 0.75rem; font-weight: 800;"></span>
                    </div>
                    <div id="macro-context-details" style="font-size: 0.82rem; color: var(--text-secondary);">
                        Sélectionnez une paire de la Watchlist pour importer automatiquement son biais et ses niveaux.
                    </div>
                </div>
            </div>

            <!-- Right Column: MT5 Order Parameters (OPEN Position) -->
            <div class="card" style="flex: 1.8; min-width: 400px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
                    <h3 style="margin: 0;">2. Paramètres d'Exécution MT5 (OPEN)</h3>
                    <span style="font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 999px; background: rgba(0, 230, 118, 0.12); color: var(--color-win); border: 1px solid rgba(0, 230, 118, 0.3);">
                        ● Statut : OPEN
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                    <!-- Row 1: Ticker & Entry Date -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label style="font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">Ticker / Paire *</label>
                            <div id="live-macro-bias-tag" style="font-size: 0.72rem;"></div>
                        </div>
                        <input type="text" id="ticker" placeholder="EUR/USD, USD/JPY, XAU/USD..." required style="width: 100%; text-transform: uppercase; box-sizing: border-box; font-weight: 800;">
                    </div>

                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">Date & Heure d'Entrée *</label>
                        <input type="datetime-local" id="entry-date" required value="${nowLocalISO}" style="width: 100%; box-sizing: border-box;">
                    </div>

                    <!-- Row 2: Direction & Timeframe (15m, 1H, 4H, Daily) -->
                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">Sens de l'Ordre *</label>
                        <select id="direction" style="width: 100%; font-weight: 800;">
                            <option value="Long">Long (Buy) 🟢</option>
                            <option value="Short">Short (Sell) 🔴</option>
                        </select>
                    </div>

                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">Timeframe *</label>
                        <select id="timeframe" style="width: 100%; font-weight: 700;">
                            <option value="15m">15m</option>
                            <option value="1H" selected>1H</option>
                            <option value="4H">4H</option>
                            <option value="Daily">Daily</option>
                        </select>
                    </div>

                    <!-- Row 3: Entry Price & Stop-Loss Price -->
                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">Prix d'Entrée Prévu *</label>
                        <input type="number" id="entry-price" step="any" required placeholder="Ex: 1.08500" style="width: 100%; box-sizing: border-box; font-family: var(--font-mono); font-weight: 700;">
                    </div>

                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.82rem; color: var(--color-loss); font-weight: 700;">Prix du Stop-Loss *</label>
                        <input type="number" id="stop-loss" step="any" required placeholder="Ex: 1.08200" style="width: 100%; box-sizing: border-box; font-family: var(--font-mono); font-weight: 700; border-color: rgba(255, 82, 82, 0.4);">
                    </div>

                    <!-- Row 4: Take-Profit Price & Calculated MT5 Lot Size -->
                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.82rem; color: var(--color-win); font-weight: 700;">Prix du Take-Profit (Optionnel)</label>
                        <input type="number" id="take-profit" step="any" placeholder="Ex: 1.09250" style="width: 100%; box-sizing: border-box; font-family: var(--font-mono); font-weight: 700;">
                    </div>

                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.82rem; color: var(--color-accent); font-weight: 700;">Taille de Lot Calculée (MT5)</label>
                        <input type="number" id="lot-size" step="0.01" placeholder="Auto-calculé" style="width: 100%; box-sizing: border-box; font-family: var(--font-mono); font-weight: 800; color: var(--color-win); background: var(--bg-tertiary);">
                    </div>

                    <div style="grid-column: 1 / -1; margin-top: var(--spacing-sm); padding-top: var(--spacing-md); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
                        <button type="submit" id="submit-trade" style="background-color: var(--color-win); color: #052623; padding: 13px 28px; font-size: 0.96rem; font-weight: 800; border-radius: var(--border-radius-sm); box-shadow: 0 6px 20px rgba(0, 230, 118, 0.3); cursor: pointer;">
                            🚀 Enregistrer la Position Ouverte (OPEN)
                        </button>
                    </div>
                </div>
            </div>
        </form>
    `;

    // Form Elements
    const form = container.querySelector('#trade-form');
    const balanceInput = container.querySelector('#account-balance');
    const riskInput = container.querySelector('#risk');
    const riskUnitSelect = container.querySelector('#risk-unit');
    const riskHint = container.querySelector('#risk-computed-hint');
    const envSelector = container.querySelector('#env-type');
    const strategySelector = container.querySelector('#strategy-selector');
    const tickerInput = container.querySelector('#ticker');
    const directionSelect = container.querySelector('#direction');
    const entryPriceInput = container.querySelector('#entry-price');
    const stopLossInput = container.querySelector('#stop-loss');
    const takeProfitInput = container.querySelector('#take-profit');
    const lotSizeInput = container.querySelector('#lot-size');

    // MT5 Hero Display Elements
    const mt5LotValEl = container.querySelector('#mt5-lot-value');
    const mt5BreakdownEl = container.querySelector('#mt5-calc-breakdown');
    const mt5PipsBadge = container.querySelector('#mt5-pips-badge');
    const mt5RiskUsdBadge = container.querySelector('#mt5-risk-usd-badge');
    const mt5RrBadge = container.querySelector('#mt5-rr-badge');

    // Macro Context Elements
    const macroBiasTag = container.querySelector('#live-macro-bias-tag');
    const macroContextDetails = container.querySelector('#macro-context-details');
    const macroAlignmentPill = container.querySelector('#macro-alignment-pill');

    // Rules Toggle
    const rulesInput = container.querySelector('#rules-respected-input');
    const rulesBtnYes = container.querySelector('#rules-btn-yes');
    const rulesBtnNo = container.querySelector('#rules-btn-no');

    function setRulesRespected(val) {
        const isYes = Boolean(val);
        rulesInput.value = isYes ? 'true' : 'false';
        if (isYes) {
            rulesBtnYes.style.background = 'var(--color-win)';
            rulesBtnYes.style.color = '#052623';
            rulesBtnNo.style.background = 'transparent';
            rulesBtnNo.style.color = 'var(--text-secondary)';
        } else {
            rulesBtnNo.style.background = 'var(--color-loss)';
            rulesBtnNo.style.color = '#ffffff';
            rulesBtnYes.style.background = 'transparent';
            rulesBtnYes.style.color = 'var(--text-secondary)';
        }
    }
    rulesBtnYes.addEventListener('click', () => setRulesRespected(true));
    rulesBtnNo.addEventListener('click', () => setRulesRespected(false));

    // Quick Risk % buttons
    container.querySelectorAll('.quick-risk-pct').forEach(btn => {
        btn.addEventListener('click', () => {
            riskUnitSelect.value = '%';
            riskInput.value = btn.getAttribute('data-pct');
            recomputeMt5Calculator();
        });
    });

    // Live MT5 Position Sizing Engine
    function recomputeMt5Calculator() {
        const bal = parseFloat(balanceInput.value) || 10000;
        const rawRisk = parseFloat(riskInput.value) || 0;
        const unit = riskUnitSelect.value;

        let riskUsd = 0;
        let riskPct = 0;
        if (unit === '%') {
            riskPct = rawRisk;
            riskUsd = (bal * riskPct) / 100;
            riskHint.textContent = `Équivalent monétaire : $${riskUsd.toFixed(2)} (${riskPct.toFixed(2)}%)`;
        } else {
            riskUsd = rawRisk;
            riskPct = bal > 0 ? (riskUsd / bal) * 100 : 0;
            riskHint.textContent = `Équivalent relatif : ${riskPct.toFixed(2)}% du capital ($${riskUsd.toFixed(2)})`;
        }

        mt5RiskUsdBadge.textContent = `$${riskUsd.toFixed(2)}`;

        const sizing = calculateMt5LotSize({
            ticker: tickerInput.value || 'EUR/USD',
            entryPrice: entryPriceInput.value,
            stopLoss: stopLossInput.value,
            takeProfit: takeProfitInput.value,
            riskUsd
        });

        if (sizing.valid) {
            mt5LotValEl.textContent = `${sizing.lots.toFixed(2)} Lots`;
            mt5PipsBadge.textContent = `${sizing.pips} Pips`;
            mt5RrBadge.textContent = sizing.rrRatio != null ? `1 : ${sizing.rrRatio} R` : '—';
            mt5BreakdownEl.textContent = `Formule MT5 : $${riskUsd.toFixed(2)} / (${sizing.pips} Pips × $${sizing.pipValuePerLot}/pip) = ${sizing.rawLots} lots`;
            lotSizeInput.value = sizing.lots.toFixed(2);
        } else {
            mt5LotValEl.textContent = '0.00 Lots';
            mt5PipsBadge.textContent = '0.0 Pips';
            mt5RrBadge.textContent = '—';
            mt5BreakdownEl.textContent = 'Renseignez le Prix d\'Entrée et le Stop-Loss pour calculer automatiquement la distance en Pips et le volume MT5.';
        }
    }

    [balanceInput, riskInput, riskUnitSelect, tickerInput, entryPriceInput, stopLossInput, takeProfitInput].forEach(el => {
        el.addEventListener('input', recomputeMt5Calculator);
        el.addEventListener('change', recomputeMt5Calculator);
    });

    // Check and display live macro bias + prefill Trigger/SL if requested
    function syncTickerBias(tickerVal, autoPrefillSetup = false) {
        const cleaned = String(tickerVal || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!cleaned) {
            activeMacroContext = { dailyBias: 'Non défini', fourHourBias: 'Non défini', notes: '' };
            if (macroBiasTag) macroBiasTag.innerHTML = '';
            if (macroAlignmentPill) macroAlignmentPill.innerHTML = '';
            if (macroContextDetails) macroContextDetails.innerHTML = 'Sélectionnez une paire de la Watchlist pour importer automatiquement son biais et ses niveaux.';
            return;
        }
        
        const safeWatchlist = Array.isArray(watchlist) ? watchlist.filter(Boolean) : [];
        const match = safeWatchlist.find(item => String(item.ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === cleaned);
        if (match) {
            activeMacroContext = {
                dailyBias: match.dailyBias || 'Neutral',
                fourHourBias: match.fourHourBias || 'Neutral',
                notes: match.notes || ''
            };

            if (autoPrefillSetup) {
                if (match.dailyBias === 'Bearish' || (match.dailyBias === 'Neutral' && match.fourHourBias === 'Bearish')) {
                    directionSelect.value = 'Short';
                } else if (match.dailyBias === 'Bullish' || (match.dailyBias === 'Neutral' && match.fourHourBias === 'Bullish')) {
                    directionSelect.value = 'Long';
                }
                const parsedTrigger = parseFloat(String(match.keyLevel || '').replace(',', '.'));
                if (!isNaN(parsedTrigger) && parsedTrigger > 0) {
                    entryPriceInput.value = parsedTrigger;
                }
                const parsedSl = parseFloat(String(match.invalidation || '').replace(',', '.'));
                if (!isNaN(parsedSl) && parsedSl > 0) {
                    stopLossInput.value = parsedSl;
                }
            }

            const aligned = computeMacroAlignment(directionSelect.value, activeMacroContext.dailyBias, activeMacroContext.fourHourBias);
            macroBiasTag.innerHTML = `D1 ${getBiasBadge(activeMacroContext.dailyBias)} | H4 ${getBiasBadge(activeMacroContext.fourHourBias)}`;

            if (aligned === true) {
                macroAlignmentPill.innerHTML = '<span style="color: var(--color-win);">✓ Aligné au Biais Macro</span>';
            } else if (aligned === false) {
                macroAlignmentPill.innerHTML = '<span style="color: var(--color-loss);">⚠️ Contre-tendance Macro</span>';
            } else {
                macroAlignmentPill.innerHTML = '<span style="color: var(--text-secondary);">● Biais Neutre</span>';
            }

            macroContextDetails.innerHTML = `
                <div style="display: flex; gap: 14px; flex-wrap: wrap;">
                    <span><strong>D1 :</strong> ${getBiasBadge(activeMacroContext.dailyBias)}</span>
                    <span><strong>H4 :</strong> ${getBiasBadge(activeMacroContext.fourHourBias)}</span>
                    ${match.keyLevel ? `<span><strong>Trigger :</strong> <code class="mono-text">${match.keyLevel}</code></span>` : ''}
                    ${match.invalidation ? `<span><strong>SL :</strong> <code class="mono-text" style="color:var(--color-loss);">${match.invalidation}</code></span>` : ''}
                </div>
                ${activeMacroContext.notes ? `<div style="margin-top: 6px; font-size: 0.8rem; color: var(--text-primary); background: var(--bg-secondary); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color);">${activeMacroContext.notes}</div>` : ''}
            `;
            recomputeMt5Calculator();
        } else {
            activeMacroContext = { dailyBias: 'Non défini', fourHourBias: 'Non défini', notes: '' };
            macroBiasTag.innerHTML = '';
            macroAlignmentPill.innerHTML = '<span style="color: var(--text-muted);">Hors Watchlist</span>';
            macroContextDetails.innerHTML = 'Paire hors Watchlist Macro actuelle.';
        }
    }

    tickerInput.addEventListener('input', (e) => syncTickerBias(e.target.value, false));
    directionSelect.addEventListener('change', () => syncTickerBias(tickerInput.value, false));

    // Handle Quick Watchlist Chips
    container.querySelectorAll('.watchlist-quick-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const ticker = e.currentTarget.getAttribute('data-ticker');
            tickerInput.value = ticker;
            syncTickerBias(ticker, true);
        });
    });

    // Apply Pending Setup from Macro Watchlist "[ ⚡ Armer ce Setup ]"
    if (pendingSetup && pendingSetup.ticker) {
        tickerInput.value = pendingSetup.ticker;
        directionSelect.value = pendingSetup.direction || 'Long';
        const parsedTrigger = parseFloat(String(pendingSetup.keyLevel || '').replace(',', '.'));
        if (!isNaN(parsedTrigger) && parsedTrigger > 0) {
            entryPriceInput.value = parsedTrigger;
        }
        const parsedSl = parseFloat(String(pendingSetup.invalidation || '').replace(',', '.'));
        if (!isNaN(parsedSl) && parsedSl > 0) {
            stopLossInput.value = parsedSl;
        }
        syncTickerBias(pendingSetup.ticker, false);
        // If armed from Top Arbitrage banner (which may not be in watchlist yet), preserve its bias
        if (activeMacroContext.dailyBias === 'Non défini' && pendingSetup.dailyBias) {
            activeMacroContext.dailyBias = pendingSetup.dailyBias;
            activeMacroContext.fourHourBias = pendingSetup.fourHourBias || pendingSetup.dailyBias;
            activeMacroContext.notes = pendingSetup.notes || '';
            macroBiasTag.innerHTML = `D1 ${getBiasBadge(activeMacroContext.dailyBias)} | H4 ${getBiasBadge(activeMacroContext.fourHourBias)}`;
            macroAlignmentPill.innerHTML = '<span style="color: var(--color-win);">✓ Arbitrage G10 Aligné</span>';
            if (pendingSetup.notes) {
                macroContextDetails.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-primary);">${pendingSetup.notes}</div>`;
            }
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const direction = directionSelect.value;
        const isRespect = rulesInput.value === 'true';
        const macroAligned = computeMacroAlignment(
            direction,
            activeMacroContext.dailyBias,
            activeMacroContext.fourHourBias
        );

        const rawData = {
            status: 'OPEN',
            entryDate: form.querySelector('#entry-date').value,
            exitDate: null,
            ticker: tickerInput.value.trim(),
            direction: direction,
            timeFrame: form.querySelector('#timeframe').value,
            environment: envSelector.value,
            strategy: strategySelector.value,
            session: form.querySelector('#session').value,
            grade: form.querySelector('#grade').value,
            psychology: isRespect ? 'Respect du Plan 🟢' : 'FOMO / Erreur 🔴',
            rulesRespected: isRespect,
            entryPrice: entryPriceInput.value,
            stopLoss: stopLossInput.value,
            takeProfit: takeProfitInput.value,
            lotSize: lotSizeInput.value,
            risk: riskInput.value,
            riskUnit: riskUnitSelect.value,
            realizedPnl: null,
            macroDailyBias: activeMacroContext.dailyBias,
            macro4hBias: activeMacroContext.fourHourBias,
            macroAligned: macroAligned
        };

        const activeBalance = parseFloat(balanceInput.value) || store.getCurrentBalance();
        const tradeNumber = (state.liveJournal ? state.liveJournal.length : 0) + 1;
        
        const processedRecord = processTradeRecord(rawData, activeBalance, tradeNumber);
        store.addTrade(processedRecord);
        
        form.reset();
        balanceInput.value = activeBalance;
        form.querySelector('#entry-date').value = nowLocalISO;
        form.querySelector('#timeframe').value = '1H';
        riskInput.value = '1.0';
        riskUnitSelect.value = '%';
        setRulesRespected(true);
        syncTickerBias('', false);
        recomputeMt5Calculator();
        
        showAppToast(`🚀 Position ${processedRecord.ticker} (${processedRecord.direction} • ${processedRecord.lotSize || 0} Lots) ouverte dans Active Positions !`);
    });

    recomputeMt5Calculator();
    return container;
}
