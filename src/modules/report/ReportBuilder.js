import { store } from '../../state/store.js';
import { isTradeClosed } from '../../utils/calculations.js';

export function buildDashboardSyncPayload(state = {}) {
    const safeState = state && typeof state === 'object' ? state : store.getState();
    const journal = Array.isArray(safeState.liveJournal) ? safeState.liveJournal.filter(Boolean) : [];
    const closedTrades = journal
        .filter(t => t.status === 'CLOSED' || isTradeClosed(t))
        .map(t => {
            const pnlVal = Number(t.netDollar ?? t.pnl ?? t.pnl_usd ?? t.realizedPnl ?? 0) || 0;
            const riskVal = Number(t.risk ?? t.risk_usd ?? 0) || 0;
            const rVal = t.realizedR != null && t.realizedR !== 0
                ? Number(t.realizedR)
                : (riskVal > 0 ? Number((pnlVal / riskVal).toFixed(2)) : 0);
            return {
                ...t,
                netDollar: pnlVal,
                pnl: pnlVal,
                pnl_usd: pnlVal,
                realizedPnl: pnlVal,
                realizedR: rVal
            };
        });

    return {
        type: 'SYNC_DASHBOARD_DATA',
        payload: {
            currencyPerformance: Array.isArray(safeState.currencyPerformance) ? safeState.currencyPerformance : [],
            centralBanks: Array.isArray(safeState.centralBanks) ? safeState.centralBanks : [],
            watchlist: Array.isArray(safeState.watchlist) ? safeState.watchlist : [],
            fearGreed: safeState.fearGreed || { value: 24, classification: 'Extreme Fear' },
            closedTrades,
            allClosedTradesCount: closedTrades.length,
            syncedAt: new Date().toISOString()
        }
    };
}

export function syncReportIframe(state, targetIframe = null) {
    const iframe = targetIframe || document.querySelector('#report-editor-iframe');
    if (!iframe || !iframe.contentWindow) return;

    const currentState = state || store.getState();
    if (currentState && currentState.user) {
        iframe.contentWindow.postMessage({
            type: 'SYNC_AUTH_USER',
            user: { id: currentState.user.id, email: currentState.user.email }
        }, '*');
    }

    const syncMsg = buildDashboardSyncPayload(currentState);
    iframe.contentWindow.postMessage(syncMsg, '*');
}

export function renderReportBuilder(state) {
    const container = document.createElement('div');
    container.className = 'report-dashboard';
    container.style.width = '100%';
    container.style.height = 'calc(100vh - 32px)';
    container.style.overflow = 'hidden';
    
    // Standalone report editor HTML via iframe aligned with Zinc Dark (#09090b)
    container.innerHTML = `
        <iframe 
            id="report-editor-iframe"
            src="/report.html" 
            style="width: 100%; height: 100%; border: 1px solid #27272a; border-radius: 14px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55); background: #09090b;" 
            title="Éditeur de Rapport">
        </iframe>
    `;

    const iframe = container.querySelector('#report-editor-iframe');
    if (iframe) {
        iframe.addEventListener('load', () => {
            syncReportIframe(store.getState(), iframe);
        });
    }

    return container;
}

