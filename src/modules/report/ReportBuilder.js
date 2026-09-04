export function renderReportBuilder(state) {
    const container = document.createElement('div');
    container.className = 'report-dashboard';
    container.style.width = '100%';
    container.style.height = 'calc(100vh - 32px)';
    container.style.overflow = 'hidden';
    
    // We embed the standalone report editor HTML via iframe
    // This isolates its global functions and provides a spacious terminal layout
    container.innerHTML = `
        <iframe 
            id="report-editor-iframe"
            src="/report.html" 
            style="width: 100%; height: 100%; border: none; border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);" 
            title="Éditeur de Rapport">
        </iframe>
    `;

    return container;
}
