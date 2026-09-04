import { store } from './state/store.js';

// Module Loaders
import { renderAuthView } from './modules/auth/AuthView.js';
import { renderMacroDashboard } from './modules/macro/MacroDashboard.js';
import { renderAntiFomoForm } from './modules/entry/AntiFomoForm.js';
import { renderCalendarGrid } from './modules/tracker/CalendarGrid.js';
import { renderReportBuilder } from './modules/report/ReportBuilder.js';

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
        store.subscribe((state) => this.render(state));

        // Initialize Supabase Auth Session
        await store.initAuth();

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

    render(state) {
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

        // Clear main content
        this.mainContent.innerHTML = '';

        // Render appropriate module
        switch (state.activeView) {
            case 'macro':
                this.mainContent.appendChild(renderMacroDashboard(state));
                break;
            case 'entry':
                this.mainContent.appendChild(renderAntiFomoForm(state));
                break;
            case 'tracker':
                this.mainContent.appendChild(renderCalendarGrid(state));
                break;
            case 'report':
                this.mainContent.appendChild(renderReportBuilder(state));
                break;
            default:
                this.mainContent.innerHTML = '<h2>Module non trouvé</h2>';
        }
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
