/* ============================================================
   VH Vastgoed — Sort Order Page Logic
   ============================================================ */

(function () {
    'use strict';

    let currentStatus = 'te koop';
    let properties = [];
    const thumbCache = {};

    /* ── Load properties ──────────────────────────────────────── */

    async function loadProperties(status) {
        const listEl = document.getElementById('sortList');
        listEl.innerHTML = '<div class="sort-empty">Panden worden geladen...</div>';

        // Clear thumbnail cache when loading a new set
        Object.keys(thumbCache).forEach(k => delete thumbCache[k]);

        try {
            let query = db
                .from('properties')
                .select('id, title, city, price, status, sort_order, featured')
                .order('sort_order', { ascending: true });

            // "featured" tab shows only featured properties (any status)
            if (status === 'featured') {
                query = query.eq('featured', true);
            } else {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Load properties error:', error);
                listEl.innerHTML = '<div class="sort-empty">Fout bij het laden.</div>';
                return;
            }

            properties = data || [];

            // Ensure sort_order values are sequential
            properties.forEach((p, i) => {
                p.sort_order = i;
            });

            renderList();
        } catch (err) {
            console.error('Failed to load properties:', err);
            listEl.innerHTML = '<div class="sort-empty">Fout bij het laden.</div>';
        }
    }

    /* ── Get thumbnail URL ────────────────────────────────────── */

    async function getThumbnailUrl(propertyId) {
        if (thumbCache[propertyId] !== undefined) return thumbCache[propertyId];

        try {
            const { data, error } = await db
                .from('property_media')
                .select('storage_path')
                .eq('property_id', propertyId)
                .eq('type', 'photo')
                .order('is_primary', { ascending: false })
                .order('sort_order', { ascending: true })
                .limit(1)
                .single();

            if (error || !data) {
                thumbCache[propertyId] = null;
                return null;
            }

            const { data: urlData } = db.storage
                .from('property-media')
                .getPublicUrl(data.storage_path);

            const url = urlData?.publicUrl || null;
            thumbCache[propertyId] = url;
            return url;
        } catch {
            thumbCache[propertyId] = null;
            return null;
        }
    }

    /* ── Render list ──────────────────────────────────────────── */

    async function renderList() {
        const listEl = document.getElementById('sortList');

        if (properties.length === 0) {
            listEl.innerHTML = '<div class="sort-empty">Geen panden gevonden voor deze status.</div>';
            return;
        }

        // Fetch thumbnails in parallel
        const thumbPromises = properties.map((p) => getThumbnailUrl(p.id));
        const thumbUrls = await Promise.all(thumbPromises);

        let html = '';
        for (let i = 0; i < properties.length; i++) {
            const p = properties[i];
            const thumbUrl = thumbUrls[i];
            const priceStr = p.price != null
                ? new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(p.price)
                : '—';

            const thumbHtml = thumbUrl
                ? `<img class="sort-item-thumb" src="${escapeHtml(thumbUrl)}" alt="">`
                : `<div class="sort-item-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--gray-400);font-size:0.7rem;">Geen foto</div>`;

            html += `
            <div class="sort-item" data-idx="${i}">
                <span class="sort-item-handle">&#9776;</span>
                ${thumbHtml}
                <div class="sort-item-info">
                    <div class="sort-item-title">${escapeHtml(p.title || 'Zonder titel')}</div>
                    <div class="sort-item-meta">${escapeHtml(p.city || '')} &middot; ${priceStr}${currentStatus === 'featured' ? ` &middot; <em>${escapeHtml(p.status)}</em>` : ''}</div>
                </div>
                <div class="sort-item-arrows">
                    <button type="button" data-dir="up" data-idx="${i}" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
                    <button type="button" data-dir="down" data-idx="${i}" ${i === properties.length - 1 ? 'disabled' : ''}>&#9660;</button>
                </div>
            </div>`;
        }

        listEl.innerHTML = html;

        // Wire up/down buttons
        listEl.querySelectorAll('[data-dir]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const dir = btn.dataset.dir;
                moveItem(idx, dir);
            });
        });

        // Init drag and drop
        initDragAndDrop();
    }

    /* ── Move item ────────────────────────────────────────────── */

    function moveItem(idx, direction) {
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= properties.length) return;

        const temp = properties[idx];
        properties[idx] = properties[targetIdx];
        properties[targetIdx] = temp;

        properties.forEach((p, i) => { p.sort_order = i; });
        renderList();
    }

    /* ── Drag and Drop ───────────────────────────────────────── */

    let dragSourceIdx = null;

    function initDragAndDrop() {
        const listEl = document.getElementById('sortList');
        const items = listEl.querySelectorAll('.sort-item');

        items.forEach((item) => {
            const handle = item.querySelector('.sort-item-handle');

            handle.addEventListener('mousedown', () => {
                item.setAttribute('draggable', 'true');
            });

            handle.addEventListener('touchstart', () => {
                item.setAttribute('draggable', 'true');
            }, { passive: true });

            item.addEventListener('dragstart', (e) => {
                dragSourceIdx = parseInt(item.dataset.idx, 10);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', dragSourceIdx);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                item.setAttribute('draggable', 'false');
                dragSourceIdx = null;
                listEl.querySelectorAll('.sort-item').forEach(el => el.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                listEl.querySelectorAll('.sort-item').forEach(el => el.classList.remove('drag-over'));
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetIdx = parseInt(item.dataset.idx, 10);
                if (dragSourceIdx === null || dragSourceIdx === targetIdx) return;

                // Remove dragged item and insert at new position
                const moved = properties.splice(dragSourceIdx, 1)[0];
                properties.splice(targetIdx, 0, moved);

                properties.forEach((p, i) => { p.sort_order = i; });
                renderList();
            });
        });
    }

    /* ── Save order ───────────────────────────────────────────── */

    async function saveOrder() {
        const saveBtn = document.getElementById('saveOrderBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner"></span> Opslaan...';

        try {
            // Update each property's sort_order
            const updates = properties.map((p) =>
                db.from('properties')
                    .update({ sort_order: p.sort_order })
                    .eq('id', p.id)
            );

            const results = await Promise.all(updates);

            const hasError = results.some((r) => r.error);
            if (hasError) {
                const firstError = results.find((r) => r.error);
                console.error('Save order error:', firstError.error);
                showToast('Fout bij het opslaan van de volgorde.', 'error');
            } else {
                showToast('Volgorde opgeslagen!', 'success');
            }
        } catch (err) {
            console.error('Save order failed:', err);
            showToast('Er is een onverwachte fout opgetreden.', 'error');
        }

        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Opslaan';
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

        // Tab switching
        document.querySelectorAll('.sort-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.sort-tab').forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');
                currentStatus = tab.dataset.status;
                loadProperties(currentStatus);
            });
        });

        // Save button
        document.getElementById('saveOrderBtn').addEventListener('click', saveOrder);

        // Initial load
        await loadProperties(currentStatus);
    });
})();
