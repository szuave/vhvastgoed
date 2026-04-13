/* ============================================================
   VH Vastgoed — Team Management
   ============================================================ */

(function () {
    'use strict';

    let agents = [];
    let editingAgentId = null;
    let deletingAgentId = null;

    /* ── Load agents ──────────────────────────────────────────── */

    async function loadAgents() {
        try {
            const { data, error } = await db
                .from('agents')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Load agents error:', error);
                showToast('Fout bij het laden van het team.', 'error');
                return;
            }

            agents = data || [];
            renderTeamGrid();
        } catch (err) {
            console.error('Failed to load agents:', err);
            showToast('Er is een onverwachte fout opgetreden.', 'error');
        }
    }

    /* ── Render ────────────────────────────────────────────────── */

    function getAgentPhotoUrl(photoPath) {
        if (!photoPath) return null;
        const { data } = db.storage
            .from('agent-photos')
            .getPublicUrl(photoPath);
        return data?.publicUrl || null;
    }

    function renderTeamGrid() {
        const grid = document.getElementById('teamGrid');
        if (!grid) return;

        if (agents.length === 0) {
            grid.innerHTML = '<div class="table-empty">Geen makelaars gevonden. Voeg een nieuwe makelaar toe.</div>';
            return;
        }

        grid.innerHTML = agents.map(agent => {
            const photoUrl = getAgentPhotoUrl(agent.photo_path);
            const statusClass = agent.is_active ? 'active' : 'inactive';
            const statusText = agent.is_active ? 'Actief' : 'Inactief';

            return `
            <div class="team-card" data-agent-id="${agent.id}">
                <div class="team-card-header">
                    <div class="team-card-photo">
                        ${photoUrl
                            ? `<img src="${photoUrl}" alt="${escapeHtml(agent.first_name)}">`
                            : `<i class="fas fa-user-tie"></i>`
                        }
                    </div>
                    <div class="team-card-info">
                        <h3 class="team-card-name">${escapeHtml(agent.first_name)} ${escapeHtml(agent.last_name)}</h3>
                        <p class="team-card-title">${escapeHtml(agent.title || 'Vastgoedmakelaar')}</p>
                    </div>
                    <span class="team-status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="team-card-details">
                    <p><i class="fas fa-envelope"></i> ${escapeHtml(agent.email)}</p>
                    ${agent.phone ? `<p><i class="fas fa-phone"></i> ${escapeHtml(agent.phone)}</p>` : ''}
                    ${agent.biv_number ? `<p><i class="fas fa-id-card"></i> BIV ${escapeHtml(agent.biv_number)}</p>` : ''}
                </div>
                <div class="team-card-actions">
                    <button class="btn btn-sm btn-secondary" data-edit="${agent.id}">
                        <i class="fas fa-pen"></i> Bewerken
                    </button>
                    <button class="btn btn-sm btn-secondary" data-toggle-active="${agent.id}" title="${agent.is_active ? 'Deactiveren' : 'Activeren'}">
                        <i class="fas fa-${agent.is_active ? 'eye-slash' : 'eye'}"></i>
                    </button>
                    <button class="btn-icon danger" data-delete="${agent.id}" title="Verwijderen">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
        }).join('');

        // Wire events
        grid.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.edit));
        });

        grid.querySelectorAll('[data-toggle-active]').forEach(btn => {
            btn.addEventListener('click', () => toggleActive(btn.dataset.toggleActive));
        });

        grid.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', () => openDeleteModal(btn.dataset.delete));
        });
    }

    /* ── Add / Edit modal ─────────────────────────────────────── */

    function openAddModal() {
        editingAgentId = null;
        document.getElementById('modalTitle').textContent = 'Nieuwe makelaar';
        document.getElementById('agentForm').reset();
        document.getElementById('agent_title').value = 'Vastgoedmakelaar';
        document.getElementById('agent_is_active').checked = true;
        document.getElementById('agentModal').style.display = '';
    }

    function openEditModal(agentId) {
        const agent = agents.find(a => String(a.id) === String(agentId));
        if (!agent) return;

        editingAgentId = agentId;
        document.getElementById('modalTitle').textContent = 'Makelaar bewerken';
        document.getElementById('agent_first_name').value = agent.first_name || '';
        document.getElementById('agent_last_name').value = agent.last_name || '';
        document.getElementById('agent_email').value = agent.email || '';
        document.getElementById('agent_phone').value = agent.phone || '';
        document.getElementById('agent_title').value = agent.title || 'Vastgoedmakelaar';
        document.getElementById('agent_biv').value = agent.biv_number || '';
        document.getElementById('agent_bio').value = agent.bio || '';
        document.getElementById('agent_is_active').checked = agent.is_active;
        document.getElementById('agentModal').style.display = '';
    }

    function closeModal() {
        document.getElementById('agentModal').style.display = 'none';
        editingAgentId = null;
    }

    /* ── Save agent ───────────────────────────────────────────── */

    async function saveAgent() {
        const firstName = document.getElementById('agent_first_name').value.trim();
        const lastName = document.getElementById('agent_last_name').value.trim();
        const email = document.getElementById('agent_email').value.trim();

        if (!firstName || !lastName || !email) {
            showToast('Voornaam, achternaam en e-mail zijn verplicht.', 'error');
            return;
        }

        const agentData = {
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: document.getElementById('agent_phone').value.trim() || null,
            title: document.getElementById('agent_title').value.trim() || 'Vastgoedmakelaar',
            biv_number: document.getElementById('agent_biv').value.trim() || null,
            bio: document.getElementById('agent_bio').value.trim() || null,
            is_active: document.getElementById('agent_is_active').checked,
        };

        const saveBtn = document.getElementById('saveAgentBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner"></span> Opslaan...';

        try {
            if (editingAgentId) {
                const { error } = await db
                    .from('agents')
                    .update(agentData)
                    .eq('id', editingAgentId);

                if (error) {
                    console.error('Update agent error:', error);
                    showToast('Fout bij het opslaan: ' + error.message, 'error');
                    return;
                }
                showToast('Makelaar bijgewerkt.', 'success');
            } else {
                const { error } = await db
                    .from('agents')
                    .insert(agentData);

                if (error) {
                    console.error('Insert agent error:', error);
                    showToast('Fout bij het toevoegen: ' + error.message, 'error');
                    return;
                }
                showToast('Makelaar toegevoegd.', 'success');
            }

            closeModal();
            await loadAgents();
        } catch (err) {
            console.error('Save agent failed:', err);
            showToast('Er is een onverwachte fout opgetreden.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Opslaan';
        }
    }

    /* ── Toggle active ────────────────────────────────────────── */

    async function toggleActive(agentId) {
        const agent = agents.find(a => String(a.id) === String(agentId));
        if (!agent) return;

        try {
            const { error } = await db
                .from('agents')
                .update({ is_active: !agent.is_active })
                .eq('id', agentId);

            if (error) {
                console.error('Toggle active error:', error);
                showToast('Fout bij het bijwerken.', 'error');
                return;
            }

            showToast(agent.is_active ? 'Makelaar gedeactiveerd.' : 'Makelaar geactiveerd.', 'success');
            await loadAgents();
        } catch (err) {
            console.error('Toggle active failed:', err);
        }
    }

    /* ── Delete agent ─────────────────────────────────────────── */

    function openDeleteModal(agentId) {
        deletingAgentId = agentId;
        document.getElementById('deleteAgentModal').style.display = '';
    }

    function closeDeleteModal() {
        document.getElementById('deleteAgentModal').style.display = 'none';
        deletingAgentId = null;
    }

    async function deleteAgent() {
        if (!deletingAgentId) return;

        try {
            // Remove photo from storage if exists
            const agent = agents.find(a => String(a.id) === String(deletingAgentId));
            if (agent && agent.photo_path) {
                await db.storage.from('agent-photos').remove([agent.photo_path]);
            }

            const { error } = await db
                .from('agents')
                .delete()
                .eq('id', deletingAgentId);

            if (error) {
                console.error('Delete agent error:', error);
                showToast('Fout bij het verwijderen: ' + error.message, 'error');
                return;
            }

            showToast('Makelaar verwijderd.', 'success');
            closeDeleteModal();
            await loadAgents();
        } catch (err) {
            console.error('Delete agent failed:', err);
            showToast('Er is een onverwachte fout opgetreden.', 'error');
        }
    }

    /* ── Helpers ───────────────────────────────────────────────── */

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

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

        // Load agents
        await loadAgents();

        // Add button
        document.getElementById('addAgentBtn').addEventListener('click', openAddModal);

        // Modal events
        document.getElementById('cancelAgent').addEventListener('click', closeModal);
        document.getElementById('agentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            saveAgent();
        });

        // Delete modal events
        document.getElementById('cancelDeleteAgent').addEventListener('click', closeDeleteModal);
        document.getElementById('confirmDeleteAgent').addEventListener('click', deleteAgent);
    });
})();
