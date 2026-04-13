/* ============================================================
   VH Vastgoed — Admin Authentication
   ============================================================ */

(function () {
    'use strict';

    let isRedirecting = false;

    async function login(email, password) {
        try {
            const { data, error } = await db.auth.signInWithPassword({ email, password });
            if (error) {
                if (error.message === 'Invalid login credentials') {
                    return 'Ongeldig e-mailadres of wachtwoord.';
                }
                return error.message;
            }
            isRedirecting = true;
            window.location.href = 'dashboard.html';
            return null;
        } catch (err) {
            console.error('Login error:', err);
            return 'Er is een onverwachte fout opgetreden.';
        }
    }

    async function logout() {
        isRedirecting = true;
        try { await db.auth.signOut(); } catch (e) { console.error(e); }
        window.location.href = 'index.html';
    }

    async function checkAuth() {
        try {
            const { data: { session } } = await db.auth.getSession();
            if (!session) {
                if (!isRedirecting) {
                    isRedirecting = true;
                    window.location.href = 'index.html';
                }
                return null;
            }
            return session;
        } catch (err) {
            console.error('Auth check error:', err);
            if (!isRedirecting) {
                isRedirecting = true;
                window.location.href = 'index.html';
            }
            return null;
        }
    }

    async function getUser() {
        try {
            const { data: { session } } = await db.auth.getSession();
            return session?.user ?? null;
        } catch (err) {
            console.error('getUser error:', err);
            return null;
        }
    }

    db.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT' && !isRedirecting) {
            const path = window.location.pathname;
            if (!path.endsWith('index.html') && !path.endsWith('/admin/')) {
                isRedirecting = true;
                window.location.href = 'index.html';
            }
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
    });

    window.Auth = { login, logout, checkAuth, getUser };
})();
