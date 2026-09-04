import { calculateAggregates, filterTrades } from '../../utils/calculations.js';
import { store } from '../../state/store.js';

let currentFilters = {
    environment: 'Tous',
    period: 'Tout',
    strategy: 'Toutes',
    session: 'Toutes'
};

let chartInstances = {};

export function renderCalendarGrid(state) {
    const container = document.createElement('div');
    container.className = 'tracker-dashboard';
    
    const journal = state.liveJournal || [];
    const filteredJournal = filterTrades(journal, currentFilters);
    const stats = calculateAggregates(filteredJournal);

    // Build the Calendar grid UI
    let gridHTML = `<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-top: var(--spacing-md);">`;
    for (let i = 0; i < 28; i++) {
        let bgClass = 'bg-tertiary'; 
        let innerClass = '';
        
        if (filteredJournal.length > 0) {
            const trade = filteredJournal[i % filteredJournal.length];
            if (trade && (i < filteredJournal.length)) {
                if (trade.result === 'Win') {
                    bgClass = 'bg-win';
                    innerClass = 'text-win';
                } else if (trade.result === 'Loss') {
                    bgClass = 'bg-loss';
                    innerClass = 'text-loss';
                }
            }
        }

        gridHTML += `
            <div style="aspect-ratio: 1; background-color: ${bgClass === 'bg-tertiary' ? 'var(--bg-tertiary)' : `var(--${bgClass})`}; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4px;">
                <span style="font-size: 0.8rem; color: var(--text-secondary);">${i + 1}</span>
                ${innerClass ? `<span class="${innerClass}" style="font-size: 1.2rem; font-weight: bold; margin-top: 4px;">●</span>` : ''}
            </div>
        `;
    }
    gridHTML += `</div>`;

    // History Table
    let tableRows = filteredJournal.map(t => `
        <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 12px 8px;">${new Date(t.entryDate).toLocaleDateString()}</td>
            <td style="padding: 12px 8px; font-weight: bold;">${t.ticker}</td>
            <td style="padding: 12px 8px;">${t.environment || '-'}</td>
            <td style="padding: 12px 8px;">${t.strategy || '-'}</td>
            <td style="padding: 12px 8px;">${t.session || '-'}</td>
            <td style="padding: 12px 8px;">${t.grade || '-'}</td>
            <td style="padding: 12px 8px;">${t.psychology || '-'}</td>
            <td style="padding: 12px 8px; color: ${t.netDollar > 0 ? 'var(--color-win)' : 'var(--color-loss)'}; font-weight: bold;">$${t.netDollar.toFixed(2)} (${t.realizedR ? t.realizedR.toFixed(2) : 0}R)</td>
            <td style="padding: 12px 8px;">
                <button class="delete-trade-btn" data-id="${t.tradeN}" style="background: none; border: none; color: var(--color-loss); cursor: pointer; font-size: 1.2rem;" title="Delete Trade">🗑️</button>
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="card-header" style="flex-direction: column; align-items: stretch; gap: var(--spacing-md);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2>Visual Tracker & Analytics</h2>
                <button id="export-report" style="background-color: transparent; border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Export Log
                </button>
            </div>

            <!-- GLOBAL FILTERS BAR -->
            <div style="display: flex; gap: var(--spacing-sm); background: var(--bg-tertiary); padding: var(--spacing-sm); border-radius: var(--border-radius-sm); flex-wrap: wrap;">
                <div style="flex: 1; min-width: 150px;">
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Environment</label>
                    <select id="filter-env" class="filter-select" style="width: 100%; padding: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); color: white;">
                        <option value="Tous" ${currentFilters.environment === 'Tous' ? 'selected' : ''}>Tous</option>
                        <option value="Live" ${currentFilters.environment === 'Live' ? 'selected' : ''}>Live</option>
                        <option value="Demo" ${currentFilters.environment === 'Demo' ? 'selected' : ''}>Demo</option>
                        <option value="Backtest" ${currentFilters.environment === 'Backtest' ? 'selected' : ''}>Backtest</option>
                    </select>
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Period</label>
                    <select id="filter-period" class="filter-select" style="width: 100%; padding: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); color: white;">
                        <option value="Tout" ${currentFilters.period === 'Tout' ? 'selected' : ''}>Tout</option>
                        <option value="Ce Mois" ${currentFilters.period === 'Ce Mois' ? 'selected' : ''}>Ce Mois</option>
                        <option value="Cette Semaine" ${currentFilters.period === 'Cette Semaine' ? 'selected' : ''}>Cette Semaine</option>
                    </select>
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Strategy</label>
                    <select id="filter-strategy" class="filter-select" style="width: 100%; padding: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); color: white;">
                        <option value="Toutes" ${currentFilters.strategy === 'Toutes' ? 'selected' : ''}>Toutes</option>
                        <option value="Trend Continuation" ${currentFilters.strategy === 'Trend Continuation' ? 'selected' : ''}>Trend Cont.</option>
                        <option value="Supply & Demand Zone" ${currentFilters.strategy === 'Supply & Demand Zone' ? 'selected' : ''}>Supply/Demand</option>
                        <option value="Liquidity Sweep / SFP" ${currentFilters.strategy === 'Liquidity Sweep / SFP' ? 'selected' : ''}>SFP</option>
                        <option value="Breakout & Retest" ${currentFilters.strategy === 'Breakout & Retest' ? 'selected' : ''}>Breakout</option>
                        <option value="Range Fade / Reversal" ${currentFilters.strategy === 'Range Fade / Reversal' ? 'selected' : ''}>Reversal</option>
                    </select>
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Session</label>
                    <select id="filter-session" class="filter-select" style="width: 100%; padding: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); color: white;">
                        <option value="Toutes" ${currentFilters.session === 'Toutes' ? 'selected' : ''}>Toutes</option>
                        <option value="Asia" ${currentFilters.session === 'Asia' ? 'selected' : ''}>Asia</option>
                        <option value="London" ${currentFilters.session === 'London' ? 'selected' : ''}>London</option>
                        <option value="NY Morning" ${currentFilters.session === 'NY Morning' ? 'selected' : ''}>NY Morning</option>
                        <option value="NY Afternoon" ${currentFilters.session === 'NY Afternoon' ? 'selected' : ''}>NY Afternoon</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Key Metrics -->
        <div class="grid-layout" style="margin-bottom: var(--spacing-lg); grid-template-columns: repeat(6, 1fr);">
            <div class="card-dark" style="text-align: center; padding: 12px;">
                <div style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-bottom: 4px;">Win Rate</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: ${stats.winRate >= 50 ? 'var(--color-win)' : 'white'};">${stats.winRate}%</div>
            </div>
            <div class="card-dark" style="text-align: center; padding: 12px;">
                <div style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-bottom: 4px;">Total P&L</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: ${stats.totalPnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)'};">$${stats.totalPnl}</div>
            </div>
            <div class="card-dark" style="text-align: center; padding: 12px;">
                <div style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-bottom: 4px;">Max Drawdown</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: var(--color-loss);">${stats.maxDrawdown}%</div>
            </div>
            <div class="card-dark" style="text-align: center; padding: 12px;">
                <div style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-bottom: 4px;">Expectancy</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: ${stats.expectancy >= 0 ? 'var(--color-win)' : 'var(--color-loss)'};">$${stats.expectancy}</div>
            </div>
            <div class="card-dark" style="text-align: center; padding: 12px;">
                <div style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-bottom: 4px;">Profit Factor</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: ${stats.profitFactor >= 1.5 ? 'var(--color-win)' : 'white'};">${stats.profitFactor}</div>
            </div>
            <div class="card-dark" style="text-align: center; padding: 12px;">
                <div style="color: rgba(255,255,255,0.6); font-size: 0.8rem; margin-bottom: 4px;">Total Trades</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: white;">${stats.totalTrades}</div>
            </div>
        </div>

        <!-- Charts Grid 2x2 -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); margin-bottom: var(--spacing-lg);">
            <div class="card" style="padding: var(--spacing-md); display: flex; flex-direction: column; align-items: center;">
                <h3 style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-secondary);">Win Rate par Stratégie</h3>
                <div style="position: relative; width: 200px; height: 200px;">
                    <canvas id="chart-strategy"></canvas>
                </div>
            </div>
            <div class="card" style="padding: var(--spacing-md); display: flex; flex-direction: column; align-items: center;">
                <h3 style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-secondary);">Performance par Session</h3>
                <div style="position: relative; width: 200px; height: 200px;">
                    <canvas id="chart-session"></canvas>
                </div>
            </div>
            <div class="card" style="padding: var(--spacing-md); display: flex; flex-direction: column; align-items: center;">
                <h3 style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-secondary);">Discipline & Psychologie</h3>
                <div style="position: relative; width: 200px; height: 200px;">
                    <canvas id="chart-psycho"></canvas>
                </div>
            </div>
            <div class="card" style="padding: var(--spacing-md); display: flex; flex-direction: column; align-items: center;">
                <h3 style="font-size: 0.9rem; margin-bottom: 12px; color: var(--text-secondary);">Win Rate par Grade</h3>
                <div style="position: relative; width: 200px; height: 200px;">
                    <canvas id="chart-grade"></canvas>
                </div>
            </div>
        </div>

        <div class="card" style="margin-bottom: var(--spacing-lg);">
            <h3>P&L Calendar Map</h3>
            ${gridHTML}
        </div>

        <div class="card">
            <h3>Trade History</h3>
            <div style="overflow-x: auto; margin-top: var(--spacing-md);">
                <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-secondary);">
                            <th style="padding: 12px 8px;">Date</th>
                            <th style="padding: 12px 8px;">Ticker</th>
                            <th style="padding: 12px 8px;">Env.</th>
                            <th style="padding: 12px 8px;">Setup</th>
                            <th style="padding: 12px 8px;">Session</th>
                            <th style="padding: 12px 8px;">Grade</th>
                            <th style="padding: 12px 8px;">Psychology</th>
                            <th style="padding: 12px 8px;">PnL ($/R)</th>
                            <th style="padding: 12px 8px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredJournal.length > 0 ? tableRows : '<tr><td colspan="9" style="text-align:center; padding: 20px;">No trades match your filters.</td></tr>'}
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
                    environment: container.querySelector('#filter-env').value,
                    period: container.querySelector('#filter-period').value,
                    strategy: container.querySelector('#filter-strategy').value,
                    session: container.querySelector('#filter-session').value
                };
                // Re-render the view with new filters
                store.notify();
            });
        });

        // Delete buttons
        const deleteBtns = container.querySelectorAll('.delete-trade-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tradeId = parseInt(e.currentTarget.getAttribute('data-id'));
                if (confirm('Voulez-vous vraiment supprimer ce trade ?')) {
                    store.deleteTrade(tradeId);
                }
            });
        });

        // Export Logic
        const exportBtn = container.querySelector('#export-report');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (filteredJournal.length === 0) {
                    alert("No trades match the current filters to export.");
                    return;
                }

                let mdContent = `# Trading Analytics Report\n\n`;
                mdContent += `## Stats Overview (Filtered)\n`;
                mdContent += `- **Win Rate**: ${stats.winRate}%\n`;
                mdContent += `- **Total P&L**: $${stats.totalPnl}\n`;
                mdContent += `- **Expectancy**: $${stats.expectancy}\n`;
                mdContent += `- **Profit Factor**: ${stats.profitFactor}\n`;
                mdContent += `- **Total Trades**: ${stats.totalTrades}\n\n`;
                mdContent += `## Trade Logs\n\n`;
                mdContent += `| Date | Ticker | Env | Strategy | Session | Grade | Net $ |\n`;
                mdContent += `|---|---|---|---|---|---|---|\n`;
                
                filteredJournal.forEach(t => {
                    const dateStr = new Date(t.entryDate).toLocaleDateString();
                    mdContent += `| ${dateStr} | ${t.ticker} | ${t.environment} | ${t.strategy} | ${t.session} | ${t.grade} | $${t.netDollar.toFixed(2)} |\n`;
                });

                const blob = new Blob([mdContent], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Trading_Report_${new Date().toISOString().split('T')[0]}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        // Draw Charts
        drawCharts(filteredJournal);
    }, 0);

    return container;
}

// Chart drawing logic
function drawCharts(trades) {
    if (typeof Chart === 'undefined') return;

    // Helper: destroy old instances
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};

    // 1. Win Rate by Strategy
    const stratStats = {};
    trades.forEach(t => {
        const s = t.strategy || 'Unknown';
        if (!stratStats[s]) stratStats[s] = { w: 0, l: 0 };
        if (t.result === 'Win') stratStats[s].w++;
        else if (t.result === 'Loss') stratStats[s].l++;
    });
    
    const stratLabels = Object.keys(stratStats);
    const stratData = stratLabels.map(s => {
        const total = stratStats[s].w + stratStats[s].l;
        return total > 0 ? (stratStats[s].w / total) * 100 : 0;
    });

    createDoughnutChart('chart-strategy', stratLabels, stratData, 'Win Rate (%)');

    // 2. Performance by Session (Total PnL)
    const sessionStats = {};
    trades.forEach(t => {
        const s = t.session || 'Unknown';
        if (!sessionStats[s]) sessionStats[s] = 0;
        sessionStats[s] += t.netDollar;
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
        if (t.result === 'Win') gradeStats[g].w++;
        else if (t.result === 'Loss') gradeStats[g].l++;
    });

    const gradeLabels = Object.keys(gradeStats);
    const gradeData = gradeLabels.map(g => {
        const total = gradeStats[g].w + gradeStats[g].l;
        return total > 0 ? (gradeStats[g].w / total) * 100 : 0;
    });

    createDoughnutChart('chart-grade', gradeLabels, gradeData, 'Win Rate (%)');
}

function createDoughnutChart(canvasId, labels, data, label) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                backgroundColor: [
                    '#2962FF', '#00BFA5', '#FF3D00', '#FFD600', '#AA00FF', '#00B8D4', '#FF6D00'
                ],
                borderWidth: 0,
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
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}
