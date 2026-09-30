import { store } from './state/store.js';

// Module Loaders
import { renderAuthView } from './modules/auth/AuthView.js';
import { renderMacroDashboard } from './modules/macro/MacroDashboard.js';
import { renderAntiFomoForm } from './modules/entry/AntiFomoForm.js';
import { renderCalendarGrid } from './modules/tracker/CalendarGrid.js';
import { renderReportBuilder, syncReportIframe } from './modules/report/ReportBuilder.js';

class App {
    constructor() {
        this.appRoot = document.getElementById('app');
        this.mainContent = document.getElementById('main-content');
        this.navItems = document.querySelectorAll('.nav-item');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.userEmail = document.getElementById('sidebar-user-email');
        this.userAvatar = document.getElementById('sidebar-user-avatar');
        this.logoutBtn = document.getElementById('sidebar-logout-btn');
        this.currentView = null;
        this.lastAuth = null;
        this.lastForwardedUser = null;
        
        this.init();
    }

    async init() {
        // Setup navigation listeners
        this.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.getAttribute('data-view');
                store.setActiveView(view);
            });
        });

        // Sidebar Toggle
        if (this.sidebarToggle && this.sidebar) {
            this.sidebarToggle.addEventListener('click', () => {
                this.sidebar.classList.toggle('collapsed');
            });
        }

        // Logout listener
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', async () => {
                if (confirm('Voulez-vous vous déconnecter du terminal ?')) {
                    await store.logout();
                }
            });
        }

        // Subscribe to state changes
        store.subscribe((state, options = {}) => {
            this.render(state, options);
            this.forwardAuthToIframe(state.user);
            syncReportIframe(state);
        });

        // 1. Instant Optimistic Render (0ms from cached session)
        this.render(store.getState());

        // 2. Validate/Refresh Supabase Auth Session in background
        store.initAuth().then(user => {
            this.forwardAuthToIframe(user);
            syncReportIframe(store.getState());
        }).catch(err => {
            console.warn('initAuth background error:', err);
        });

        // Iframe auth & dashboard sync request listener
        window.addEventListener('message', (e) => {
            if (!e.data) return;
            if (e.data.type === 'REQUEST_AUTH_USER') {
                const currentUser = store.getState().user;
                if (currentUser) {
                    this.forwardAuthToIframe(currentUser, true);
                }
                syncReportIframe(store.getState());
            } else if (e.data.type === 'REQUEST_DASHBOARD_SYNC') {
                syncReportIframe(store.getState());
            }
        });

        // Global Paste Bridge: Forward clipboard images to active Report Editor iframe
        window.addEventListener('paste', (e) => {
            const iframe = document.getElementById('report-editor-iframe') || document.querySelector('iframe');
            if (!iframe || !iframe.contentWindow) return;

            const clipboard = e.clipboardData || window.clipboardData;
            if (!clipboard) return;

            const items = clipboard.items;
            if (items && items.length) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type && items[i].type.startsWith('image/')) {
                        const blob = items[i].getAsFile();
                        if (blob) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                iframe.contentWindow.postMessage({
                                    type: 'PASTED_IMAGE',
                                    src: event.target.result
                                }, '*');
                            };
                            reader.readAsDataURL(blob);
                            e.preventDefault();
                        }
                        break;
                    }
                }
            }
        });
    }

    forwardAuthToIframe(user, force = false) {
        if (!user) return;
        const iframe = document.getElementById('report-editor-iframe') || document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            const userIdentifier = user.id || user.email;
            if (!force && this.lastForwardedUser === userIdentifier) return;
            this.lastForwardedUser = userIdentifier;
            iframe.contentWindow.postMessage({
                type: 'SYNC_AUTH_USER',
                user: { id: user.id, email: user.email }
            }, '*');
        }
    }

    render(state, options = {}) {
        // Check if user is authenticated
        const isAuthenticated = state.isAuthenticated;
        
        // Remove any existing auth overlay if present
        const existingAuth = document.querySelector('.auth-view-container');
        if (existingAuth) existingAuth.remove();

        if (!isAuthenticated) {
            // Hide sidebar and main layout, show auth view
            if (this.sidebar) this.sidebar.style.display = 'none';
            if (this.mainContent) this.mainContent.style.display = 'none';
            
            const authView = renderAuthView((user) => {
                store.setUser(user);
            });
            document.body.appendChild(authView);
            return;
        }

        // User is logged in: show sidebar & main content
        if (this.sidebar) this.sidebar.style.display = 'flex';
        if (this.mainContent) this.mainContent.style.display = 'flex';

        // Update User Profile Badge in Sidebar
        if (state.user) {
            const email = state.user.email || 'Utilisateur';
            if (this.userEmail) this.userEmail.textContent = email;
            if (this.userAvatar) this.userAvatar.textContent = email.charAt(0).toUpperCase();
        }

        // Update nav active state
        this.navItems.forEach(item => {
            if (item.getAttribute('data-view') === state.activeView) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Adjust main content padding and sidebar collapse for report view
        const isReportView = state.activeView === 'report';
        if (this.mainContent) {
            this.mainContent.classList.toggle('in-report-view', isReportView);
        }

        const viewChanged = this.currentView !== state.activeView;
        const authChanged = this.lastAuth !== isAuthenticated;
        this.currentView = state.activeView;
        this.lastAuth = isAuthenticated;

        // 1. NEVER recreate the report iframe if already mounted on 'report' view
        if (isReportView && !viewChanged && !authChanged) {
            syncReportIframe(state);
            return;
        }

        // 2. Skip DOM rebuild for silent background persistence (e.g. debounced input saves)
        if (options && options.silent && !viewChanged && !authChanged) {
            return;
        }

        const prevScrollTop = this.mainContent ? this.mainContent.scrollTop : 0;

        // Clear main content
        this.mainContent.innerHTML = '';

        // Render appropriate module safely with try/catch
        try {
            let mountedEl = null;
            switch (state.activeView) {
                case 'macro':
                    mountedEl = renderMacroDashboard(state);
                    break;
                case 'entry':
                    mountedEl = renderAntiFomoForm(state);
                    break;
                case 'tracker':
                    mountedEl = renderCalendarGrid(state);
                    break;
                case 'report':
                    mountedEl = renderReportBuilder(state);
                    break;
                default: {
                    const fallback = document.createElement('div');
                    fallback.innerHTML = '<h2>Module non trouvé</h2>';
                    mountedEl = fallback;
                }
            }
            if (mountedEl && this.mainContent) {
                this.mainContent.appendChild(mountedEl);
            }
        } catch (err) {
            console.error(`[App.render] Erreur lors du montage de la vue "${state.activeView}":`, err, err?.stack);
            if (this.mainContent) {
                this.mainContent.innerHTML = `
                    <div class="card" style="border: 1px solid var(--color-loss); padding: 24px;">
                        <h3 style="color: var(--color-loss);">Erreur de rendu (${state.activeView})</h3>
                        <pre class="mono-text" style="color: var(--text-secondary); margin-top: 8px; white-space: pre-wrap;">${err?.message || String(err)}</pre>
                    </div>
                `;
            }
        }

        if (!viewChanged && this.mainContent) {
            this.mainContent.scrollTop = prevScrollTop;
        }
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
