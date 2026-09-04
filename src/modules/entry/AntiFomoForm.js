import { store } from '../../state/store.js';
import { processTradeRecord } from '../../utils/calculations.js';

export function renderAntiFomoForm(state) {
    const container = document.createElement('div');
    container.className = 'anti-fomo-dashboard';
    
    const watchlist = state.watchlist || [];

    // Helper: format bias badge HTML
    const getBiasBadge = (bias) => {
        if (bias === 'Bullish') return '<span style="color: var(--color-win); font-weight: 700;">🟢 Bullish</span>';
        if (bias === 'Bearish') return '<span style="color: var(--color-loss); font-weight: 700;">🔴 Bearish</span>';
        return '<span style="color: var(--text-secondary); font-weight: 600;">🟡 Neutral</span>';
    };

    container.innerHTML = `
        <div class="card-header">
            <h2>Trade Entry & Backtest Journal</h2>
        </div>
        
        <!-- Macro Watchlist Live Connection Banner -->
        ${watchlist.length > 0 ? `
            <div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--border-radius-md); padding: 12px 16px; margin-bottom: var(--spacing-lg); display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <span style="font-size: 0.8rem; font-weight: 700; color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Watchlist Macro :
                </span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="watchlist-quick-chips">
                    ${watchlist.map(item => `
                        <button type="button" class="watchlist-quick-chip" data-ticker="${item.ticker}" data-daily="${item.dailyBias}" data-four="${item.fourHourBias}" style="background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 4px 10px; border-radius: 999px; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all var(--transition-fast);">
                            <span style="font-weight: 700; color: var(--text-primary);">${item.ticker}</span>
                            <span style="font-size: 0.75rem;">${item.dailyBias === 'Bullish' ? '🟢' : (item.dailyBias === 'Bearish' ? '🔴' : '🟡')}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        <div style="display: flex; gap: var(--spacing-lg); flex-wrap: wrap;">
            <!-- Strategy & Checklist Area -->
            <div class="card" style="flex: 1; min-width: 300px;">
                <h3>Execution Protocol</h3>
                <div style="margin-top: var(--spacing-md); margin-bottom: var(--spacing-sm);">
                    <label style="display:block; margin-bottom: 8px; color: var(--text-secondary);">Environment (Account Type)</label>
                    <select id="env-type" style="width: 100%;">
                        <option value="Live">Live 🔴</option>
                        <option value="Demo">Demo 🟡</option>
                        <option value="Backtest">Backtest 🧪</option>
                    </select>
                </div>
                <div style="margin-bottom: var(--spacing-lg);">
                    <label style="display:block; margin-bottom: 8px; color: var(--text-secondary);">Active Strategy / Setup</label>
                    <select id="strategy-selector" style="width: 100%;">
                        <option value="Trend Continuation">Trend Continuation</option>
                        <option value="Supply & Demand Zone">Supply & Demand Zone</option>
                        <option value="Liquidity Sweep / SFP">Liquidity Sweep / SFP</option>
                        <option value="Breakout & Retest">Breakout & Retest</option>
                        <option value="Range Fade / Reversal">Range Fade / Reversal</option>
                        <option value="News Catalyst">News Catalyst</option>
                        <option value="Autre / Custom">Autre / Custom</option>
                    </select>
                </div>
                
                <div id="checklist-container" style="background-color: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--border-radius-sm);">
                    <h4 style="margin-bottom: var(--spacing-md);" id="checklist-title">Pre-flight Checklist</h4>
                    <div class="checklist-items" style="display: flex; flex-direction: column; gap: 12px;">
                        <!-- Injected via JS -->
                    </div>
                </div>
            </div>

            <!-- Trade Details Form -->
            <div class="card" style="flex: 2; min-width: 400px;">
                <h3>Trade Details & Psychology</h3>
                <form id="trade-form" style="margin-top: var(--spacing-md); display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
                    
                    <!-- Row 1: Dates -->
                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Entry Date</label>
                        <input type="datetime-local" id="entry-date" required style="width: 100%; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Exit Date</label>
                        <input type="datetime-local" id="exit-date" required style="width: 100%; box-sizing: border-box;">
                    </div>

                    <!-- Row 2: Instrument & Direction -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label style="font-size: 0.9rem; color: var(--text-secondary); margin: 0;">Ticker / Asset</label>
                            <div id="live-macro-bias-tag" style="font-size: 0.75rem; color: var(--text-muted);"></div>
                        </div>
                        <input type="text" id="ticker" placeholder="EURUSD, BTC, NQ..." required style="width: 100%; text-transform: uppercase; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Direction & Time-Frame</label>
                        <div style="display: flex; gap: 8px;">
                            <select id="direction" style="flex:1;">
                                <option value="Long">Long</option>
                                <option value="Short">Short</option>
                            </select>
                            <select id="timeframe" style="flex:1;">
                                <option value="1m">1m</option>
                                <option value="5m">5m</option>
                                <option value="15m">15m</option>
                                <option value="1H">1H</option>
                                <option value="4H">4H</option>
                                <option value="Daily">Daily</option>
                            </select>
                        </div>
                    </div>

                    <!-- Row 3: Context & Psychology -->
                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Session</label>
                        <select id="session" style="width: 100%;">
                            <option value="Asia">Asia</option>
                            <option value="London">London</option>
                            <option value="NY Morning">NY Morning</option>
                            <option value="NY Afternoon">NY Afternoon</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Setup Grade (Qualité)</label>
                        <select id="grade" style="width: 100%;">
                            <option value="Setup A+ (Parfait)">Setup A+ (Parfait)</option>
                            <option value="Setup B (Moyen)">Setup B (Moyen)</option>
                            <option value="Setup C (Forcé)">Setup C (Forcé)</option>
                        </select>
                    </div>
                    <div style="grid-column: 1 / -1;">
                        <label style="display:block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Psychologie & Discipline</label>
                        <select id="psychology" style="width: 100%;">
                            <option value="Respect du Plan 🟢">Respect du Plan 🟢</option>
                            <option value="FOMO / Entrée Hâtive 🔴">FOMO / Entrée Hâtive 🔴</option>
                            <option value="Revenge Trade 🔴">Revenge Trade 🔴</option>
                            <option value="Sortie Anticipée 🟠">Sortie Anticipée 🟠</option>
                        </select>
                    </div>

                    <!-- Row 4: Financials & PnL -->
                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Risk ($)</label>
                        <input type="number" id="risk" required min="1" step="0.01" placeholder="Ex: 50" style="width: 100%; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom: 4px; font-size: 0.9rem; color: var(--text-secondary);">Planned Reward [R]</label>
                        <input type="number" id="planned-reward" required step="0.1" placeholder="Ex: 2.5" style="width: 100%; box-sizing: border-box;">
                    </div>
                    <div style="grid-column: 1 / -1; padding: 12px; background: rgba(38, 166, 154, 0.1); border: 1px solid rgba(38, 166, 154, 0.3); border-radius: var(--border-radius-sm);">
                        <label style="display:block; margin-bottom: 4px; font-size: 0.9rem; color: var(--color-win); font-weight: bold;">Realized PnL ($) (Net)</label>
                        <input type="number" id="realized-pnl" required step="0.01" placeholder="Ex: 125.50 (Use negative for loss)" style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.1); color: white; font-weight: bold;">
                    </div>
                    
                    <div style="grid-column: 1 / -1; margin-top: var(--spacing-md); display: flex; justify-content: flex-end;">
                        <button type="submit" id="submit-trade" disabled style="background-color: var(--color-accent); color: white; padding: 12px 24px; font-size: 1rem; font-weight: bold; box-shadow: 0 4px 6px rgba(41, 98, 255, 0.3);">
                            Log Trade & Calculate
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Strategy Checklist Logic
    const envSelector = container.querySelector('#env-type');
    const strategySelector = container.querySelector('#strategy-selector');
    const checklistItemsContainer = container.querySelector('.checklist-items');
    const checklistTitle = container.querySelector('#checklist-title');
    const submitBtn = container.querySelector('#submit-trade');
    const form = container.querySelector('#trade-form');
    const tickerInput = container.querySelector('#ticker');
    const macroBiasTag = container.querySelector('#live-macro-bias-tag');
    
    // Check and display live bias for a ticker
    function syncTickerBias(tickerVal) {
        const cleaned = tickerVal.replace(/[^A-Z]/g, '');
        if (!cleaned) {
            macroBiasTag.innerHTML = '';
            return;
        }
        
        const match = watchlist.find(item => item.ticker.replace(/[^A-Z]/g, '') === cleaned);
        if (match) {
            macroBiasTag.innerHTML = `Biais Macro: Daily ${getBiasBadge(match.dailyBias)} | 4H ${getBiasBadge(match.fourHourBias)}`;
        } else {
            macroBiasTag.innerHTML = '';
        }
    }

    tickerInput.addEventListener('input', (e) => {
        syncTickerBias(e.target.value.toUpperCase());
    });

    // Handle Quick Watchlist Chips
    const quickChips = container.querySelectorAll('.watchlist-quick-chip');
    quickChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            const ticker = e.currentTarget.getAttribute('data-ticker');
            tickerInput.value = ticker.replace('/', '');
            syncTickerBias(ticker);
            checkFormValidity();
        });
    });

    const checklists = {
        'Backtest': [
            'Structure HTF (D1/H4) alignée',
            'Zone de prix clé identifiée',
            'Signal de confirmation LTF valide'
        ],
        'LiveDemo': [
            'Macro Alignment verified',
            'Retail Sentiment checked (counter-trend logic)',
            'No major high-impact news in next 2 hours',
            'Mindset is calm and objective'
        ]
    };

    function renderChecklist() {
        const isBacktest = envSelector.value === 'Backtest';
        const items = isBacktest ? checklists['Backtest'] : checklists['LiveDemo'];
        checklistTitle.innerText = isBacktest ? "Technical Checklist (Backtest)" : "Macro & Mental Protocol";
        
        checklistItemsContainer.innerHTML = items.map((item, idx) => `
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                <input type="checkbox" class="fomo-check" style="width: 20px; height: 20px; accent-color: var(--color-accent);">
                <span style="color: var(--text-primary);">${item}</span>
            </label>
        `).join('');

        const checkboxes = container.querySelectorAll('.fomo-check');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', checkFormValidity);
        });
        checkFormValidity();
    }

    function checkFormValidity() {
        const checkboxes = container.querySelectorAll('.fomo-check');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        const formValid = form.checkValidity();
        submitBtn.disabled = !(allChecked && formValid);
    }

    envSelector.addEventListener('change', () => renderChecklist());
    
    form.addEventListener('input', checkFormValidity);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (submitBtn.disabled) return;

        const rawData = {
            entryDate: form.querySelector('#entry-date').value,
            exitDate: form.querySelector('#exit-date').value,
            ticker: form.querySelector('#ticker').value,
            direction: form.querySelector('#direction').value,
            timeFrame: form.querySelector('#timeframe').value,
            environment: envSelector.value,
            strategy: strategySelector.value,
            session: form.querySelector('#session').value,
            grade: form.querySelector('#grade').value,
            psychology: form.querySelector('#psychology').value,
            risk: form.querySelector('#risk').value,
            plannedReward: form.querySelector('#planned-reward').value,
            realizedPnl: form.querySelector('#realized-pnl').value
        };

        const currentBalance = state.config.initialCapital || 10000; 
        let latestBalance = currentBalance;
        if (state.liveJournal && state.liveJournal.length > 0) {
            latestBalance = state.liveJournal[state.liveJournal.length - 1].progressionNet;
        }
        
        const tradeNumber = (state.liveJournal ? state.liveJournal.length : 0) + 1;
        
        const processedRecord = processTradeRecord(rawData, latestBalance, tradeNumber);
        
        store.addTrade(processedRecord);
        
        form.reset();
        macroBiasTag.innerHTML = '';
        const checkboxes = container.querySelectorAll('.fomo-check');
        checkboxes.forEach(cb => cb.checked = false);
        checkFormValidity();
        
        alert('Trade Logged Successfully! Check Visual Tracker.');
    });

    // Initial render
    renderChecklist();

    return container;
}
