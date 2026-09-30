/**
 * Institutional Financial, MT5 Position Sizing, Macro Matrix & Analytics Engine
 */

export const INITIAL_CAPITAL = 10000;
const G10_ORDER = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY'];

/**
 * Determine if a trade direction aligns with a Macro Bias ('Bullish' | 'Bearish' | 'Neutral')
 */
export function computeMacroAlignment(direction, dailyBias, fourHourBias) {
    const primaryBias = (dailyBias && dailyBias !== 'Neutral' && dailyBias !== 'Non défini')
        ? dailyBias
        : (fourHourBias && fourHourBias !== 'Neutral' && fourHourBias !== 'Non défini' ? fourHourBias : null);

    if (!primaryBias) return null;
    if (direction === 'Long' && primaryBias === 'Bullish') return true;
    if (direction === 'Short' && primaryBias === 'Bearish') return true;
    return false;
}

/**
 * Dynamic Currency Strength Matrix & Top Macro Arbitrage generator
 */
export function computeCurrencyStrengthMatrix(currencyPerformance = []) {
    const safeList = Array.isArray(currencyPerformance) && currencyPerformance.length > 0
        ? currencyPerformance.filter(item => item && typeof item === 'object')
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

    const sorted = safeList
        .map(item => ({
            currency: String((item && item.currency) || 'USD').toUpperCase(),
            value: Number(parseFloat(item && item.value) || 0)
        }))
        .sort((a, b) => b.value - a.value);

    const strongest = sorted[0] || { currency: 'USD', value: 0 };
    const weakest = sorted[sorted.length - 1] || { currency: 'CHF', value: 0 };

    // Build canonical market pair convention (EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY)
    const idxStrong = G10_ORDER.indexOf(strongest.currency);
    const idxWeak = G10_ORDER.indexOf(weakest.currency);

    let canonicalPair = `${strongest.currency}/${weakest.currency}`;
    let canonicalDirection = 'Long';
    let canonicalBias = 'Bullish';

    if (idxStrong !== -1 && idxWeak !== -1 && idxStrong > idxWeak) {
        canonicalPair = `${weakest.currency}/${strongest.currency}`;
        canonicalDirection = 'Short';
        canonicalBias = 'Bearish';
    }

    return {
        sorted,
        strongest,
        weakest,
        spread: Number((strongest.value - weakest.value).toFixed(2)),
        canonicalPair,
        canonicalDirection,
        canonicalBias,
        directPair: `${strongest.currency}/${weakest.currency}`,
        inversePair: `${weakest.currency}/${strongest.currency}`
    };
}

/**
 * Calculate live global risk exposure across all currently OPEN trades
 */
export function computeGlobalExposure(journal = [], currentBalance = 10000) {
    const safeJournal = Array.isArray(journal) ? journal.filter(Boolean) : [];
    const openTrades = safeJournal.filter(t => !isTradeClosed(t));
    const balanceBase = Number(currentBalance) > 0 ? Number(currentBalance) : 10000;

    let totalRiskUsd = 0;
    let totalRiskPct = 0;

    openTrades.forEach(t => {
        if (!t) return;
        const rUsd = Number(t.risk) || 0;
        const rPct = t.riskPct != null ? Number(t.riskPct) : (balanceBase > 0 ? (rUsd / balanceBase) * 100 : 0);
        totalRiskUsd += rUsd;
        totalRiskPct += rPct;
    });

    const maxAllowedPct = 2.0;
    return {
        openCount: openTrades.length,
        totalRiskUsd: Number(totalRiskUsd.toFixed(2)),
        totalRiskPct: Number(totalRiskPct.toFixed(2)),
        maxAllowedPct,
        isOverExposed: totalRiskPct > maxAllowedPct
    };
}

/**
 * Real-time MT5 Lot Size & Pip Distance Calculator
 * Formula: Lots = Risk ($) / (Distance Pips * Standard Pip Value per Lot)
 */
export function calculateMt5LotSize({ ticker = 'EUR/USD', entryPrice, stopLoss, takeProfit, riskUsd }) {
    const cleanTicker = String(ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    const risk = parseFloat(riskUsd);

    if (isNaN(entry) || isNaN(sl) || entry <= 0 || sl <= 0 || entry === sl) {
        return {
            valid: false,
            pips: 0,
            lots: 0,
            pipSize: 0.0001,
            pipValuePerLot: 10,
            rrRatio: null
        };
    }

    // Determine pip size & standard pip value per 1.00 lot
    let pipSize = 0.0001;
    let pipValuePerLot = 10; // Default $10 per pip per standard lot (100k units)

    if (cleanTicker.includes('JPY')) {
        pipSize = 0.01;
        // 100,000 * 0.01 = 1,000 JPY per pip -> convert to USD
        pipValuePerLot = entry > 50 ? (1000 / entry) : 9.1;
    } else if (cleanTicker.includes('XAU') || cleanTicker.includes('GOLD')) {
        pipSize = 0.1;
        pipValuePerLot = 10; // 100 oz contract * $0.10 = $10/pip
    } else if (cleanTicker.includes('XAG') || cleanTicker.includes('SILVER')) {
        pipSize = 0.01;
        pipValuePerLot = 50;
    } else if (
        cleanTicker.includes('BTC') ||
        cleanTicker.includes('ETH') ||
        cleanTicker.includes('NAS') ||
        cleanTicker.includes('US30') ||
        cleanTicker.includes('SPX') ||
        cleanTicker.includes('GER') ||
        cleanTicker.includes('DAX')
    ) {
        pipSize = 1.0;
        pipValuePerLot = 1.0;
    }

    const priceDiff = Math.abs(entry - sl);
    const pips = priceDiff / pipSize;
    const lots = (!isNaN(risk) && risk > 0 && pips > 0 && pipValuePerLot > 0)
        ? risk / (pips * pipValuePerLot)
        : 0;

    let rrRatio = null;
    if (!isNaN(tp) && tp > 0 && priceDiff > 0) {
        rrRatio = Number((Math.abs(tp - entry) / priceDiff).toFixed(2));
    }

    return {
        valid: true,
        pips: Number(pips.toFixed(1)),
        lots: Number(Math.max(0.01, lots).toFixed(2)),
        rawLots: Number(lots.toFixed(3)),
        pipSize,
        pipValuePerLot: Number(pipValuePerLot.toFixed(2)),
        rrRatio
    };
}

/**
 * Helper to check if a trade is CLOSED (handles legacy records without explicit status)
 */
export function isTradeClosed(trade) {
    if (!trade) return false;
    if (trade.status === 'OPEN') return false;
    if (trade.status === 'CLOSED') return true;
    return Boolean(trade.exitDate && trade.exitDate !== 'null' && trade.exitDate !== 'undefined' && trade.result !== 'Open');
}

/**
 * Calculate trade metrics from core inputs (supports both OPEN and CLOSED positions)
 */
export function processTradeRecord(rawData, currentBalance, tradeNumber) {
    const entryDate = rawData.entryDate ? new Date(rawData.entryDate) : new Date();
    const hasExitDate = Boolean(rawData.exitDate && String(rawData.exitDate).trim() !== '');
    const hasRealizedPnl = rawData.realizedPnl !== undefined && rawData.realizedPnl !== null && String(rawData.realizedPnl).trim() !== '';
    const isClosed = rawData.status === 'CLOSED' || (rawData.status !== 'OPEN' && hasExitDate && hasRealizedPnl);
    const status = isClosed ? 'CLOSED' : 'OPEN';

    const dayOfWeek = entryDate.toLocaleDateString('en-US', { weekday: 'long' });
    const month = entryDate.toLocaleDateString('en-US', { month: 'long' });
    const year = entryDate.getFullYear();
    const quarter = `Q${Math.floor((entryDate.getMonth() + 3) / 3)}`;

    const balanceBase = Number(currentBalance) > 0 ? Number(currentBalance) : 10000;
    let riskAmount = 0;
    let riskPct = 0;

    if (rawData.riskUnit === '%') {
        riskPct = Number(rawData.risk) || 0;
        riskAmount = Number(((balanceBase * riskPct) / 100).toFixed(2));
    } else {
        riskAmount = Number(rawData.risk) || 0;
        riskPct = rawData.riskPct != null
            ? Number(rawData.riskPct)
            : Number(((riskAmount / balanceBase) * 100).toFixed(2));
    }

    const entryPrice = rawData.entryPrice !== undefined && rawData.entryPrice !== null && String(rawData.entryPrice).trim() !== ''
        ? Number(rawData.entryPrice)
        : null;
    const stopLoss = rawData.stopLoss !== undefined && rawData.stopLoss !== null && String(rawData.stopLoss).trim() !== ''
        ? Number(rawData.stopLoss)
        : null;
    const takeProfit = rawData.takeProfit !== undefined && rawData.takeProfit !== null && String(rawData.takeProfit).trim() !== ''
        ? Number(rawData.takeProfit)
        : null;
    const exitPrice = rawData.exitPrice !== undefined && rawData.exitPrice !== null && String(rawData.exitPrice).trim() !== ''
        ? Number(rawData.exitPrice)
        : null;

    // Calculate MT5 Lot Size & Pips if entry & SL are provided
    const sizing = calculateMt5LotSize({
        ticker: rawData.ticker,
        entryPrice,
        stopLoss,
        takeProfit,
        riskUsd: riskAmount
    });

    const lotSize = rawData.lotSize != null && String(rawData.lotSize).trim() !== ''
        ? Number(rawData.lotSize)
        : (sizing.valid ? sizing.lots : null);
    const stopLossPips = sizing.valid ? sizing.pips : null;
    const plannedRewardR = rawData.plannedReward != null && String(rawData.plannedReward).trim() !== ''
        ? Number(rawData.plannedReward)
        : (sizing.rrRatio || 2.0);

    const rulesRespected = rawData.rulesRespected !== undefined
        ? Boolean(rawData.rulesRespected)
        : (!rawData.psychology || !String(rawData.psychology).includes('FOMO'));

    const macroDailyBias = rawData.macroDailyBias || 'Non défini';
    const macro4hBias = rawData.macro4hBias || 'Non défini';
    const macroAligned = rawData.macroAligned !== undefined
        ? rawData.macroAligned
        : computeMacroAlignment(rawData.direction, macroDailyBias, macro4hBias);

    const baseRecord = {
        tradeN: tradeNumber,
        status,
        entryDate: entryDate.toISOString(),
        exitDate: null,
        ticker: (rawData.ticker || '').toUpperCase(),
        direction: rawData.direction || 'Long',
        timeFrame: rawData.timeFrame || '1H',
        environment: rawData.environment || 'Live',
        strategy: rawData.strategy || '',
        session: rawData.session || '',
        grade: rawData.grade || 'Setup A+ (Parfait)',
        psychology: rawData.psychology || (rulesRespected ? 'Respect du Plan 🟢' : 'FOMO / Erreur 🔴'),
        rulesRespected,
        entryPrice,
        stopLoss,
        takeProfit,
        exitPrice,
        lotSize,
        stopLossPips,
        risk: riskAmount,
        riskPct,
        plannedReward: plannedRewardR,
        lessons: rawData.lessons || '',
        macroDailyBias,
        macro4hBias,
        macroAligned,
        dayOfWeek,
        month,
        quarter,
        year
    };

    if (status === 'OPEN') {
        return {
            ...baseRecord,
            realizedR: 0,
            netDollar: 0,
            percentGross: 0,
            result: 'Open',
            daysDifference: 0,
            holdingTime: 'En cours',
            progressionNet: balanceBase
        };
    }

    const exitDate = hasExitDate ? new Date(rawData.exitDate) : new Date();
    const timeDiffMs = Math.max(0, exitDate.getTime() - entryDate.getTime());
    const daysDiff = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(timeDiffMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    const holdingTime = `${hours}h ${minutes}m`;

    const netDollar = Number(rawData.realizedPnl) || 0;
    const realizedR = riskAmount > 0 ? Number((netDollar / riskAmount).toFixed(2)) : 0;
    const percentGross = balanceBase > 0 ? Number(((netDollar / balanceBase) * 100).toFixed(2)) : 0;
    const result = netDollar > 0 ? 'Win' : (netDollar < 0 ? 'Loss' : 'Break Even');
    const progressionNet = Number((balanceBase + netDollar).toFixed(2));

    return {
        ...baseRecord,
        exitDate: exitDate.toISOString(),
        realizedR,
        netDollar,
        percentGross,
        result,
        daysDifference: daysDiff,
        holdingTime,
        progressionNet
    };
}

/**
 * Transition an existing OPEN trade to CLOSED with final execution metrics
 */
export function closeTradeRecord(trade, closeData, currentBalance) {
    const entryDate = new Date(trade.entryDate);
    const exitDate = closeData.exitDate ? new Date(closeData.exitDate) : new Date();
    const timeDiffMs = Math.max(0, exitDate.getTime() - entryDate.getTime());
    const daysDiff = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(timeDiffMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    const holdingTime = `${hours}h ${minutes}m`;

    const balanceBase = Number(currentBalance) > 0 ? Number(currentBalance) : 10000;
    const riskAmount = Number(trade.risk) || 0;
    const netDollar = Number(closeData.realizedPnl) || 0;
    const realizedR = riskAmount > 0 ? Number((netDollar / riskAmount).toFixed(2)) : 0;
    const percentGross = balanceBase > 0 ? Number(((netDollar / balanceBase) * 100).toFixed(2)) : 0;
    const result = netDollar > 0 ? 'Win' : (netDollar < 0 ? 'Loss' : 'Break Even');

    const exitPrice = closeData.exitPrice !== undefined && closeData.exitPrice !== null && String(closeData.exitPrice).trim() !== ''
        ? Number(closeData.exitPrice)
        : trade.exitPrice ?? null;

    const psychology = closeData.psychology || trade.psychology || 'Respect du Plan 🟢';
    const rulesRespected = closeData.rulesRespected !== undefined
        ? Boolean(closeData.rulesRespected)
        : !String(psychology).includes('FOMO');
    const lessons = closeData.lessons !== undefined ? closeData.lessons : (trade.lessons || '');

    return {
        ...trade,
        status: 'CLOSED',
        exitDate: exitDate.toISOString(),
        exitPrice,
        psychology,
        rulesRespected,
        lessons,
        realizedR,
        netDollar,
        percentGross,
        result,
        daysDifference: daysDiff,
        holdingTime,
        progressionNet: Number((balanceBase + netDollar).toFixed(2))
    };
}

/**
 * Recalculate running progressionNet across the entire journal
 */
export function recalculateProgression(journal, initialCapital = 10000) {
    let runningBalance = Number(initialCapital) || 10000;
    return (journal || []).map((t, index) => {
        const closed = isTradeClosed(t);
        if (closed) {
            runningBalance = Number((runningBalance + (Number(t.netDollar) || 0)).toFixed(2));
        }
        return {
            ...t,
            tradeN: t.tradeN || index + 1,
            status: closed ? 'CLOSED' : 'OPEN',
            progressionNet: runningBalance
        };
    });
}

/**
 * Filter trades based on dashboard filters
 */
export function filterTrades(journal, filters) {
    if (!journal || !filters) return journal || [];
    
    return journal.filter(trade => {
        if (filters.status && filters.status !== 'Tous') {
            const closed = isTradeClosed(trade);
            if (filters.status === 'OPEN' && closed) return false;
            if (filters.status === 'CLOSED' && !closed) return false;
        }

        if (filters.environment && filters.environment !== 'Tous' && trade.environment !== filters.environment) {
            return false;
        }
        
        if (filters.strategy && filters.strategy !== 'Toutes' && trade.strategy !== filters.strategy) {
            return false;
        }

        if (filters.session && filters.session !== 'Toutes' && trade.session !== filters.session) {
            return false;
        }

        if (filters.period && filters.period !== 'Tout') {
            const tradeDate = new Date(trade.entryDate);
            const now = new Date();
            
            if (filters.period === 'Ce Mois') {
                if (tradeDate.getMonth() !== now.getMonth() || tradeDate.getFullYear() !== now.getFullYear()) {
                    return false;
                }
            } else if (filters.period === 'Cette Semaine') {
                const diffTime = Math.abs(now - tradeDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays > 7) {
                    return false;
                }
            }
        }

        return true;
    });
}

/**
 * Calculate institutional dashboard metrics, Equity Curve & Macro Correlation (exclusively on CLOSED trades)
 */
export function calculateAggregates(journal, initialCapital = 10000) {
    const closedJournal = (journal || []).filter(isTradeClosed);
    const startCap = Number(initialCapital) > 0 ? Number(initialCapital) : 10000;

    const equityPoints = [
        {
            label: 'Initial',
            balance: startCap,
            pnl: 0,
            ticker: 'Capital Initial',
            date: null
        }
    ];

    const macroCorrelation = {
        alignedWins: 0,
        alignedTotal: 0,
        alignedPnl: 0,
        alignedWinRate: '0.0',
        counterWins: 0,
        counterTotal: 0,
        counterPnl: 0,
        counterWinRate: '0.0',
        neutralWins: 0,
        neutralTotal: 0,
        neutralPnl: 0,
        neutralWinRate: '0.0'
    };

    if (closedJournal.length === 0) {
        return {
            totalTrades: 0,
            openTradesCount: (journal || []).length,
            winRate: '0.0',
            totalPnl: '0.00',
            totalR: '0.00',
            maxDrawdown: '0.00',
            wins: 0,
            losses: 0,
            expectancy: '0.00',
            expectancyR: '0.00',
            profitFactor: '0.00',
            currentEquity: startCap.toFixed(2),
            equityPoints,
            macroCorrelation
        };
    }

    let wins = 0;
    let losses = 0;
    let totalPnl = 0;
    let totalR = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    let peakBalance = startCap;
    let maxDrawdown = 0;
    let runningEquity = startCap;

    closedJournal.forEach((trade, idx) => {
        const pnl = Number(trade.netDollar) || 0;
        const rMult = Number(trade.realizedR) || (Number(trade.risk) > 0 ? pnl / Number(trade.risk) : 0);
        const isWin = trade.result === 'Win' || pnl > 0;
        const isLoss = trade.result === 'Loss' || pnl < 0;

        if (isWin) {
            wins++;
            grossProfit += pnl;
        } else if (isLoss) {
            losses++;
            grossLoss += Math.abs(pnl);
        }
        
        totalPnl += pnl;
        totalR += rMult;
        runningEquity = Number((runningEquity + pnl).toFixed(2));
        
        if (runningEquity > peakBalance) {
            peakBalance = runningEquity;
        }
        
        const drawdown = peakBalance > 0 ? ((peakBalance - runningEquity) / peakBalance) * 100 : 0;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }

        equityPoints.push({
            label: `#${idx + 1} ${trade.ticker}`,
            balance: runningEquity,
            pnl: Number(pnl.toFixed(2)),
            r: Number(rMult.toFixed(2)),
            ticker: trade.ticker,
            date: trade.exitDate || trade.entryDate
        });

        // Macro correlation tracking
        const aligned = trade.macroAligned !== undefined
            ? trade.macroAligned
            : computeMacroAlignment(trade.direction, trade.macroDailyBias, trade.macro4hBias);

        if (aligned === true) {
            macroCorrelation.alignedTotal++;
            macroCorrelation.alignedPnl += pnl;
            if (isWin) macroCorrelation.alignedWins++;
        } else if (aligned === false) {
            macroCorrelation.counterTotal++;
            macroCorrelation.counterPnl += pnl;
            if (isWin) macroCorrelation.counterWins++;
        } else {
            macroCorrelation.neutralTotal++;
            macroCorrelation.neutralPnl += pnl;
            if (isWin) macroCorrelation.neutralWins++;
        }
    });

    macroCorrelation.alignedWinRate = macroCorrelation.alignedTotal > 0
        ? ((macroCorrelation.alignedWins / macroCorrelation.alignedTotal) * 100).toFixed(1)
        : '0.0';
    macroCorrelation.counterWinRate = macroCorrelation.counterTotal > 0
        ? ((macroCorrelation.counterWins / macroCorrelation.counterTotal) * 100).toFixed(1)
        : '0.0';
    macroCorrelation.neutralWinRate = macroCorrelation.neutralTotal > 0
        ? ((macroCorrelation.neutralWins / macroCorrelation.neutralTotal) * 100).toFixed(1)
        : '0.0';

    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
    const expectancy = closedJournal.length > 0 ? (totalPnl / closedJournal.length) : 0;
    const expectancyR = closedJournal.length > 0 ? (totalR / closedJournal.length) : 0;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99.99 : 0);

    return {
        totalTrades: closedJournal.length,
        openTradesCount: (journal || []).length - closedJournal.length,
        winRate: winRate.toFixed(1),
        totalPnl: totalPnl.toFixed(2),
        totalR: totalR.toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2),
        wins,
        losses,
        expectancy: expectancy.toFixed(2),
        expectancyR: expectancyR.toFixed(2),
        profitFactor: profitFactor.toFixed(2),
        currentEquity: runningEquity.toFixed(2),
        equityPoints,
        macroCorrelation
    };
}
