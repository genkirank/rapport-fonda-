export function generateReportHTML(data) {
    const { 
        mode, 
        title, 
        date, 
        fearGreed, 
        macroImg, 
        currencyBlocks, 
        dailyThematics, 
        calendarEvents, 
        tradingPlans,
        weeklyMacroSummary,
        weeklyCentralBanks,
        weeklyFxPerformance,
        weeklyWatchlist
    } = data;
    
    const proxiedUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http') && !url.includes('api.allorigins.win')) {
            return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        }
        return url;
    };
    
    const renderImage = (url, alt) => {
        if (!url) return '';
        const safeUrl = proxiedUrl(url);
        const crossOrigin = safeUrl.startsWith('http') ? 'crossorigin="anonymous"' : '';
        return `<img src="${safeUrl}" ${crossOrigin} alt="${alt}" style="max-height: 100%; max-width: 100%; object-fit: contain;" />`;
    };
    
    const safeMacroImg = proxiedUrl(macroImg);
    
    let html = `
        <div class="pdf-template-container" id="pdf-content" style="display:none;">
    `;
    
    if (mode === 'Daily') {
        // PAGE 1: Daily Briefing Thematics
        html += `
            <div class="pdf-page">
                <div class="pdf-header">
                    <h1>${title || 'Kanzoto Market Report'}</h1>
                    <p>Daily Financial Briefing | ${date}</p>
                </div>
                
                <div class="pdf-section">
                    <h2>Daily Fundamental Briefing</h2>
                    <div class="pdf-thematics">
                        <div class="pdf-thematic-card">
                            <h3>1. Macroeconomics</h3>
                            <p>${(dailyThematics && dailyThematics.macro) ? dailyThematics.macro : 'No macroeconomic updates for today.'}</p>
                        </div>
                        <div class="pdf-thematic-card">
                            <h3>2. Geopolitics</h3>
                            <p>${(dailyThematics && dailyThematics.geopolitics) ? dailyThematics.geopolitics : 'No geopolitical updates for today.'}</p>
                        </div>
                        <div class="pdf-thematic-card">
                            <h3>3. Micro & Sentiment</h3>
                            <p>${(dailyThematics && dailyThematics.sentiment) ? dailyThematics.sentiment : 'No micro & sentiment updates for today.'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- PAGE 2: Economic Calendar & Trading Plan Matrix -->
            <div class="pdf-page">
                <div class="pdf-header">
                    <h1>${title || 'Kanzoto Market Report'}</h1>
                    <p>Today's Playbook | ${date}</p>
                </div>
                
                <div class="pdf-section">
                    <h2>Today's Economic Calendar</h2>
                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th style="width: 8%;">Time</th>
                                <th style="width: 10%;">Currency</th>
                                <th>Event</th>
                                <th style="width: 12%;">Importance</th>
                                <th style="width: 9%;">Previous</th>
                                <th style="width: 9%;">Consensus</th>
                                <th style="width: 9%;">Actual</th>
                                <th style="width: 15%;">Rec</th>
                                <th style="width: 18%;">Conclusion</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(!calendarEvents || calendarEvents.length === 0) ? `
                                <tr>
                                    <td colspan="9" style="text-align: center; color: #8a939f; padding: 20px 0;">No economic events scheduled.</td>
                                </tr>
                            ` : (calendarEvents || []).map(e => {
                                let impBadge = '';
                                if (e.importance === 'High' || e.importance === 'Red') {
                                    impBadge = '<span class="badge badge-red">High</span>';
                                } else if (e.importance === 'Medium' || e.importance === 'Orange') {
                                    impBadge = '<span class="badge badge-orange">Medium</span>';
                                } else {
                                    impBadge = '<span class="badge badge-yellow">Low</span>';
                                }
                                
                                return `
                                    <tr>
                                        <td class="mono-text" style="font-family: var(--font-mono);">${e.time || '--:--'}</td>
                                        <td><strong>${e.currency}</strong></td>
                                        <td>${e.eventName || ''}</td>
                                        <td>${impBadge}</td>
                                        <td class="mono-text" style="font-family: var(--font-mono);">${e.previous || '-'}</td>
                                        <td class="mono-text" style="font-family: var(--font-mono);">${e.consensus || '-'}</td>
                                        <td class="mono-text" style="font-family: var(--font-mono);">${e.actual || '-'}</td>
                                        <td style="font-size: 11.5px; color: #26a69a; font-weight: bold; line-height: 1.3;">${e.rec || '-'}</td>
                                        <td style="font-size: 11.5px; color: #d1d4dc; line-height: 1.3;">${e.conclusion || '-'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="pdf-section" style="margin-top: 10mm;">
                    <h2>Trading Plan Matrix</h2>
                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th style="width: 15%;">Asset</th>
                                <th style="width: 15%;">Bias</th>
                                <th style="width: 15%;">Key Support</th>
                                <th style="width: 15%;">Key Resistance</th>
                                <th>Entry Plan / Trigger Conditions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(!tradingPlans || tradingPlans.length === 0) ? `
                                <tr>
                                    <td colspan="5" style="text-align: center; color: #8a939f; padding: 20px 0;">No trading plans logged for today.</td>
                                </tr>
                            ` : (tradingPlans || []).map(p => {
                                let biasBadge = '';
                                if (p.bias === 'Bullish') {
                                    biasBadge = '<span class="badge badge-bullish">Bullish</span>';
                                } else if (p.bias === 'Bearish') {
                                    biasBadge = '<span class="badge badge-bearish">Bearish</span>';
                                } else {
                                    biasBadge = '<span class="badge badge-neutral">Neutral</span>';
                                }
                                
                                return `
                                    <tr>
                                        <td><strong>${p.asset}</strong></td>
                                        <td>${biasBadge}</td>
                                        <td class="mono-text" style="font-family: var(--font-mono);">${p.support || '-'}</td>
                                        <td class="mono-text" style="font-family: var(--font-mono);">${p.resistance || '-'}</td>
                                        <td>${p.trigger || '-'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else {
        // INSTITUTIONAL WEEKLY MODE (Kanzoto Market Report Style)
        
        // 1. Compute dynamic currency performance horizontal bar chart heights
        const rankings = weeklyFxPerformance || [
            { currency: 'USD', value: 0 },
            { currency: 'EUR', value: 0 },
            { currency: 'GBP', value: 0 },
            { currency: 'JPY', value: 0 },
            { currency: 'CAD', value: 0 },
            { currency: 'AUD', value: 0 },
            { currency: 'CHF', value: 0 },
            { currency: 'NZD', value: 0 }
        ];
        
        // Sort currencies by value descending
        const sortedPerformance = [...rankings].sort((a, b) => {
            const valA = parseFloat(String(a.value).replace(',', '.')) || 0;
            const valB = parseFloat(String(b.value).replace(',', '.')) || 0;
            return valB - valA;
        });
        
        const maxAbsValue = Math.max(...sortedPerformance.map(item => Math.abs(parseFloat(String(item.value).replace(',', '.')) || 0))) || 1.0;
        
        // Render bar chart rows
        const currencyBarsHTML = sortedPerformance.map(item => {
            const val = parseFloat(String(item.value).replace(',', '.')) || 0;
            const widthPercentage = Math.min(100, (Math.abs(val) / maxAbsValue) * 100);
            const color = val >= 0 ? '#26a69a' : '#ef5350';
            const sign = val > 0 ? '+' : '';
            
            return `
                <div class="pdf-chart-row">
                    <span class="pdf-chart-label">${item.currency}</span>
                    <div class="pdf-chart-bar-container">
                        <div class="pdf-chart-bar-fill" style="width: ${widthPercentage}%; background-color: ${color};"></div>
                    </div>
                    <span class="pdf-chart-value" style="color: ${color};">${sign}${val.toFixed(2)}%</span>
                </div>
            `;
        }).join('');

        // PAGE 1: Weekly Cover & Performance
        html += `
            <div class="pdf-page">
                <div class="pdf-header">
                    <h1>${title || 'Kanzoto Market Report'}</h1>
                    <p>Weekly Financial Digest | ${date}</p>
                </div>
                
                <div class="pdf-section">
                    <h2>FX Performance Chart Overview</h2>
                ${safeMacroImg ? `
                        <div class="pdf-image-box" style="height: 100mm; max-height: 100mm; overflow: hidden; display: flex; justify-content: center; align-items: center; border: 1px solid #2a2e39; border-radius: 6px; padding: var(--spacing-sm);">
                            ${renderImage(macroImg, 'FX Performance Chart')}
                        </div>
                    ` : `
                        <div class="pdf-image-box" style="height: 60mm; color: #50535e; display: flex; align-items: center; justify-content: center;">
                            No macro performance chart loaded.
                        </div>
                    `}
                </div>
                
                <div class="pdf-grid" style="margin-top: var(--spacing-lg);">
                    <div class="pdf-card" style="flex: 1; min-width: 40%; max-height: 70mm; overflow:hidden;">
                        <h3>Fear & Greed Index</h3>
                        <div style="display:flex; justify-content:center; align-items:center; height:90px; flex-direction:column; margin-top: 10px;">
                            <div style="font-size: 2.8rem; font-weight: bold; color: ${fearGreed > 50 ? '#26a69a' : '#ef5350'};">${fearGreed}</div>
                            <div style="color: #8a939f; font-weight: 600; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px; margin-top: 4px;">
                                ${fearGreed >= 75 ? 'Extreme Greed' : fearGreed > 55 ? 'Greed' : fearGreed >= 45 ? 'Neutral' : fearGreed > 25 ? 'Fear' : 'Extreme Fear'}
                            </div>
                        </div>
                    </div>
                    <div class="pdf-card" style="flex: 1.5; min-width: 50%;">
                        <h3>Weekly Currency Rankings</h3>
                        <div style="margin-top: 10px;">
                            ${currencyBarsHTML}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- PAGE 2: Global Briefing & Central Banks -->
            <div class="pdf-page">
                <div class="pdf-header">
                    <h1>${title || 'Kanzoto Market Report'}</h1>
                    <p>Global Briefing & Yield Stances | ${date}</p>
                </div>
                
                <div class="pdf-section">
                    <h2>Global Macro & Geopolitical Summary</h2>
                    <div class="pdf-text-block" style="background-color: #131722; border: 1px solid #2a2e39; border-radius: 8px; padding: 20px; min-height: 50mm;">
                        <p style="color: #d1d4dc; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; margin: 0;">${weeklyMacroSummary || 'No high-level global macroeconomic or geopolitical overview was written for this week.'}</p>
                    </div>
                </div>
                
                <div class="pdf-section" style="margin-top: 10mm;">
                    <h2>G10 Central Bank Interest Rates Matrix</h2>
                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th style="width: 25%;">Central Bank</th>
                                <th style="width: 35%;">Monetary Policy Stance</th>
                                <th style="text-align: right; width: 40%; padding-right: 15px;">Benchmark Interest Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(weeklyCentralBanks || [
                                { bank: 'FED', rate: 5.25, stance: 'Hawkish' },
                                { bank: 'ECB', rate: 4.25, stance: 'Neutral' },
                                { bank: 'BOE', rate: 5.00, stance: 'Neutral' },
                                { bank: 'BOJ', rate: 0.25, stance: 'Dovish' },
                                { bank: 'RBA', rate: 4.35, stance: 'Hawkish' },
                                { bank: 'RBNZ', rate: 5.50, stance: 'Dovish' },
                                { bank: 'SNB', rate: 1.25, stance: 'Dovish' },
                                { bank: 'BOC', rate: 4.75, stance: 'Neutral' }
                            ]).map(bankObj => {
                                let stanceBadge = '';
                                if (bankObj.stance === 'Hawkish') {
                                    stanceBadge = '<span class="badge badge-hawkish">Hawkish</span>';
                                } else if (bankObj.stance === 'Dovish') {
                                    stanceBadge = '<span class="badge badge-dovish">Dovish</span>';
                                } else {
                                    stanceBadge = '<span class="badge badge-neutral">Neutral</span>';
                                }
                                
                                const rateNum = parseFloat(String(bankObj.rate).replace(',', '.')) || 0;
                                
                                return `
                                    <tr>
                                        <td><strong>${bankObj.bank}</strong></td>
                                        <td>${stanceBadge}</td>
                                        <td class="mono-text" style="text-align: right; font-weight: bold; font-family: var(--font-mono); padding-right: 15px;">${rateNum.toFixed(2)}%</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- PAGE 3: Weekly Playbook & Watchlist Matrix -->
            <div class="pdf-page">
                <div class="pdf-header">
                    <h1>${title || 'Kanzoto Market Report'}</h1>
                    <p>Weekly Actionable Playbook | ${date}</p>
                </div>
                
                <div class="pdf-section">
                    <h2>Weekly Watchlist & Execution Plans</h2>
                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th style="width: 15%;">Asset</th>
                                <th style="width: 15%;">Bias</th>
                                <th style="width: 15%;">Key Support</th>
                                <th style="width: 15%;">Key Resistance</th>
                                <th>Trigger / Tactical Execution Plan</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(!weeklyWatchlist || weeklyWatchlist.length === 0) ? `
                                <tr>
                                    <td colspan="5" style="text-align: center; color: #8a939f; padding: 25px 0;">No actionable trade setups logged for this week.</td>
                                </tr>
                            ` : (weeklyWatchlist || []).map(setup => {
                                let biasBadge = '';
                                if (setup.bias === 'Bullish') {
                                    biasBadge = '<span class="badge badge-bullish">Bullish</span>';
                                } else if (setup.bias === 'Bearish') {
                                    biasBadge = '<span class="badge badge-bearish">Bearish</span>';
                                } else {
                                    biasBadge = '<span class="badge badge-neutral">Neutral</span>';
                                }
                                
                                return `
                                    <tr>
                                        <td><strong>${setup.asset}</strong></td>
                                        <td>${biasBadge}</td>
                                        <td class="mono-text" style="font-family: var(--font-mono);">${setup.support || '-'}</td>
                                        <td class="mono-text" style="font-family: var(--font-mono);">${setup.resistance || '-'}</td>
                                        <td>${setup.trigger || '-'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // Subsequent Pages: Currency Blocks
        (currencyBlocks || []).forEach(block => {
            let biasClass = 'pdf-bias-neutral';
            let biasText = 'BIAIS NEUTRE';
            
            if (block.bias === 'Bullish') {
                biasClass = 'pdf-bias-bullish';
                biasText = 'BIAIS HAUSSIER';
            } else if (block.bias === 'Bearish') {
                biasClass = 'pdf-bias-bearish';
                biasText = 'BIAIS BAISSIER';
            }
            
            const safeTechImg = proxiedUrl(block.techImg);
            const safeRatesImg = proxiedUrl(block.ratesImg);

            // Fixed technical chart rendering (url image or base64)
            const techChartHTML = safeTechImg 
                ? `<div class="pdf-image-box" style="height: 105mm; overflow: hidden; display: flex; justify-content: center; align-items: center; border: 1px solid #2a2e39; border-radius: 6px; padding: var(--spacing-sm);">
                     ${renderImage(block.techImg, block.name + ' Technical')}
                   </div>` 
                : '<div class="pdf-image-box" style="height: 60mm; color: #50535e; display: flex; align-items: center; justify-content: center;">No Technical Chart Provided</div>';

            const ratesChartHTML = safeRatesImg 
                ? `<div class="pdf-image-box" style="height: 80mm; overflow: hidden; display: flex; justify-content: center; align-items: center; border: 1px solid #2a2e39; border-radius: 6px; padding: var(--spacing-sm);">
                     ${renderImage(block.ratesImg, block.name + ' Rates')}
                   </div>` 
                : '<div class="pdf-image-box" style="height: 40mm; color: #50535e; display: flex; align-items: center; justify-content: center;">No Interest Rates Chart Provided</div>';

            html += `
                <!-- CURRENCY PAGE -->
                <div class="pdf-page">
                    <div class="pdf-header">
                        <h1>${title || 'Kanzoto Market Report'}</h1>
                        <p>${block.name}</p>
                    </div>
                    
                    <div class="pdf-section">
                        <h2>Technical Overview</h2>
                        ${techChartHTML}
                    </div>
                    
                    <div class="pdf-section">
                        <h2>Fundamental Analysis</h2>
                        <div class="pdf-text-block">
                            <p>${block.fundamentalText || 'No fundamental analysis provided.'}</p>
                        </div>
                    </div>
                    
                    <div class="pdf-section" style="margin-bottom: 20px;">
                        <h2>Interest Rate Expectations</h2>
                        ${ratesChartHTML}
                    </div>
                    
                    <div class="pdf-bias-indicator ${biasClass}">
                        ${biasText}
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    return html;
}
