import { calculateAggregates, filterTrades, isTradeClosed, INITIAL_CAPITAL } from '../../utils/calculations.js';
import { store } from '../../state/store.js';
import { openCloseTradeModal, showAppToast } from '../entry/CloseTradeModal.js';

let currentFilters = {
    environment: 'Tous',
    period: 'Tout',
    strategy: 'Toutes',
    session: 'Toutes',
    status: 'Tous'
};

let chartInstances = {};

export function renderCalendarGrid(state) {
    const container = document.createElement('div');
    container.className = 'tracker-dashboard';

    const journal = state.liveJournal || [];
    const filteredJournal = filterTrades(journal, currentFilters);
    // Performance metrics & charts consume exclusively CLOSED trades matching the primary filters (ignoring status filter if user wants to inspect metrics, or using filtered CLOSED trades)
    const closedFilteredJournal = filterTrades(journal, { ...currentFilters, status: 'Tous' }).filter(isTradeClosed);
    const openFilteredCount = filterTrades(journal, { ...currentFilters, status: 'Tous' }).filter(t => !isTradeClosed(t)).length;
    const stats = calculateAggregates(closedFilteredJournal, INITIAL_CAPITAL);
    const mc = stats.macroCorrelation || {
        alignedWins: 0, alignedTotal: 0, alignedPnl: 0, alignedWinRate: '0.0',
        counterWins: 0, counterTotal: 0, counterPnl: 0, counterWinRate: '0.0',
        neutralWins: 0, neutralTotal: 0, neutralPnl: 0, neutralWinRate: '0.0'
    };

    const currentBalance = (INITIAL_CAPITAL + Number(stats.totalPnl)).toFixed(2);

    // History Table (shows both OPEN and CLOSED trades, with "🏁 Clôturer le trade" action for OPEN trades)
    let tableRows = filteredJournal.map((t, idx) => {
        const closed = isTradeClosed(t);
        const statusBadge = closed
            ? `<span style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color);">⚪ CLOSED</span>`
            : `<span style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; background: var(--color-win-transparent); color: var(--color-win); border: 1px solid rgba(0, 230, 118, 0.35);">🟢 OPEN</span>`;

        const macroBadge = (t.macroDailyBias && t.macroDailyBias !== 'Non défini')
            ? `<span style="font-size: 0.75rem; color: var(--text-secondary);">D1: <strong>${t.macroDailyBias}</strong> ${t.macroAligned === true ? '<span title="Aligné avec le biais Macro" style="color:var(--color-win); font-weight:800;">✓ Aligné</span>' : (t.macroAligned === false ? '<span title="Contre-tendance Macro" style="color:var(--color-loss); font-weight:800;">⚠ Contre</span>' : '')}</span>`
            : `<span style="font-size: 0.75rem; color: var(--text-muted);">Non défini</span>`;

        const lotBadge = t.lotSize
            ? `<span class="mono-text" style="font-size: 0.75rem; color: var(--accent-primary); font-weight: 700;">${Number(t.lotSize).toFixed(2)} lot</span>`
            : '';

        const pnlCell = closed
            ? `<span class="mono-text" style="color: ${Number(t.netDollar) > 0 ? 'var(--color-win)' : (Number(t.netDollar) < 0 ? 'var(--color-loss)' : 'var(--text-secondary)')}; font-weight: 800;">
                ${Number(t.netDollar) >= 0 ? '+$' + Number(t.netDollar).toFixed(2) : '-$' + Math.abs(Number(t.netDollar)).toFixed(2)}
                <span style="font-size: 0.75rem; opacity: 0.85;">(${Number(t.realizedR || 0) >= 0 ? '+' : ''}${Number(t.realizedR || 0).toFixed(2)}R)</span>
               </span>`
            : `<span class="mono-text" style="color: var(--text-secondary); font-size: 0.78rem;">Risque engagé : <strong>$${Number(t.risk || 0).toFixed(2)}</strong> (${Number(t.riskPercent || 0).toFixed(2)}%)</span>`;

        return `
            <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s;">
                <td style="padding: 12px 8px; color: var(--text-secondary); font-size: 0.8rem;">${new Date(t.entryDate).toLocaleDateString('fr-FR')}</td>
                <td style="padding: 12px 8px;">${statusBadge}</td>
                <td style="padding: 12px 8px; font-weight: 800; color: var(--text-primary);">
                    ${t.ticker}
                    <span style="font-size: 0.74rem; font-weight: 700; color: ${t.direction === 'Long' ? 'var(--color-win)' : 'var(--color-loss)'};">(${t.direction})</span>
                    ${lotBadge ? `<div>${lotBadge}</div>` : ''}
                </td>
                <td style="padding: 12px 8px; color: var(--text-secondary); font-size: 0.8rem;">${t.environment || 'Live'} • ${t.timeFrame || '1H'}</td>
                <td style="padding: 12px 8px; color: var(--text-primary); font-size: 0.8rem;">${t.strategy || '-'}</td>
                <td style="padding: 12px 8px;">${macroBadge}</td>
                <td style="padding: 12px 8px; color: var(--text-secondary); font-size: 0.8rem;">${t.psychology || '-'}</td>
                <td style="padding: 12px 8px;">${pnlCell}</td>
                <td style="padding: 12px 8px; display: flex; align-items: center; gap: 8px;">
                    ${!closed ? `
                        <button type="button" class="tracker-close-trade-btn" data-idx="${idx}" style="background: var(--color-win); color: #052623; padding: 6px 10px; font-size: 0.74rem; font-weight: 800; border-radius: 6px; cursor: pointer; white-space: nowrap;">
                            🏁 Clôturer le trade
                        </button>
                    ` : ''}
                    <button type="button" class="delete-trade-btn" data-id="${t.tradeN ?? t.cloudId}" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--color-loss); cursor: pointer; padding: 5px 8px; border-radius: 6px; font-size: 0.82rem;" title="Supprimer ce trade">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="card-header" style="flex-direction: column; align-items: stretch; gap: var(--spacing-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                    <h2>Visual Tracker & Institutional Analytics</h2>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">
                        Statistiques calculées exclusivement sur les positions clôturées (<strong>${closedFilteredJournal.length} CLOSED</strong>${openFilteredCount > 0 ? ` • <span style="color: var(--color-win); font-weight: 700;">${openFilteredCount} OPEN en cours</span>` : ''}).
                    </p>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 8px 14px; border-radius: 8px; font-size: 0.82rem;">
                        <span style="color: var(--text-secondary);">Balance Courante :</span>
                        <strong class="mono-text" style="color: ${Number(currentBalance) >= INITIAL_CAPITAL ? 'var(--color-win)' : 'var(--color-loss)'}; margin-left: 6px; font-size: 0.95rem;">$${currentBalance}</strong>
                    </div>
                    <button id="export-report" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; gap: 8px; font-weight: 600;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        Export Log (.md)
                    </button>
                </div>
            </div>

            <!-- GLOBAL FILTERS BAR (Uniform Dark Zinc Theme) -->
            <div style="display: flex; gap: var(--spacing-md); background: var(--bg-secondary); border: 1px solid var(--border-color); padding: var(--spacing-md); border-radius: var(--border-radius-md); flex-wrap: wrap;">
                <div style="flex: 1; min-width: 135px;">
                    <label style="font-size: 0.74rem; color: var(--text-secondary); display: block; margin-bottom: 6px; font-weight: 700; text-transform: uppercase;">Statut</label>
                    <select id="filter-status" class="filter-select" style="width: 100%; padding: 8px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); font-weight: 600;">
                        <option value="Tous" ${currentFilters.status === 'Tous' ? 'selected' : ''}>Tous (OPEN & CLOSED)</option>
                        <option value="OPEN" ${currentFilters.status === 'OPEN' ? 'selected' : ''}>🟢 OPEN uniquement</option>
                        <option value="CLOSED" ${currentFilters.status === 'CLOSED' ? 'selected' : ''}>⚪ CLOSED uniquement</option>
                    </select>
                </div>
                <div style="flex: 1; min-width: 135px;">
                    <label style="font-size: 0.74rem; color: var(--text-secondary); display: block; margin-bottom: 6px; font-weight: 700; text-transform: uppercase;">Environment</label>
                    <select id="filter-env" class="filter-select" style="width: 100%; padding: 8px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); font-weight: 600;">
                        <option value="Tous" ${currentFilters.environment === 'Tous' ? 'selected' : ''}>Tous</option>
                        <option value="Live" ${currentFilters.environment === 'Live' ? 'selected' : ''}>Live</option>
                        <option value="Demo" ${currentFilters.environment === 'Demo' ? 'selected' : ''}>Demo</option>
                        <option value="Backtest" ${currentFilters.environment === 'Backtest' ? 'selected' : ''}>Backtest</option>
                    </select>
                </div>
                <div style="flex: 1; min-width: 135px;">
                    <label style="font-size: 0.74rem; color: var(--text-secondary); display: block; margin-bottom: 6px; font-weight: 700; text-transform: uppercase;">Période</label>
                    <select id="filter-period" class="filter-select" style="width: 100%; padding: 8px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); font-weight: 600;">
                        <option value="Tout" ${currentFilters.period === 'Tout' ? 'selected' : ''}>Tout</option>
                        <option value="Ce Mois" ${currentFilters.period === 'Ce Mois' ? 'selected' : ''}>Ce Mois</option>
                        <option value="Cette Semaine" ${currentFilters.period === 'Cette Semaine' ? 'selected' : ''}>Cette Semaine</option>
                    </select>
                </div>
                <div style="flex: 1; min-width: 135px;">
                    <label style="font-size: 0.74rem; color: var(--text-secondary); display: block; margin-bottom: 6px; font-weight: 700; text-transform: uppercase;">Stratégie</label>
                    <select id="filter-strategy" class="filter-select" style="width: 100%; padding: 8px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); font-weight: 600;">
                        <option value="Toutes" ${currentFilters.strategy === 'Toutes' ? 'selected' : ''}>Toutes</option>
                        <option value="Trend Continuation" ${currentFilters.strategy === 'Trend Continuation' ? 'selected' : ''}>Trend Cont.</option>
                        <option value="Supply & Demand Zone" ${currentFilters.strategy === 'Supply & Demand Zone' ? 'selected' : ''}>Supply/Demand</option>
                        <option value="Liquidity Sweep / SFP" ${currentFilters.strategy === 'Liquidity Sweep / SFP' ? 'selected' : ''}>SFP</option>
                        <option value="Breakout & Retest" ${currentFilters.strategy === 'Breakout & Retest' ? 'selected' : ''}>Breakout</option>
                        <option value="Range Fade / Reversal" ${currentFilters.strategy === 'Range Fade / Reversal' ? 'selected' : ''}>Reversal</option>
                        <option value="News Catalyst" ${currentFilters.strategy === 'News Catalyst' ? 'selected' : ''}>News Catalyst</option>
                        <option value="Autre / Custom" ${currentFilters.strategy === 'Autre / Custom' ? 'selected' : ''}>Autre / Custom</option>
                    </select>
                </div>
                <div style="flex: 1; min-width: 135px;">
                    <label style="font-size: 0.74rem; color: var(--text-secondary); display: block; margin-bottom: 6px; font-weight: 700; text-transform: uppercase;">Session</label>
                    <select id="filter-session" class="filter-select" style="width: 100%; padding: 8px 10px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); font-weight: 600;">
                        <option value="Toutes" ${currentFilters.session === 'Toutes' ? 'selected' : ''}>Toutes</option>
                        <option value="Asia" ${currentFilters.session === 'Asia' ? 'selected' : ''}>Asia</option>
                        <option value="London" ${currentFilters.session === 'London' ? 'selected' : ''}>London</option>
                        <option value="NY Morning" ${currentFilters.session === 'NY Morning' ? 'selected' : ''}>NY Morning</option>
                        <option value="NY Afternoon" ${currentFilters.session === 'NY Afternoon' ? 'selected' : ''}>NY Afternoon</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- 1. INSTITUTIONAL KEY METRICS (CLOSED Trades Only) -->
        <div class="grid-layout" style="margin-bottom: var(--spacing-lg); grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: var(--spacing-md);">
            <div class="card" style="text-align: center; padding: 16px;">
                <div style="color: var(--text-secondary); font-size: 0.74rem; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">Win Rate</div>
                <div class="mono-text" style="font-size: 1.45rem; font-weight: 800; color: ${Number(stats.winRate) >= 50 ? 'var(--color-win)' : 'var(--text-primary)'};">${stats.winRate}%</div>
            </div>
            <div class="card" style="text-align: center; padding: 16px;">
                <div style="color: var(--text-secondary); font-size: 0.74rem; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">Total P&L (Net)</div>
                <div class="mono-text" style="font-size: 1.45rem; font-weight: 800; color: ${Number(stats.totalPnl) >= 0 ? 'var(--color-win)' : 'var(--color-loss)'};">${Number(stats.totalPnl) >= 0 ? '+$' + stats.totalPnl : '-$' + Math.abs(Number(stats.totalPnl)).toFixed(2)}</div>
            </div>
            <div class="card" style="text-align: center; padding: 16px;">
                <div style="color: var(--text-secondary); font-size: 0.74rem; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">Profit Factor</div>
                <div class="mono-text" style="font-size: 1.45rem; font-weight: 800; color: ${Number(stats.profitFactor) >= 1.5 ? 'var(--color-win)' : 'var(--text-primary)'};">${stats.profitFactor}</div>
            </div>
            <div class="card" style="text-align: center; padding: 16px;">
                <div style="color: var(--text-secondary); font-size: 0.74rem; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">Expectancy ($ / R)</div>
                <div class="mono-text" style="font-size: 1.25rem; font-weight: 800; color: ${Number(stats.expectancy) >= 0 ? 'var(--color-win)' : 'var(--color-loss)'};">
                    $${stats.expectancy} <span style="font-size: 0.85rem; color: var(--text-secondary);">(${Number(stats.expectancyR) >= 0 ? '+' : ''}${stats.expectancyR}R)</span>
                </div>
            </div>
            <div class="card" style="text-align: center; padding: 16px;">
                <div style="color: var(--text-secondary); font-size: 0.74rem; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">Max Drawdown</div>
                <div class="mono-text" style="font-size: 1.45rem; font-weight: 800; color: var(--color-loss);">${stats.maxDrawdown}%</div>
            </div>
            <div class="card" style="text-align: center; padding: 16px;">
                <div style="color: var(--text-secondary); font-size: 0.74rem; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">Total Trades Clôturés</div>
                <div class="mono-text" style="font-size: 1.45rem; font-weight: 800; color: var(--text-primary);">${stats.totalTrades}</div>
            </div>
        </div>

        <!-- 2. REAL EQUITY CURVE & MACRO CORRELATION ANALYSIS -->
        <div class="grid-layout" style="grid-template-columns: 2fr 1fr; gap: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
            <!-- Real Equity Curve Line Chart -->
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <h3 style="margin-bottom: 2px;">Courbe d'Équité Réelle (Equity Curve)</h3>
                        <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0;">Évolution de la balance trade après trade (Capital initial : $${INITIAL_CAPITAL.toLocaleString('en-US')})</p>
                    </div>
                    <span class="mono-text" style="font-size: 0.85rem; padding: 4px 10px; border-radius: 6px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: ${Number(stats.totalPnl) >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}; font-weight: 800;">
                        $${currentBalance}
                    </span>
                </div>
                <div style="position: relative; width: 100%; height: 260px;">
                    <canvas id="chart-equity-curve"></canvas>
                </div>
            </div>

            <!-- Macro Correlation Analysis Card -->
            <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <h3 style="margin-bottom: 4px;">Corrélation Biais Macro vs Performance</h3>
                    <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 16px;">
                        Comparaison des trades pris dans le sens de la Watchlist Macro vs Contre-tendance.
                    </p>

                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <!-- Aligned with Macro -->
                        <div style="padding: 12px; border-radius: 8px; background: rgba(0, 230, 118, 0.07); border: 1px solid rgba(0, 230, 118, 0.28);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 0.8rem; font-weight: 800; color: var(--color-win);">🟢 Aligné au Biais Macro</span>
                                <span class="mono-text" style="font-size: 1rem; font-weight: 800; color: var(--color-win);">${mc.alignedWinRate}% WR</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.76rem; color: var(--text-secondary);">
                                <span>${mc.alignedWins} Wins / ${mc.alignedTotal} Trades</span>
                                <span class="mono-text" style="font-weight: 700; color: ${mc.alignedPnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)'};">
                                    ${mc.alignedPnl >= 0 ? '+$' + mc.alignedPnl.toFixed(2) : '-$' + Math.abs(mc.alignedPnl).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <!-- Counter-trend Macro -->
                        <div style="padding: 12px; border-radius: 8px; background: rgba(255, 82, 82, 0.07); border: 1px solid rgba(255, 82, 82, 0.28);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 0.8rem; font-weight: 800; color: var(--color-loss);">🔴 Contre-Tendance Macro</span>
                                <span class="mono-text" style="font-size: 1rem; font-weight: 800; color: var(--color-loss);">${mc.counterWinRate}% WR</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.76rem; color: var(--text-secondary);">
                                <span>${mc.counterWins} Wins / ${mc.counterTotal} Trades</span>
                                <span class="mono-text" style="font-weight: 700; color: ${mc.counterPnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)'};">
                                    ${mc.counterPnl >= 0 ? '+$' + mc.counterPnl.toFixed(2) : '-$' + Math.abs(mc.counterPnl).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <!-- Unspecified / Neutral -->
                        <div style="padding: 10px 12px; border-radius: 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.78rem; color: var(--text-secondary);">⚪ Sans biais / Neutre (${mc.neutralTotal})</span>
                                <span class="mono-text" style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary);">${mc.neutralWinRate}% WR</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-color); font-size: 0.75rem; color: var(--text-secondary);">
                    💡 Armez vos setups depuis <strong>Macro Insights</strong> pour traquer automatiquement l'alignement D1/H4.
                </div>
            </div>
        </div>

        <!-- 3. BREAKDOWN CHARTS GRID (4 Doughnuts) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--spacing-md); margin-bottom: var(--spacing-lg);">
            <div class="card" style="padding: var(--spacing-md); display: flex; flex-direction: column; align-items: center;">
                <h3 style="font-size: 0.88rem; margin-bottom: 12px; color: var(--text-secondary);">Win Rate par Stratégie</h3>
                <div style="position: relative; width: 195px; height: 195px;">
                    <canvas id="chart-strategy"></canvas>
                </div>
            </div>
            <div class="card" style="padding: var(--spacing-md); display: flex; flex-direction: column; align-items: center;">
                <h3 style="font-size: 0.88rem; margin-bottom: 12px; color: var(--text-secondary);">PnL Net par Session ($)</h3>
                <div style="position: relative; width: 195px; height: 195px;">
                    <canvas id="chart-session"></canvas>
                </div>
            </div>
            <div class="card" style="padding: var(--spacing-md); display: flex; flex-direction: column; align-items: center;">
                <h3 style="font-size: 0.88rem; margin-bottom: 12px; color: var(--text-secondary);">Discipline & Psychologie</h3>
                <div style="position: relative; width: 195px; height: 195px;">
                    <canvas id="chart-psycho"></canvas>
                </div>
            </div>
            <div class="card" style="padding: var(--spacing-md); display: flex; flex-direction: column; align-items: center;">
                <h3 style="font-size: 0.88rem; margin-bottom: 12px; color: var(--text-secondary);">Win Rate par Grade</h3>
                <div style="position: relative; width: 195px; height: 195px;">
                    <canvas id="chart-grade"></canvas>
                </div>
            </div>
        </div>

        <!-- 4. REACTIVE TRADE HISTORY TABLE -->
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <h3>Journal des Positions (🟢 OPEN & ⚪ CLOSED)</h3>
                <span style="font-size: 0.78rem; color: var(--text-secondary);">${filteredJournal.length} position(s) affichée(s)</span>
            </div>
            <div style="overflow-x: auto; margin-top: var(--spacing-md);">
                <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 0.86rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase;">
                            <th style="padding: 12px 8px;">Date</th>
                            <th style="padding: 12px 8px;">Statut</th>
                            <th style="padding: 12px 8px;">Paire / Lot</th>
                            <th style="padding: 12px 8px;">Compte / TF</th>
                            <th style="padding: 12px 8px;">Setup</th>
                            <th style="padding: 12px 8px;">Biais Macro</th>
                            <th style="padding: 12px 8px;">Psychologie</th>
                            <th style="padding: 12px 8px;">PnL ($ / R) ou Risque</th>
                            <th style="padding: 12px 8px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredJournal.length > 0 ? tableRows : '<tr><td colspan="9" style="text-align:center; padding: 28px; color: var(--text-secondary);">Aucun trade ne correspond aux filtres sélectionnés.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Initialize logic after DOM injection
    setTimeout(() => {
        // Filter event listeners
        const filterSelects = container.querySelectorAll('.filter-select');
        filterSelects.forEach(select => {
            select.addEventListener('change', () => {
                currentFilters = {
                    status: container.querySelector('#filter-status').value,
                    environment: container.querySelector('#filter-env').value,
                    period: container.querySelector('#filter-period').value,
                    strategy: container.querySelector('#filter-strategy').value,
                    session: container.querySelector('#filter-session').value
                };
                store.notify();
            });
        });

        // Close OPEN trade buttons inside the table
        const closeBtns = container.querySelectorAll('.tracker-close-trade-btn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
                const trade = filteredJournal[idx];
                if (trade) {
                    openCloseTradeModal(trade);
                }
            });
        });

        // Delete buttons
        const deleteBtns = container.querySelectorAll('.delete-trade-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rawId = e.currentTarget.getAttribute('data-id');
                const tradeId = isNaN(Number(rawId)) ? rawId : Number(rawId);
                if (confirm('Voulez-vous vraiment supprimer ce trade ?')) {
                    store.deleteTrade(tradeId);
                    showAppToast('Trade supprimé.');
                }
            });
        });

        // Export Logic (CLOSED trades)
        const exportBtn = container.querySelector('#export-report');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (closedFilteredJournal.length === 0) {
                    showAppToast("Aucun trade clôturé à exporter.", false);
                    return;
                }

                let mdContent = `# Kanzoto Institutional Trading Analytics Report\n\n`;
                mdContent += `## Stats Overview (Closed Trades)\n`;
                mdContent += `- **Win Rate**: ${stats.winRate}%\n`;
                mdContent += `- **Total P&L**: $${stats.totalPnl}\n`;
                mdContent += `- **Expectancy**: $${stats.expectancy} (${stats.expectancyR}R)\n`;
                mdContent += `- **Profit Factor**: ${stats.profitFactor}\n`;
                mdContent += `- **Max Drawdown**: ${stats.maxDrawdown}%\n`;
                mdContent += `- **Total Closed Trades**: ${stats.totalTrades}\n\n`;
                mdContent += `## Trade Logs\n\n`;
                mdContent += `| Date | Ticker | Direction | Lots | Env | Strategy | Macro Bias | Net $ | R |\n`;
                mdContent += `|---|---|---|---|---|---|---|---|---|\n`;

                closedFilteredJournal.forEach(t => {
                    const dateStr = new Date(t.entryDate).toLocaleDateString('fr-FR');
                    mdContent += `| ${dateStr} | ${t.ticker} | ${t.direction} | ${t.lotSize || '-'} | ${t.environment} | ${t.strategy} | ${t.macroDailyBias || '-'} | $${Number(t.netDollar).toFixed(2)} | ${Number(t.realizedR || 0).toFixed(2)}R |\n`;
                });

                const blob = new Blob([mdContent], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Kanzoto_Trading_Report_${new Date().toISOString().split('T')[0]}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        // Draw Equity Curve + Breakdown Charts exclusively from CLOSED trades
        drawCharts(closedFilteredJournal, stats.equityPoints);
    }, 0);

    return container;
}

function drawCharts(trades, equityPoints) {
    if (typeof Chart === 'undefined') return;

    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};

    // 0. Real Equity Curve (Line Chart)
    const eqCtx = document.getElementById('chart-equity-curve');
    if (eqCtx && Array.isArray(equityPoints)) {
        const labels = equityPoints.map(p => p.label);
        const balances = equityPoints.map(p => p.balance);
        const finalBalance = balances[balances.length - 1] ?? INITIAL_CAPITAL;
        const lineColor = finalBalance >= INITIAL_CAPITAL ? '#00E676' : '#FF5252';
        const fillColor = finalBalance >= INITIAL_CAPITAL ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 82, 82, 0.12)';

        chartInstances['chart-equity-curve'] = new Chart(eqCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Balance ($)',
                    data: balances,
                    borderColor: lineColor,
                    backgroundColor: fillColor,
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: lineColor,
                    fill: true,
                    tension: 0.25
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const pt = equityPoints[ctx.dataIndex];
                                if (!pt || ctx.dataIndex === 0) return `Capital Initial : $${INITIAL_CAPITAL}`;
                                const sign = pt.pnl >= 0 ? '+' : '-';
                                return `${pt.ticker} : $${pt.balance.toFixed(2)} (${sign}$${Math.abs(pt.pnl).toFixed(2)} / ${pt.r.toFixed(2)}R)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#a1a1aa', font: { size: 11 } },
                        grid: { color: 'rgba(255,255,255,0.04)' }
                    },
                    y: {
                        ticks: {
                            color: '#a1a1aa',
                            font: { size: 11 },
                            callback: (val) => '$' + Number(val).toLocaleString('en-US')
                        },
                        grid: { color: 'rgba(255,255,255,0.06)' }
                    }
                }
            }
        });
    }

    // 1. Win Rate by Strategy
    const stratStats = {};
    trades.forEach(t => {
        const s = t.strategy || 'Unknown';
        if (!stratStats[s]) stratStats[s] = { w: 0, l: 0 };
        if (t.result === 'Win' || Number(t.netDollar) > 0) stratStats[s].w++;
        else if (t.result === 'Loss' || Number(t.netDollar) < 0) stratStats[s].l++;
    });

    const stratLabels = Object.keys(stratStats);
    const stratData = stratLabels.map(s => {
        const total = stratStats[s].w + stratStats[s].l;
        return total > 0 ? Number(((stratStats[s].w / total) * 100).toFixed(1)) : 0;
    });

    createDoughnutChart('chart-strategy', stratLabels, stratData, 'Win Rate (%)');

    // 2. Performance by Session (Total PnL)
    const sessionStats = {};
    trades.forEach(t => {
        const s = t.session || 'Unknown';
        if (!sessionStats[s]) sessionStats[s] = 0;
        sessionStats[s] += Number(t.netDollar) || 0;
    });

    createDoughnutChart('chart-session', Object.keys(sessionStats), Object.values(sessionStats), 'PnL ($)');

    // 3. Discipline & Psychology (Count)
    const psychoStats = {};
    trades.forEach(t => {
        const p = t.psychology || 'Unknown';
        if (!psychoStats[p]) psychoStats[p] = 0;
        psychoStats[p]++;
    });

    createDoughnutChart('chart-psycho', Object.keys(psychoStats), Object.values(psychoStats), 'Trades');

    // 4. Win Rate by Grade
    const gradeStats = {};
    trades.forEach(t => {
        const g = t.grade || 'Unknown';
        if (!gradeStats[g]) gradeStats[g] = { w: 0, l: 0 };
        if (t.result === 'Win' || Number(t.netDollar) > 0) gradeStats[g].w++;
        else if (t.result === 'Loss' || Number(t.netDollar) < 0) gradeStats[g].l++;
    });

    const gradeLabels = Object.keys(gradeStats);
    const gradeData = gradeLabels.map(g => {
        const total = gradeStats[g].w + gradeStats[g].l;
        return total > 0 ? Number(((gradeStats[g].w / total) * 100).toFixed(1)) : 0;
    });

    createDoughnutChart('chart-grade', gradeLabels, gradeData, 'Win Rate (%)');
}

function createDoughnutChart(canvasId, labels, data, label) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const hasData = labels.length > 0 && data.some(v => Math.abs(Number(v)) > 0);
    const finalLabels = hasData ? labels : ['Aucune donnée'];
    const finalData = hasData ? data.map(v => Math.abs(Number(v))) : [1];
    const finalColors = hasData
        ? ['#00BFA5', '#2962FF', '#00E676', '#FFD600', '#FF5252', '#AA00FF', '#00B8D4']
        : ['#27272a'];

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: finalLabels,
            datasets: [{
                label: label,
                data: finalData,
                backgroundColor: finalColors,
                borderColor: '#121316',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#a1a1aa',
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}
