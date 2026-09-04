import { store } from '../../state/store.js';

// Custom Toast notification utility
function showToast(message) {
    const existing = document.querySelector('.custom-toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast-notification';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.backgroundColor = '#131722';
    toast.style.color = '#ffffff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '6px';
    toast.style.border = '1px solid #26a69a';
    toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '600';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    toast.innerHTML = `
        <span style="color: #26a69a; font-size: 1.1rem; font-weight: bold;">✓</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    }, 50);
    
    setTimeout(() => {
        toast.style.transform = 'translateY(20px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

export function renderMacroDashboard(state) {
    const container = document.createElement('div');
    container.className = 'macro-dashboard';
    
    let localWatchlist = JSON.parse(JSON.stringify(state.watchlist || []));
    
    // Filter active open trades from live journal database
    const openTrades = (state.liveJournal || []).filter(t => {
        return t.entryDate && (!t.exitDate || t.exitDate === '' || t.exitDate === 'null' || t.exitDate === 'undefined');
    });

    // Populate default lists if empty in current state
    const centralBanks = state.centralBanks && state.centralBanks.length > 0 ? state.centralBanks : [
        { bank: 'FED', stance: 'Restrictif' },
        { bank: 'ECB', stance: 'Restrictif' },
        { bank: 'BOE', stance: 'Neutre' },
        { bank: 'BOJ', stance: 'Accommodant' },
        { bank: 'RBA', stance: 'Restrictif' },
        { bank: 'RBNZ', stance: 'Accommodant' },
        { bank: 'SNB', stance: 'Accommodant' },
        { bank: 'BOC', stance: 'Neutre' }
    ];

    const currencyPerformance = state.currencyPerformance && state.currencyPerformance.length > 0 ? state.currencyPerformance : [
        { currency: 'USD', value: 1.2 },
        { currency: 'EUR', value: -0.5 },
        { currency: 'GBP', value: 0.3 },
        { currency: 'JPY', value: -1.1 },
        { currency: 'CAD', value: 0.1 },
        { currency: 'AUD', value: -0.2 },
        { currency: 'CHF', value: -0.4 },
        { currency: 'NZD', value: -0.3 }
    ];

    const fng = state.fearGreed || { value: 24, classification: 'Extreme Fear' };

    container.innerHTML = `
        <div class="card-header" style="margin-bottom: var(--spacing-lg);">
            <h2>Macro Insights</h2>
        </div>
        
        <div class="grid-layout" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
            <!-- Fear & Greed Index Card -->
            <div class="card" id="fear-greed-gauge" style="display: flex; flex-direction: column; justify-content: space-between;">
                <h3>Fear & Greed Index</h3>
                <div style="display: flex; flex-direction: column; gap: var(--spacing-sm); margin-top: var(--spacing-sm);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary); width: 60px;">Index:</span>
                        <input type="number" id="fng-value-input" min="0" max="100" value="${fng.value}" style="flex: 1; padding: 6px; font-weight: bold; text-align: center;" />
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary); width: 60px;">Stance:</span>
                        <select id="fng-classification-select" style="flex: 1; padding: 6px; font-weight: bold; border-radius: var(--border-radius-sm);">
                            <option value="Extreme Fear" ${fng.classification === 'Extreme Fear' ? 'selected' : ''}>Extreme Fear 🔴</option>
                            <option value="Fear" ${fng.classification === 'Fear' ? 'selected' : ''}>Fear 🟠</option>
                            <option value="Neutral" ${fng.classification === 'Neutral' ? 'selected' : ''}>Neutral 🟡</option>
                            <option value="Greed" ${fng.classification === 'Greed' ? 'selected' : ''}>Greed 🟢</option>
                            <option value="Extreme Greed" ${fng.classification === 'Extreme Greed' ? 'selected' : ''}>Extreme Greed 🟢</option>
                        </select>
                    </div>
                    <button id="fetch-fng-btn" style="background-color: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 8px; font-size: 0.85rem; font-weight: 600; border-radius: var(--border-radius-sm); cursor: pointer; margin-top: 4px;">
                        Fetch live API 🔄
                    </button>
                </div>
            </div>
            
            <!-- Weekly Currency Performance Card -->
            <div class="card" id="currency-ranking" style="max-height: 250px; overflow-y: auto;">
                <h3>Currency Performance (Weekly)</h3>
                <div id="currency-perf-list" style="display: flex; flex-direction: column; gap: 6px; margin-top: var(--spacing-sm);">
                    ${currencyPerformance.map((c, idx) => {
                        const val = parseFloat(c.value) || 0;
                        const isPositive = val >= 0;
                        const colorStyle = isPositive ? 'color: var(--color-win);' : 'color: var(--color-loss);';
                        return `
                            <div class="currency-row" data-index="${idx}" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">
                                <span style="font-weight: 700; font-size: 0.85rem;">${c.currency}</span>
                                <input type="number" step="0.01" class="currency-perf-input" value="${val}" style="width: 75px; text-align: right; font-weight: bold; padding: 4px; font-family: var(--font-mono); font-size: 0.85rem; border: none; background: transparent; border-radius: 4px; ${colorStyle}" />
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <!-- Central Bank Stance Card -->
            <div class="card" id="central-banks" style="max-height: 250px; overflow-y: auto;">
                <h3>Central Bank Stances</h3>
                <div id="central-banks-list" style="display: flex; flex-direction: column; gap: 6px; margin-top: var(--spacing-sm);">
                    ${centralBanks.map((b, idx) => `
                        <div class="bank-row" data-index="${idx}" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; gap: var(--spacing-sm);">
                            <span style="font-weight: 700; font-size: 0.85rem;">${b.bank}</span>
                            <select class="bank-stance-select" style="width: 120px; padding: 4px; font-weight: bold; font-size: 0.8rem; border-radius: 4px;">
                                <option value="Restrictif" ${b.stance === 'Restrictif' ? 'selected' : ''}>Restrictif 🔴</option>
                                <option value="Neutre" ${b.stance === 'Neutre' ? 'selected' : ''}>Neutre 🟡</option>
                                <option value="Accommodant" ${b.stance === 'Accommodant' ? 'selected' : ''}>Accommodant 🟢</option>
                            </select>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <!-- Control Center Section -->
        <div class="card" style="margin-top: var(--spacing-lg);">
            <style>
                @keyframes pulse-glow {
                    0% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.7); }
                    70% { box-shadow: 0 0 0 8px rgba(0, 230, 118, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0); }
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
                    align-items: center;
                    justify-content: space-between;
                    padding: var(--spacing-md);
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius-md);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                .watchlist-card {
                    background-color: var(--bg-tertiary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius-md);
                    padding: var(--spacing-md);
                    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
                }
                .watchlist-card:hover {
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
                }
            </style>
            
            <div class="card-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: var(--spacing-md); margin-bottom: var(--spacing-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--spacing-md);">
                <div>
                    <h3 style="font-size: 1.3rem;">Daily Watchlist & Active Trades</h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">Dynamic market bias control center & active position monitor.</p>
                </div>
                <div style="display: flex; gap: var(--spacing-sm); align-items: center;">
                    <input type="text" id="new-ticker-input" placeholder="e.g. EUR/USD" style="text-transform: uppercase; width: 120px; padding: 8px 12px; font-size: 0.85rem; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: var(--border-radius-sm);" />
                    <button id="add-ticker-btn" style="background-color: var(--color-accent); color: white; padding: 8px 16px; font-size: 0.85rem; font-weight: 600; border-radius: var(--border-radius-sm); box-shadow: 0 2px 4px rgba(0, 191, 165, 0.2); cursor: pointer;">+ Add Pair</button>
                </div>
            </div>

            <!-- Active Open Positions -->
            <div id="active-trades-container" style="margin-bottom: var(--spacing-xl);">
                <h4 style="color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--spacing-md); display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: var(--color-win);"></span>
                    Active Positions
                </h4>
                <div id="active-trades-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--spacing-md);">
                    <!-- Injected via JS -->
                </div>
            </div>

            <!-- Daily Watchlist -->
            <div>
                <h4 style="color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--spacing-md); display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: var(--color-accent);"></span>
                    Daily Watchlist Report
                </h4>
                <div id="watchlist-items-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--spacing-md);">
                    <!-- Injected via JS -->
                </div>
                
                <div style="display: flex; justify-content: flex-end; margin-top: var(--spacing-lg); border-top: 1px solid var(--border-color); padding-top: var(--spacing-md);">
                    <button id="save-notes-btn" style="background-color: var(--color-win); color: #072b28; padding: 10px 20px; font-size: 0.95rem; font-weight: 700; border-radius: var(--border-radius-sm); box-shadow: 0 4px 10px var(--color-win-transparent); cursor: pointer;">
                        Save Daily Notes
                    </button>
                </div>
            </div>
        </div>
    `;

    // 1. Hook up Fear & Greed Index Events
    const fngValInput = container.querySelector('#fng-value-input');
    const fngClassSelect = container.querySelector('#fng-classification-select');
    const fetchFngBtn = container.querySelector('#fetch-fng-btn');

    const updateFngState = () => {
        const val = parseInt(fngValInput.value) || 50;
        const classification = fngClassSelect.value;
        store.updateFearGreed(val, classification);
    };

    fngValInput.addEventListener('input', updateFngState);
    fngClassSelect.addEventListener('change', updateFngState);

    fetchFngBtn.addEventListener('click', async () => {
        fetchFngBtn.innerText = 'Fetching... 🔄';
        fetchFngBtn.disabled = true;
        try {
            const res = await fetch('https://api.alternative.me/fng/');
            const data = await res.json();
            if (data && data.data && data.data[0]) {
                const val = parseInt(data.data[0].value) || 50;
                const classification = data.data[0].value_classification;
                
                fngValInput.value = val;
                fngClassSelect.value = classification;
                
                store.updateFearGreed(val, classification);
                showToast(`Fear & Greed Index actualisé : ${val} (${classification})`);
            }
        } catch (e) {
            console.error('Error fetching Fear & Greed index', e);
            alert('Impossible de récupérer l\'indice Fear & Greed. Veuillez réessayer.');
        } finally {
            fetchFngBtn.innerText = 'Fetch live API 🔄';
            fetchFngBtn.disabled = false;
        }
    });

    // 2. Hook up Currency Performance Events
    const currencyInputs = container.querySelectorAll('.currency-perf-input');
    currencyInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.closest('.currency-row').getAttribute('data-index'));
            const val = parseFloat(e.target.value) || 0;
            
            // Update in-memory state
            currencyPerformance[index].value = val;
            store.updateCurrencyPerformance(currencyPerformance);
            
            // Color updates dynamically
            if (val >= 0) {
                e.target.style.color = 'var(--color-win)';
            } else {
                e.target.style.color = 'var(--color-loss)';
            }
        });
    });

    // 3. Hook up Central Bank Stance Events
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
            store.updateCentralBanks(centralBanks);
            updateBankSelectStyle(e.target);
        });
    });

    // Dynamic Select style update helper for watchlist cards
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

    // Pull currently filled input values back to localWatchlist
    function updateLocalWatchlistFromDOM() {
        const cards = container.querySelectorAll('.watchlist-card');
        localWatchlist = Array.from(cards).map(card => {
            const ticker = card.getAttribute('data-ticker');
            const dailyBias = card.querySelector('.daily-bias-select').value;
            const fourHourBias = card.querySelector('.fourhour-bias-select').value;
            const notes = card.querySelector('.notes-textarea').value;
            return { ticker, dailyBias, fourHourBias, notes };
        });
    }

    // Render active open trades list
    function renderActiveTrades() {
        const activeListContainer = container.querySelector('#active-trades-list');
        if (!activeListContainer) return;
        
        if (openTrades.length === 0) {
            activeListContainer.innerHTML = `
                <div style="padding: var(--spacing-md); background: var(--bg-tertiary); border-radius: var(--border-radius-md); color: var(--text-secondary); font-size: 0.9rem; grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-color);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    No active positions open in the trading journal.
                </div>
            `;
            return;
        }
        
        activeListContainer.innerHTML = openTrades.map(trade => `
            <div class="active-trade-item">
                <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; background-color: var(--color-win-transparent); color: var(--color-win); font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">
                        <span class="glow-dot"></span> Live Trade
                    </span>
                    <span style="font-weight: 700; font-size: 1.05rem; color: var(--text-primary);">${trade.ticker}</span>
                </div>
                <div style="display: flex; gap: var(--spacing-md); align-items: center;">
                    <div style="text-align: right;">
                        <span style="font-size: 0.7rem; color: var(--text-secondary); display: block;">Direction</span>
                        <span class="${trade.direction === 'Long' ? 'text-win' : 'text-loss'}" style="font-weight: 700; font-size: 0.9rem;">${trade.direction}</span>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.7rem; color: var(--text-secondary); display: block;">Risk</span>
                        <span class="mono-text" style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">$${trade.risk}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Render Watchlist cards/rows
    function renderWatchlist() {
        const listContainer = container.querySelector('#watchlist-items-container');
        if (!listContainer) return;
        
        if (localWatchlist.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-watchlist" style="text-align: center; padding: var(--spacing-xl); background: var(--bg-tertiary); border: 1px dashed var(--border-color); border-radius: var(--border-radius-md); color: var(--text-secondary); grid-column: 1 / -1; width: 100%; box-sizing: border-box;">
                    No currency pairs in daily watchlist. Add a pair above to start tracking biases.
                </div>
            `;
            return;
        }
        
        listContainer.innerHTML = localWatchlist.map(item => `
            <div class="watchlist-card" data-ticker="${item.ticker}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md); border-bottom: 1px solid var(--border-color); padding-bottom: var(--spacing-sm);">
                    <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin: 0;">${item.ticker}</h4>
                    <button class="remove-watchlist-btn" data-ticker="${item.ticker}" style="background: transparent; padding: 4px var(--spacing-sm); color: var(--color-loss); border: 1px solid var(--color-loss-transparent); border-radius: var(--border-radius-sm); font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Remove
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: var(--spacing-xs); text-transform: uppercase; font-weight: 600;">Daily Bias</label>
                        <select class="daily-bias-select" style="width: 100%; border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); font-weight: 600; padding: 8px var(--spacing-sm); cursor: pointer;">
                            <option value="Neutral" ${item.dailyBias === 'Neutral' ? 'selected' : ''}>Neutral</option>
                            <option value="Bullish" ${item.dailyBias === 'Bullish' ? 'selected' : ''}>Bullish</option>
                            <option value="Bearish" ${item.dailyBias === 'Bearish' ? 'selected' : ''}>Bearish</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: var(--spacing-xs); text-transform: uppercase; font-weight: 600;">4H Bias</label>
                        <select class="fourhour-bias-select" style="width: 100%; border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); font-weight: 600; padding: 8px var(--spacing-sm); cursor: pointer;">
                            <option value="Neutral" ${item.fourHourBias === 'Neutral' ? 'selected' : ''}>Neutral</option>
                            <option value="Bullish" ${item.fourHourBias === 'Bullish' ? 'selected' : ''}>Bullish</option>
                            <option value="Bearish" ${item.fourHourBias === 'Bearish' ? 'selected' : ''}>Bearish</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label style="display: block; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: var(--spacing-xs); text-transform: uppercase; font-weight: 600;">Fundamental Notes</label>
                    <textarea class="notes-textarea" rows="3" placeholder="Enter daily report/fundamental details..." style="width: 100%; resize: vertical; box-sizing: border-box; font-size: 0.9rem; padding: var(--spacing-sm); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); background: var(--bg-primary); color: var(--text-primary);">${item.notes || ''}</textarea>
                </div>
            </div>
        `).join('');
        
        const selects = listContainer.querySelectorAll('select');
        selects.forEach(select => {
            updateSelectColor(select);
            select.addEventListener('change', (e) => {
                updateSelectColor(e.target);
                updateLocalWatchlistFromDOM();
            });
        });

        const textareas = listContainer.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            textarea.addEventListener('input', () => {
                updateLocalWatchlistFromDOM();
            });
        });

        const removeBtns = listContainer.querySelectorAll('.remove-watchlist-btn');
        removeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ticker = e.currentTarget.getAttribute('data-ticker');
                localWatchlist = localWatchlist.filter(item => item.ticker !== ticker);
                renderWatchlist();
            });
        });
    }

    const newTickerInput = container.querySelector('#new-ticker-input');
    const addTickerBtn = container.querySelector('#add-ticker-btn');
    
    addTickerBtn.addEventListener('click', () => {
        let ticker = newTickerInput.value.trim().toUpperCase();
        if (!ticker) {
            alert('Veuillez entrer une paire (ex: EUR/USD).');
            return;
        }
        
        if (ticker.length === 6 && !ticker.includes('/')) {
            ticker = ticker.slice(0, 3) + '/' + ticker.slice(3);
        }
        
        if (localWatchlist.some(item => item.ticker === ticker)) {
            alert(`${ticker} est déjà dans la Watchlist.`);
            return;
        }
        
        localWatchlist.push({
            ticker,
            dailyBias: 'Neutral',
            fourHourBias: 'Neutral',
            notes: ''
        });
        
        newTickerInput.value = '';
        renderWatchlist();
    });

    newTickerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addTickerBtn.click();
        }
    });

    // Save Daily Notes and trigger Custom Toast popup
    const saveNotesBtn = container.querySelector('#save-notes-btn');
    saveNotesBtn.addEventListener('click', () => {
        updateLocalWatchlistFromDOM();
        store.updateWatchlist(localWatchlist);
        
        showToast("Notes daily enregistrées avec succès !");
    });

    renderActiveTrades();
    renderWatchlist();

    return container;
}
