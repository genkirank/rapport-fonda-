import { store } from '../../state/store.js';

/**
 * Show a temporary institutional toast notification
 */
export function showAppToast(message, isSuccess = true) {
    const existing = document.querySelector('.custom-toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'custom-toast-notification';
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background-color: #121316;
        color: #f4f4f5;
        padding: 12px 20px;
        border-radius: 10px;
        border: 1px solid ${isSuccess ? '#00e676' : '#ff5252'};
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.75);
        z-index: 10001;
        font-size: 0.88rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    toast.innerHTML = `
        <span style="color: ${isSuccess ? '#00e676' : '#ff5252'}; font-size: 1.1rem; font-weight: bold;">${isSuccess ? '✓' : '⚠️'}</span>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.transform = 'translateY(20px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

/**
 * Open the minimalist Close Trade Modal ([ 🏁 Clôturer le trade ])
 * Transitions an OPEN trade to status: 'CLOSED', calculates realizedR, updates balance & syncs Supabase
 */
export function openCloseTradeModal(trade) {
    if (!trade) return;

    const existingModal = document.getElementById('close-trade-modal-overlay');
    if (existingModal) existingModal.remove();

    const nowLocalISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

    const overlay = document.createElement('div');
    overlay.id = 'close-trade-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.82);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;

    const isLong = trade.direction === 'Long';
    const dirColor = isLong ? 'var(--color-win)' : 'var(--color-loss)';
    const riskAmount = Number(trade.risk) || 0;

    overlay.innerHTML = `
        <div style="background: #121316; border: 1px solid #27272a; border-radius: 16px; width: 100%; max-width: 500px; padding: 24px; box-shadow: 0 24px 64px rgba(0,0,0,0.85); color: #f4f4f5; font-family: var(--font-sans);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #27272a; padding-bottom: 14px;">
                <div>
                    <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-accent); font-weight: 700;">🏁 Clôture de Position Active</span>
                    <h3 style="margin: 4px 0 0 0; font-size: 1.25rem; color: #f4f4f5; display: flex; align-items: center; gap: 10px;">
                        <span>${trade.ticker}</span>
                        <span style="font-size: 0.8rem; padding: 2px 8px; border-radius: 6px; background: ${isLong ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 82, 82, 0.15)'}; color: ${dirColor}; font-weight: 700;">
                            ${trade.direction} ${trade.lotSize ? `• ${trade.lotSize} Lots` : ''}
                        </span>
                    </h3>
                </div>
                <button type="button" id="close-modal-x" style="background: #18181b; border: 1px solid #27272a; color: #a1a1aa; width: 32px; height: 32px; border-radius: 8px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 1rem;">✕</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 10px 12px; margin-bottom: 18px; font-size: 0.8rem;">
                <div>
                    <span style="color: #a1a1aa; display: block; font-size: 0.7rem;">Prix d'Entrée</span>
                    <strong class="mono-text" style="color: #f4f4f5;">${trade.entryPrice != null ? trade.entryPrice : '—'}</strong>
                </div>
                <div>
                    <span style="color: #a1a1aa; display: block; font-size: 0.7rem;">Risque Initial</span>
                    <strong class="mono-text" style="color: #f4f4f5;">$${riskAmount.toFixed(2)} (${Number(trade.riskPct || 1).toFixed(2)}%)</strong>
                </div>
                <div>
                    <span style="color: #a1a1aa; display: block; font-size: 0.7rem;">Stop-Loss</span>
                    <strong class="mono-text" style="color: #f4f4f5;">${trade.stopLoss != null ? trade.stopLoss : '—'}</strong>
                </div>
            </div>

            <form id="close-trade-form" style="display: flex; flex-direction: column; gap: 14px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 6px; font-size: 0.8rem; color: #a1a1aa; font-weight: 600;">Date & Heure de Sortie *</label>
                        <input type="datetime-local" id="modal-exit-date" required value="${nowLocalISO}" style="width: 100%; box-sizing: border-box; background: #18181b; border: 1px solid #27272a; color: #f4f4f5; padding: 10px; border-radius: 8px; font-size: 0.85rem;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 6px; font-size: 0.8rem; color: #a1a1aa; font-weight: 600;">Prix de Sortie Réel</label>
                        <input type="number" id="modal-exit-price" step="any" placeholder="Ex: 1.09120" value="${trade.takeProfit || ''}" style="width: 100%; box-sizing: border-box; background: #18181b; border: 1px solid #27272a; color: #f4f4f5; padding: 10px; border-radius: 8px; font-family: var(--font-mono); font-size: 0.85rem;">
                    </div>
                </div>

                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <label style="font-size: 0.82rem; color: #f4f4f5; font-weight: 700;">PnL Net Réalisé ($) *</label>
                        <span id="modal-live-r-preview" class="mono-text" style="font-size: 0.82rem; color: #a1a1aa; font-weight: 800; padding: 2px 8px; border-radius: 6px; background: #18181b;">0.00 R</span>
                    </div>
                    <input type="number" id="modal-realized-pnl" required step="0.01" placeholder="Ex: 150.00 (ou -50.00 pour une perte)" style="width: 100%; box-sizing: border-box; background: #18181b; border: 1px solid #27272a; color: #f4f4f5; padding: 11px 12px; border-radius: 8px; font-weight: 800; font-size: 0.95rem; font-family: var(--font-mono);">
                </div>

                <div>
                    <label style="display: block; margin-bottom: 6px; font-size: 0.8rem; color: #a1a1aa; font-weight: 600;">Évaluation de la Discipline</label>
                    <select id="modal-psychology" style="width: 100%; box-sizing: border-box; background: #18181b; border: 1px solid #27272a; color: #f4f4f5; padding: 10px 12px; border-radius: 8px; font-weight: 600;">
                        <option value="Respect du Plan 🟢" ${trade.psychology === 'Respect du Plan 🟢' ? 'selected' : ''}>Respect du Plan 🟢</option>
                        <option value="Sortie Anticipée 🟠" ${trade.psychology === 'Sortie Anticipée 🟠' ? 'selected' : ''}>Sortie Anticipée 🟠</option>
                        <option value="FOMO / Erreur 🔴" ${trade.psychology && trade.psychology.includes('FOMO') ? 'selected' : ''}>FOMO / Erreur 🔴</option>
                    </select>
                </div>

                <div>
                    <label style="display: block; margin-bottom: 6px; font-size: 0.8rem; color: #a1a1aa; font-weight: 600;">Note rapide / Leçon apprise (Optionnel)</label>
                    <textarea id="modal-lessons" rows="2" placeholder="Ex: Bonne exécution sur pullback H4, sortie partielle sur Londres..." style="width: 100%; box-sizing: border-box; background: #18181b; border: 1px solid #27272a; color: #f4f4f5; padding: 10px 12px; border-radius: 8px; font-size: 0.85rem; resize: vertical;">${trade.lessons || ''}</textarea>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; padding-top: 14px; border-top: 1px solid #27272a;">
                    <button type="button" id="close-modal-cancel" style="background: #18181b; border: 1px solid #27272a; color: #a1a1aa; padding: 10px 16px; border-radius: 8px; font-weight: 600;">Annuler</button>
                    <button type="submit" style="background: var(--color-win); color: #052623; padding: 10px 22px; border-radius: 8px; font-weight: 800; box-shadow: 0 4px 14px rgba(0, 230, 118, 0.3);">
                        🏁 Valider la Clôture (CLOSED)
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.querySelector('#close-modal-x').addEventListener('click', closeModal);
    overlay.querySelector('#close-modal-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    const pnlInput = overlay.querySelector('#modal-realized-pnl');
    const rPreview = overlay.querySelector('#modal-live-r-preview');
    const psychoSelect = overlay.querySelector('#modal-psychology');

    pnlInput.focus();

    pnlInput.addEventListener('input', () => {
        const val = parseFloat(pnlInput.value);
        if (isNaN(val)) {
            rPreview.textContent = '0.00 R';
            rPreview.style.color = '#a1a1aa';
            return;
        }
        const r = riskAmount > 0 ? (val / riskAmount) : 0;
        const sign = r > 0 ? '+' : '';
        rPreview.textContent = `${sign}${r.toFixed(2)} R (${val >= 0 ? '+$' + val.toFixed(2) : '-$' + Math.abs(val).toFixed(2)})`;
        rPreview.style.color = val > 0 ? 'var(--color-win)' : (val < 0 ? 'var(--color-loss)' : '#a1a1aa');
    });

    overlay.querySelector('#close-trade-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const exitDate = overlay.querySelector('#modal-exit-date').value;
        const exitPrice = overlay.querySelector('#modal-exit-price').value;
        const realizedPnl = parseFloat(pnlInput.value);
        const psychology = psychoSelect.value;
        const lessons = overlay.querySelector('#modal-lessons').value.trim();
        const rulesRespected = !psychology.includes('FOMO') && !psychology.includes('Erreur');

        if (isNaN(realizedPnl)) {
            pnlInput.focus();
            return;
        }

        const tradeKey = trade.tradeN ?? trade.cloudId;
        store.closeTrade(tradeKey, {
            exitDate,
            exitPrice,
            realizedPnl,
            psychology,
            rulesRespected,
            lessons
        });

        closeModal();
        showAppToast(`Trade ${trade.ticker} clôturé (${realizedPnl >= 0 ? '+$' + realizedPnl.toFixed(2) : '-$' + Math.abs(realizedPnl).toFixed(2)}) et archivé dans Visual Tracker !`);
    });
}
