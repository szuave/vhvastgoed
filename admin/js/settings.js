/* ============================================================
   VH Vastgoed — Settings Page Logic
   ============================================================ */

(function () {
    'use strict';

    const SETTING_KEYS = ['office_street', 'office_number', 'office_postal', 'office_city'];

    /* ── Load settings ────────────────────────────────────────── */

    async function loadSettings() {
        try {
            const { data, error } = await db
                .from('settings')
                .select('key, value');

            if (error) {
                console.error('Load settings error:', error);
                showToast('Fout bij het laden van instellingen.', 'error');
                return;
            }

            if (!data) return;

            data.forEach(row => {
                const el = document.getElementById(row.key);
                if (el) el.value = row.value || '';
            });
        } catch (err) {
            console.error('Failed to load settings:', err);
            showToast('Er is een fout opgetreden.', 'error');
        }
    }

    /* ── Save settings ────────────────────────────────────────── */

    async function saveSettings() {
        const saveBtn = document.getElementById('saveSettingsBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner"></span> Opslaan...';

        try {
            for (const key of SETTING_KEYS) {
                const el = document.getElementById(key);
                if (!el) continue;

                const value = el.value.trim();

                const { error } = await db
                    .from('settings')
                    .upsert(
                        { key, value, updated_at: new Date().toISOString() },
                        { onConflict: 'key' }
                    );

                if (error) {
                    console.error(`Save setting "${key}" error:`, error);
                    showToast('Fout bij het opslaan van instellingen.', 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Opslaan';
                    return;
                }
            }

            showToast('Instellingen opgeslagen!', 'success');
        } catch (err) {
            console.error('Failed to save settings:', err);
            showToast('Er is een onverwachte fout opgetreden.', 'error');
        }

        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Opslaan';
    }

    /* ── Preview map ──────────────────────────────────────────── */

    function previewMap() {
        const street = document.getElementById('office_street').value.trim();
        const number = document.getElementById('office_number').value.trim();
        const postal = document.getElementById('office_postal').value.trim();
        const city = document.getElementById('office_city').value.trim();

        if (!street || !city) {
            showToast('Vul minstens straat en gemeente in.', 'error');
            return;
        }

        const address = encodeURIComponent(`${street} ${number}, ${postal} ${city}, Belgium`);
        const iframe = document.getElementById('settingsMapPreview');
        iframe.src = `https://maps.google.com/maps?q=${address}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

        const container = document.getElementById('settingsMapContainer');
        container.style.display = 'block';
    }

    /* ── Toast ─────────────────────────────────────────────────── */

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = 'toast ' + type;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3500);
    }

    /* ── Init ──────────────────────────────────────────────────── */

    document.addEventListener('DOMContentLoaded', async () => {
        const session = await window.Auth.checkAuth();
        if (!session) return;

        // Show user email
        const user = await window.Auth.getUser();
        const emailEl = document.getElementById('userEmail');
        if (emailEl && user) emailEl.textContent = user.email;

        // Load existing settings
        await loadSettings();

        // Save button
        document.getElementById('saveSettingsBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await saveSettings();
        });

        // Preview map button
        document.getElementById('previewMapBtn').addEventListener('click', (e) => {
            e.preventDefault();
            previewMap();
        });
    });
})();
