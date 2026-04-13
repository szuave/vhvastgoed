/* ============================================================
   VH Vastgoed — Dashboard Logic
   ============================================================ */

(function () {
    'use strict';

    let allProperties = [];
    let deleteTargetId = null;

    /* ── Stats ─────────────────────────────────────────────── */

    async function loadStats() {
        try {
            const { count: total, error: e1 } = await db
                .from('properties')
                .select('*', { count: 'exact', head: true });

            const { count: teKoop, error: e2 } = await db
                .from('properties')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'te koop');

            const { count: teHuur, error: e3 } = await db
                .from('properties')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'te huur');

            const { count: verkocht, error: e4 } = await db
                .from('properties')
                .select('*', { count: 'exact', head: true })
                .in('status', ['verkocht', 'verhuurd']);

            if (e1 || e2 || e3 || e4) {
                console.error('Stats error:', e1 || e2 || e3 || e4);
            }

            document.getElementById('statTotal').textContent = total ?? 0;
            document.getElementById('statTeKoop').textContent = teKoop ?? 0;
            document.getElementById('statTeHuur').textContent = teHuur ?? 0;
            document.getElementById('statVerkocht').textContent = (verkocht ?? 0);
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }

    /* ── Properties table ──────────────────────────────────── */

    async function loadProperties() {
        try {
            // Fetch properties
            const { data: properties, error } = await db
                .from('properties')
                .select('id, reference_nr, title, city, type, price, status, featured')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading properties:', error);
                renderTableEmpty('Fout bij het laden van panden.');
                return;
            }

            if (!properties || properties.length === 0) {
                allProperties = [];
                renderTableEmpty('Nog geen panden toegevoegd.');
                return;
            }

            // Fetch primary photos for all properties
            const propertyIds = properties.map((p) => p.id);
            const { data: media } = await db
                .from('property_media')
                .select('property_id, storage_path')
                .in('property_id', propertyIds)
                .eq('type', 'photo')
                .eq('is_primary', true);

            const photoMap = {};
            if (media) {
                for (const m of media) {
                    photoMap[m.property_id] = m.storage_path;
                }
            }

            allProperties = properties.map((p) => ({
                ...p,
                photo_path: photoMap[p.id] || null,
            }));

            renderTable(allProperties);
        } catch (err) {
            console.error('Failed to load properties:', err);
            renderTableEmpty('Er is een fout opgetreden.');
        }
    }

    function renderTable(properties) {
        const tbody = document.getElementById('propertiesBody');

        if (!properties.length) {
            renderTableEmpty('Geen resultaten gevonden.');
            return;
        }

        tbody.innerHTML = properties
            .map((p) => {
                const thumbHtml = p.photo_path
                    ? `<img src="${getPublicUrl(p.photo_path)}" class="table-thumb" alt="" loading="lazy">`
                    : `<div class="table-thumb-placeholder">—</div>`;

                const statusClass = (p.status || '').replace(/\s/g, '-');

                return `
                <tr class="clickable-row" data-href="property-form.html?id=${p.id}">
                    <td>${thumbHtml}</td>
                    <td>${escapeHtml(p.reference_nr || '—')}</td>
                    <td>${escapeHtml(p.title)}</td>
                    <td>${escapeHtml(p.city || '—')}</td>
                    <td style="text-transform:capitalize;">${escapeHtml(p.type)}</td>
                    <td>${p.price != null ? formatPrice(p.price) : '—'}</td>
                    <td><span class="status-badge ${statusClass}">${escapeHtml(p.status)}</span></td>
                    <td class="no-click"><input type="checkbox" class="featured-toggle" data-id="${p.id}" ${p.featured ? 'checked' : ''}></td>
                    <td class="no-click">
                        <div class="actions-cell">
                            <a href="property-form.html?id=${p.id}" class="btn-icon" title="Bewerken">&#9998;</a>
                            <button class="btn-icon danger" data-delete-id="${p.id}" title="Verwijderen">&#128465;</button>
                        </div>
                    </td>
                </tr>`;
            })
            .join('');

        // Featured toggles
        tbody.querySelectorAll('.featured-toggle').forEach((cb) => {
            cb.addEventListener('change', () => {
                toggleFeatured(cb.dataset.id, cb.checked);
            });
        });

        // Delete buttons
        tbody.querySelectorAll('[data-delete-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                showDeleteModal(btn.dataset.deleteId);
            });
        });

        // Clickable rows — navigate to edit page
        tbody.querySelectorAll('.clickable-row').forEach((row) => {
            row.addEventListener('click', (e) => {
                // Don't navigate if clicking on checkbox, button, or link
                if (e.target.closest('.no-click') || e.target.closest('a') || e.target.closest('button') || e.target.closest('input')) return;
                window.location.href = row.dataset.href;
            });
        });
    }

    function renderTableEmpty(msg) {
        document.getElementById('propertiesBody').innerHTML =
            `<tr><td colspan="9" class="table-empty">${escapeHtml(msg)}</td></tr>`;
    }

    /* ── Featured toggle ───────────────────────────────────── */

    async function toggleFeatured(id, newValue) {
        try {
            const { error } = await db
                .from('properties')
                .update({ featured: newValue })
                .eq('id', id);

            if (error) {
                console.error('Toggle featured error:', error);
                showToast('Fout bij het bijwerken van aanbevolen status.', 'error');
                // Revert checkbox
                const cb = document.querySelector(`.featured-toggle[data-id="${id}"]`);
                if (cb) cb.checked = !newValue;
            }
        } catch (err) {
            console.error('Toggle featured failed:', err);
            showToast('Fout bij het bijwerken van aanbevolen status.', 'error');
            const cb = document.querySelector(`.featured-toggle[data-id="${id}"]`);
            if (cb) cb.checked = !newValue;
        }
    }

    /* ── Delete ────────────────────────────────────────────── */

    function showDeleteModal(id) {
        deleteTargetId = id;
        document.getElementById('deleteModal').style.display = 'flex';
    }

    function hideDeleteModal() {
        deleteTargetId = null;
        document.getElementById('deleteModal').style.display = 'none';
    }

    async function deleteProperty(id) {
        try {
            // First, get all media for this property to delete from storage
            const { data: media } = await db
                .from('property_media')
                .select('storage_path')
                .eq('property_id', id);

            // Delete files from storage
            if (media && media.length > 0) {
                const paths = media.map((m) => m.storage_path);
                const { error: storageError } = await db.storage
                    .from('property-media')
                    .remove(paths);

                if (storageError) {
                    console.error('Storage delete error:', storageError);
                }
            }

            // Delete the property (cascades to property_media rows)
            const { error } = await db
                .from('properties')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Delete property error:', error);
                showToast('Fout bij het verwijderen van het pand.', 'error');
                return;
            }

            showToast('Pand succesvol verwijderd.', 'success');
            await loadStats();
            await loadProperties();
        } catch (err) {
            console.error('Delete failed:', err);
            showToast('Er is een onverwachte fout opgetreden.', 'error');
        }
    }

    /* ── Search / Filter ───────────────────────────────────── */

    function filterTable(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            renderTable(allProperties);
            return;
        }

        const filtered = allProperties.filter((p) =>
            (p.title && p.title.toLowerCase().includes(term)) ||
            (p.city && p.city.toLowerCase().includes(term)) ||
            (p.reference_nr && p.reference_nr.toLowerCase().includes(term)) ||
            (p.type && p.type.toLowerCase().includes(term))
        );

        renderTable(filtered);
    }

    /* ── Helpers ───────────────────────────────────────────── */

    function formatPrice(price) {
        const num = Number(price);
        if (isNaN(num)) return '—';
        // Belgian format: dot as thousands separator, no decimals.
        // Manually format to avoid inconsistent locale implementations
        // where some browsers use non-breaking spaces instead of dots.
        const formatted = Math.round(num)
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return '€ ' + formatted;
    }

    function getPublicUrl(path) {
        const { data } = db.storage
            .from('property-media')
            .getPublicUrl(path);
        return data?.publicUrl || '';
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + type;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3500);
    }

    /* ── Init ──────────────────────────────────────────────── */

    document.addEventListener('DOMContentLoaded', async () => {
        const session = await window.Auth.checkAuth();
        if (!session) return;

        // Show user email
        const user = await window.Auth.getUser();
        const emailEl = document.getElementById('userEmail');
        if (emailEl && user) {
            emailEl.textContent = user.email;
        }

        // Check for success message from URL params
        const params = new URLSearchParams(window.location.search);
        if (params.get('saved') === '1') {
            showToast('Pand succesvol opgeslagen.', 'success');
            // Clean URL
            window.history.replaceState({}, '', 'dashboard.html');
        }

        // Load data
        await Promise.all([loadStats(), loadProperties()]);

        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterTable(e.target.value);
            });
        }

        // Delete modal
        document.getElementById('cancelDelete').addEventListener('click', hideDeleteModal);
        document.getElementById('confirmDelete').addEventListener('click', async () => {
            if (deleteTargetId) {
                const btn = document.getElementById('confirmDelete');
                btn.disabled = true;
                btn.textContent = 'Bezig...';
                await deleteProperty(deleteTargetId);
                hideDeleteModal();
                btn.disabled = false;
                btn.textContent = 'Verwijderen';
            }
        });

        // Close modal on overlay click
        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) hideDeleteModal();
        });
    });
})();
