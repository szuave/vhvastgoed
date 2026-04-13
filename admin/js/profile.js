/* ============================================================
   VH Vastgoed — Profile Management
   ============================================================ */

(function () {
    'use strict';

    let currentAgent = null;
    let currentUser = null;

    /* ── Load profile ─────────────────────────────────────────── */

    async function loadProfile() {
        currentUser = await window.Auth.getUser();
        if (!currentUser) return;

        try {
            // First try to find by user_id
            let { data: agent, error } = await db
                .from('agents')
                .select('*')
                .eq('user_id', currentUser.id)
                .maybeSingle();

            // If not found by user_id, try by email
            if (!agent) {
                const { data: agentByEmail, error: emailError } = await db
                    .from('agents')
                    .select('*')
                    .eq('email', currentUser.email)
                    .maybeSingle();

                if (agentByEmail) {
                    agent = agentByEmail;

                    // Auto-link user_id if not set
                    if (!agent.user_id) {
                        await db
                            .from('agents')
                            .update({ user_id: currentUser.id })
                            .eq('id', agent.id);
                        agent.user_id = currentUser.id;
                    }
                }
            }

            if (!agent) {
                // No agent record found
                const formEl = document.getElementById('profileForm');
                const photoEl = document.getElementById('profilePhoto');
                const noMatchEl = document.getElementById('profileNoMatch');
                if (formEl) formEl.style.display = 'none';
                if (photoEl) photoEl.style.display = 'none';
                if (noMatchEl) noMatchEl.style.display = '';
                return;
            }

            currentAgent = agent;
            populateForm(agent);
            loadPhotoPreview(agent.photo_path);
        } catch (err) {
            console.error('Failed to load profile:', err);
            showToast('Fout bij het laden van het profiel.', 'error');
        }
    }

    function populateForm(agent) {
        document.getElementById('profile_first_name').value = agent.first_name || '';
        document.getElementById('profile_last_name').value = agent.last_name || '';
        document.getElementById('profile_email').value = agent.email || '';
        document.getElementById('profile_phone').value = agent.phone || '';
        document.getElementById('profile_title').value = agent.title || '';
        document.getElementById('profile_biv').value = agent.biv_number || '';
        document.getElementById('profile_bio').value = agent.bio || '';
    }

    function loadPhotoPreview(photoPath) {
        const img = document.getElementById('profilePhotoImg');
        const placeholder = document.getElementById('profilePhotoPlaceholder');
        const removeBtn = document.getElementById('removePhotoBtn');

        if (photoPath) {
            const { data } = db.storage
                .from('agent-photos')
                .getPublicUrl(photoPath);
            const url = data?.publicUrl;

            if (url) {
                img.src = url;
                img.style.display = '';
                placeholder.style.display = 'none';
                removeBtn.style.display = '';
                return;
            }
        }

        img.style.display = 'none';
        placeholder.style.display = '';
        removeBtn.style.display = 'none';
    }

    /* ── Save profile ─────────────────────────────────────────── */

    async function saveProfile() {
        if (!currentAgent) return;

        const firstName = document.getElementById('profile_first_name').value.trim();
        const lastName = document.getElementById('profile_last_name').value.trim();
        const email = document.getElementById('profile_email').value.trim();

        if (!firstName || !lastName || !email) {
            showToast('Voornaam, achternaam en e-mail zijn verplicht.', 'error');
            return;
        }

        const profileData = {
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: document.getElementById('profile_phone').value.trim() || null,
            title: document.getElementById('profile_title').value.trim() || 'Vastgoedmakelaar',
            biv_number: document.getElementById('profile_biv').value.trim() || null,
            bio: document.getElementById('profile_bio').value.trim() || null,
        };

        const saveBtn = document.getElementById('saveProfileBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner"></span> Opslaan...';

        try {
            const { error } = await db
                .from('agents')
                .update(profileData)
                .eq('id', currentAgent.id);

            if (error) {
                console.error('Save profile error:', error);
                showToast('Fout bij het opslaan: ' + error.message, 'error');
                return;
            }

            // Update local state
            Object.assign(currentAgent, profileData);
            showToast('Profiel opgeslagen.', 'success');
        } catch (err) {
            console.error('Save profile failed:', err);
            showToast('Er is een onverwachte fout opgetreden.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Opslaan';
        }
    }

    /* ── Photo upload ─────────────────────────────────────────── */

    async function uploadPhoto(file) {
        if (!currentAgent || !file) return;

        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${currentAgent.id}/${timestamp}-${safeName}`;

        try {
            // Remove old photo if exists
            if (currentAgent.photo_path) {
                await db.storage.from('agent-photos').remove([currentAgent.photo_path]);
            }

            // Upload new photo
            const { error: uploadError } = await db.storage
                .from('agent-photos')
                .upload(storagePath, file, {
                    contentType: file.type,
                    upsert: false,
                });

            if (uploadError) {
                console.error('Photo upload error:', uploadError);
                showToast('Fout bij het uploaden van de foto.', 'error');
                return;
            }

            // Update agent record
            const { error: updateError } = await db
                .from('agents')
                .update({ photo_path: storagePath })
                .eq('id', currentAgent.id);

            if (updateError) {
                console.error('Update photo_path error:', updateError);
                showToast('Foto geupload maar opslaan mislukt.', 'error');
                return;
            }

            currentAgent.photo_path = storagePath;
            loadPhotoPreview(storagePath);
            showToast('Profielfoto bijgewerkt.', 'success');
        } catch (err) {
            console.error('Upload photo failed:', err);
            showToast('Er is een onverwachte fout opgetreden.', 'error');
        }
    }

    async function removePhoto() {
        if (!currentAgent || !currentAgent.photo_path) return;

        try {
            await db.storage.from('agent-photos').remove([currentAgent.photo_path]);

            const { error } = await db
                .from('agents')
                .update({ photo_path: null })
                .eq('id', currentAgent.id);

            if (error) {
                console.error('Remove photo error:', error);
                showToast('Fout bij het verwijderen van de foto.', 'error');
                return;
            }

            currentAgent.photo_path = null;
            loadPhotoPreview(null);
            showToast('Profielfoto verwijderd.', 'success');
        } catch (err) {
            console.error('Remove photo failed:', err);
        }
    }

    /* ── Helpers ───────────────────────────────────────────────── */

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = 'toast ' + type;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 3500);
    }

    /* ── Init ──────────────────────────────────────────────────── */

    document.addEventListener('DOMContentLoaded', async () => {
        const session = await window.Auth.checkAuth();
        if (!session) return;

        const user = await window.Auth.getUser();
        const emailEl = document.getElementById('userEmail');
        if (emailEl && user) emailEl.textContent = user.email;

        // Load profile
        await loadProfile();

        // Form submit
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            saveProfile();
        });

        // Photo upload
        const photoArea = document.getElementById('profilePhoto');
        const fileInput = document.getElementById('photoFileInput');

        photoArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) uploadPhoto(file);
            fileInput.value = '';
        });

        // Remove photo
        document.getElementById('removePhotoBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Profielfoto verwijderen?')) {
                removePhoto();
            }
        });
    });
})();
