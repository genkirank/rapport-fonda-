import { supabaseService } from '../../state/supabase.js';
import { store } from '../../state/store.js';

export function renderAuthView(onSuccess) {
    const container = document.createElement('div');
    container.className = 'auth-view-container';
    
    let isSignUp = false;

    container.innerHTML = `
        <div class="auth-wrapper">
            <!-- Background ambient glows -->
            <div class="auth-glow auth-glow-1"></div>
            <div class="auth-glow auth-glow-2"></div>
            
            <div class="auth-glass-card">
                <div class="auth-header">
                    <div class="auth-badge">PRO TRADING SUITE</div>
                    <h2>Terminal Institutionnel</h2>
                    <p id="auth-subtitle">Connectez-vous pour synchroniser vos analyses & journaux en temps réel sur le Cloud.</p>
                </div>

                <div class="auth-mode-switch">
                    <button type="button" class="auth-tab-btn active" id="tab-signin-btn">Connexion</button>
                    <button type="button" class="auth-tab-btn" id="tab-signup-btn">Inscription</button>
                </div>

                <form id="auth-form" class="auth-form-body">
                    <div class="auth-field">
                        <label for="auth-input-email">Adresse Email</label>
                        <div class="auth-input-wrap">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            <input type="email" id="auth-input-email" placeholder="nom@exemple.com" required autocomplete="username" />
                        </div>
                    </div>

                    <div class="auth-field">
                        <label for="auth-input-password">Mot de passe</label>
                        <div class="auth-input-wrap">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            <input type="password" id="auth-input-password" placeholder="••••••••" required autocomplete="current-password" />
                        </div>
                    </div>

                    <div id="auth-msg-box" class="auth-message-box" style="display:none;"></div>

                    <button type="submit" id="auth-submit-action-btn" class="auth-btn-primary">
                        <span id="auth-btn-text">Se Connecter</span>
                        <div class="auth-spinner" id="auth-spinner" style="display:none;"></div>
                    </button>
                </form>

                <div class="auth-divider">
                    <span>OU</span>
                </div>

                <button type="button" id="guest-mode-btn" class="auth-btn-guest">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Explorer en Mode Démo (Local)
                </button>

                <div class="auth-footer-features">
                    <div class="feat-item"><span class="feat-dot"></span> Macro Insights & Watchlist</div>
                    <div class="feat-item"><span class="feat-dot"></span> Journal & Tracker PnL</div>
                    <div class="feat-item"><span class="feat-dot"></span> Générateur de Rapports PDF</div>
                </div>
            </div>
        </div>
    `;

    // Elements
    const tabSignIn = container.querySelector('#tab-signin-btn');
    const tabSignUp = container.querySelector('#tab-signup-btn');
    const authForm = container.querySelector('#auth-form');
    const emailInput = container.querySelector('#auth-input-email');
    const passwordInput = container.querySelector('#auth-input-password');
    const submitBtn = container.querySelector('#auth-submit-action-btn');
    const btnText = container.querySelector('#auth-btn-text');
    const spinner = container.querySelector('#auth-spinner');
    const msgBox = container.querySelector('#auth-msg-box');
    const subtitle = container.querySelector('#auth-subtitle');
    const guestBtn = container.querySelector('#guest-mode-btn');

    function setMode(signup) {
        isSignUp = signup;
        tabSignIn.classList.toggle('active', !isSignUp);
        tabSignUp.classList.toggle('active', isSignUp);
        btnText.textContent = isSignUp ? 'Créer mon compte' : 'Se Connecter';
        subtitle.textContent = isSignUp 
            ? 'Créez votre compte pour sauvegarder et synchroniser votre espace de trading.'
            : 'Connectez-vous pour synchroniser vos analyses & journaux en temps réel sur le Cloud.';
        msgBox.style.display = 'none';
    }

    tabSignIn.addEventListener('click', () => setMode(false));
    tabSignUp.addEventListener('click', () => setMode(true));

    function showMessage(text, isError = true) {
        msgBox.textContent = text;
        msgBox.className = `auth-message-box ${isError ? 'error' : 'success'}`;
        msgBox.style.display = 'block';
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showMessage('Veuillez remplir tous les champs.');
            return;
        }

        btnText.style.display = 'none';
        spinner.style.display = 'inline-block';
        submitBtn.disabled = true;
        msgBox.style.display = 'none';

        try {
            if (isSignUp) {
                const data = await supabaseService.signUp(email, password);
                if (data && data.user && !data.session) {
                    showMessage('Compte créé ! Veuillez vérifier vos emails si une confirmation est requise, ou connectez-vous.', false);
                } else {
                    store.setUser(data.user);
                    if (onSuccess) onSuccess(data.user);
                }
            } else {
                const data = await supabaseService.signIn(email, password);
                store.setUser(data.user);
                if (onSuccess) onSuccess(data.user);
            }
        } catch (err) {
            console.error(err);
            showMessage(err.message || 'Erreur lors de l\'authentification.');
        } finally {
            btnText.style.display = 'inline-block';
            spinner.style.display = 'none';
            submitBtn.disabled = false;
        }
    });

    guestBtn.addEventListener('click', () => {
        store.setUser({ email: 'invite@demo.local', isGuest: true });
        if (onSuccess) onSuccess(store.getState().user);
    });

    return container;
}
