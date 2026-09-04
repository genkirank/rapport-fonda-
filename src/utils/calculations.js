/**
 * Financial and Date calculations for the trading journal
 */

/**
 * Calculate trade metrics from core inputs
 * @param {Object} rawData - core execution values
 * @param {number} currentBalance - running cumulative account balance
 * @param {number} tradeNumber - incremental trade ID
 * @returns {Object} full 28-field schema record
 */
export function processTradeRecord(rawData, currentBalance, tradeNumber) {
    const entryDate = new Date(rawData.entryDate);
    const exitDate = new Date(rawData.exitDate);
    
    // Time calculations
    const timeDiffMs = exitDate.getTime() - entryDate.getTime();
    const daysDiff = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));
    
    const hours = Math.floor(timeDiffMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    const holdingTime = `${hours}h ${minutes}m`;

    const dayOfWeek = entryDate.toLocaleDateString('en-US', { weekday: 'long' });
    const month = entryDate.toLocaleDateString('en-US', { month: 'long' });
    const year = entryDate.getFullYear();
    const quarter = `Q${Math.floor((entryDate.getMonth() + 3) / 3)}`;

    // Financial calculations
    const riskAmount = Number(rawData.risk);
    const plannedRewardR = Number(rawData.plannedReward);
    const netDollar = Number(rawData.realizedPnl);
    
    const realizedR = riskAmount > 0 ? (netDollar / riskAmount) : 0;
    
    const percentGross = currentBalance > 0 ? (netDollar / currentBalance) * 100 : 0;
    const result = netDollar > 0 ? 'Win' : (netDollar < 0 ? 'Loss' : 'Break Even');
    const progressionNet = currentBalance + netDollar;

    return {
        tradeN: tradeNumber,
        entryDate: entryDate.toISOString(),
        exitDate: exitDate.toISOString(),
        ticker: rawData.ticker.toUpperCase(),
        direction: rawData.direction,
        timeFrame: rawData.timeFrame,
        environment: rawData.environment,
        strategy: rawData.strategy,
        session: rawData.session,
        grade: rawData.grade,
        psychology: rawData.psychology,
        risk: riskAmount,
        plannedReward: plannedRewardR,
        realizedR: realizedR,
        netDollar: netDollar,
        percentGross: percentGross,
        result: result,
        daysDifference: daysDiff,
        holdingTime: holdingTime,
        dayOfWeek: dayOfWeek,
        month: month,
        quarter: quarter,
        year: year,
        progressionNet: progressionNet
    };
}

/**
 * Filter trades based on dashboard filters
 */
export function filterTrades(journal, filters) {
    if (!journal || !filters) return journal || [];
    
    return journal.filter(trade => {
        // Filter by Environment
        if (filters.environment && filters.environment !== 'Tous' && trade.environment !== filters.environment) {
            return false;
        }
        
        // Filter by Strategy
        if (filters.strategy && filters.strategy !== 'Toutes' && trade.strategy !== filters.strategy) {
            return false;
        }

        // Filter by Session
        if (filters.session && filters.session !== 'Toutes' && trade.session !== filters.session) {
            return false;
        }

        // Filter by Period
        if (filters.period && filters.period !== 'Tout') {
            const tradeDate = new Date(trade.entryDate);
            const now = new Date();
            
            if (filters.period === 'Ce Mois') {
                if (tradeDate.getMonth() !== now.getMonth() || tradeDate.getFullYear() !== now.getFullYear()) {
                    return false;
                }
            } else if (filters.period === 'Cette Semaine') {
                // Approximate: within last 7 days
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
 * Calculate aggregate dashboard metrics
 * @param {Array} journal - array of processed trade records
 * @returns {Object} aggregated stats
 */
export function calculateAggregates(journal) {
    if (!journal || journal.length === 0) {
        return {
            totalTrades: 0,
            winRate: 0,
            totalPnl: 0,
            maxDrawdown: 0,
            wins: 0,
            losses: 0,
            expectancy: 0,
            profitFactor: 0
        };
    }

    let wins = 0;
    let losses = 0;
    let totalPnl = 0;
    
    let grossProfit = 0;
    let grossLoss = 0;

    let peakBalance = 0;
    let maxDrawdown = 0;

    const initialBalance = journal[0].progressionNet - journal[0].netDollar;
    peakBalance = initialBalance;

    journal.forEach(trade => {
        if (trade.result === 'Win') {
            wins++;
            grossProfit += trade.netDollar;
        } else if (trade.result === 'Loss') {
            losses++;
            grossLoss += Math.abs(trade.netDollar);
        }
        
        totalPnl += trade.netDollar;
        
        if (trade.progressionNet > peakBalance) {
            peakBalance = trade.progressionNet;
        }
        
        // Calculate max drawdown from peak
        const drawdown = peakBalance > 0 ? ((peakBalance - trade.progressionNet) / peakBalance) * 100 : 0;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    });

    const winRate = (wins / (wins + losses)) * 100 || 0;
    const expectancy = journal.length > 0 ? (totalPnl / journal.length) : 0;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 999 : 0);

    return {
        totalTrades: journal.length,
        winRate: winRate.toFixed(1),
        totalPnl: totalPnl.toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2),
        wins,
        losses,
        expectancy: expectancy.toFixed(2),
        profitFactor: profitFactor.toFixed(2)
    };
}
