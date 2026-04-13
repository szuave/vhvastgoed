/* ============================================================
   VH Vastgoed — Property Form Logic
   ============================================================ */

(function () {
    'use strict';

    let currentPropertyId = null;
    let isEditMode = false;
    let existingPhotos = [];
    let existingDocuments = [];
    let pendingPhotoFiles = [];
    let pendingDocFiles = []; // { file, label }

    /* ── Field definitions ─────────────────────────────────── */

    const TEXT_FIELDS = [
        'title', 'address', 'postal_code', 'city', 'reference_nr',
        'description', 'orientation', 'epc_unique_code',
        'g_score', 'p_score', 'destination', 'judgments', 'servitude',
    ];

    const SELECT_FIELDS = [
        'type', 'status', 'condition', 'kitchen_type', 'bathroom_type',
        'epc_label', 'heating_type', 'heating_system', 'window_type', 'flood_zone',
    ];

    const NUMBER_FIELDS = [
        'price', 'bedrooms', 'bathrooms', 'living_area', 'total_area',
        'floors', 'build_year', 'terrace_area', 'toilets', 'epc_score',
    ];

    const BOOLEAN_FIELDS = [
        'featured', 'garden', 'terrace', 'parking', 'cellar', 'attic',
        'elevator', 'alarm', 'video_intercom', 'furnished', 'laundry_room',
        'double_glazing', 'electricity_inspection',
        'building_permit', 'subdivision_permit', 'pre_emption_right',
    ];

    const DOCUMENT_LABELS = [
        'EPC certificaat',
        'Bodemattest',
        'Overstromingsrapport',
        'Stedenbouwkundige inlichtingen',
        'Elektriciteitskeuring',
        'Onderhoudsattest',
        'Voorkooprecht',
        'Andere',
    ];

    /* ── Load property (edit mode) ─────────────────────────── */

    async function loadProperty(id) {
        try {
            const { data: property, error } = await db
                .from('properties')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !property) {
                console.error('Load property error:', error);
                showToast('Pand niet gevonden.', 'error');
                return;
            }

            // Populate text fields
            for (const field of TEXT_FIELDS) {
                const el = document.getElementById(field);
                if (el && property[field] != null) el.value = property[field];
            }

            // Populate select fields
            for (const field of SELECT_FIELDS) {
                const el = document.getElementById(field);
                if (el && property[field] != null) el.value = property[field];
            }

            // Populate number fields
            for (const field of NUMBER_FIELDS) {
                const el = document.getElementById(field);
                if (el && property[field] != null) el.value = property[field];
            }

            // Populate boolean/checkbox fields
            for (const field of BOOLEAN_FIELDS) {
                const elId = field;
                const el = document.getElementById(elId);
                if (el) el.checked = !!property[field];
            }

            // Handle garage separately (checkbox id is garage_feat, db field is garage)
            const garageEl = document.getElementById('garage_feat');
            if (garageEl) garageEl.checked = !!property.garage;

            // Set agent dropdown
            const agentSelect = document.getElementById('agent_id');
            if (agentSelect && property.agent_id) {
                agentSelect.value = property.agent_id;
            }

            // Show terrace area if terrace is checked
            if (property.terrace) {
                document.getElementById('terraceAreaRow').style.display = '';
            }

            // Update page title
            document.getElementById('pageTitle').textContent = 'Pand bewerken';
            document.title = 'VH Vastgoed — Pand bewerken';

            // Open the first section (Basis) in edit mode so data is visible
            document.querySelectorAll('.form-section').forEach((section) => {
                const body = section.querySelector('.section-body');
                const icon = section.querySelector('.toggle-icon');
                if (body) { body.style.display = ''; section.classList.add('open'); }
                if (icon) icon.innerHTML = '&#9660;';
            });

            // Load media
            await loadMedia(id);
        } catch (err) {
            console.error('Failed to load property:', err);
            showToast('Fout bij het laden van het pand.', 'error');
        }
    }

    async function loadMedia(propertyId) {
        try {
            const { data: media, error } = await db
                .from('property_media')
                .select('*')
                .eq('property_id', propertyId)
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Load media error:', error);
                return;
            }

            existingPhotos = media.filter((m) => m.type === 'photo');
            existingDocuments = media.filter((m) => m.type === 'document');

            renderPhotoGrid();
            renderDocumentsList();
        } catch (err) {
            console.error('Failed to load media:', err);
        }
    }

    /* ── Save property ─────────────────────────────────────── */

    async function saveProperty() {
        // Validate
        const errors = validateForm();
        if (errors.length > 0) {
            showFormErrors(errors);
            return;
        }
        hideFormErrors();

        const data = collectFormData();

        // Generate ref nr if empty
        if (!data.reference_nr) {
            data.reference_nr = generateRefNr();
        }

        const saveBtn = document.getElementById('saveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner"></span> Opslaan...';

        try {
            let propertyId;

            if (isEditMode && currentPropertyId) {
                // Update
                const { data: updated, error } = await db
                    .from('properties')
                    .update(data)
                    .eq('id', currentPropertyId)
                    .select('id')
                    .single();

                if (error) {
                    console.error('Update error:', error);
                    showToast('Fout bij het opslaan: ' + error.message, 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Opslaan';
                    return;
                }
                propertyId = updated.id;
            } else {
                // Insert
                const { data: inserted, error } = await db
                    .from('properties')
                    .insert(data)
                    .select('id')
                    .single();

                if (error) {
                    console.error('Insert error:', error);
                    showToast('Fout bij het opslaan: ' + error.message, 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Opslaan';
                    return;
                }
                propertyId = inserted.id;
            }

            // Upload pending photos
            if (pendingPhotoFiles.length > 0) {
                await uploadPhotos(pendingPhotoFiles, propertyId);
            }

            // Upload pending documents
            if (pendingDocFiles.length > 0) {
                await uploadDocuments(pendingDocFiles, propertyId);
            }

            // Redirect to dashboard with success
            window.location.href = 'dashboard.html?saved=1';
        } catch (err) {
            console.error('Save failed:', err);
            showToast('Er is een onverwachte fout opgetreden.', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Opslaan';
        }
    }

    function collectFormData() {
        const data = {};

        for (const field of TEXT_FIELDS) {
            const el = document.getElementById(field);
            if (el) {
                const val = el.value.trim();
                data[field] = val || null;
            }
        }

        for (const field of SELECT_FIELDS) {
            const el = document.getElementById(field);
            if (el) {
                data[field] = el.value || null;
            }
        }

        for (const field of NUMBER_FIELDS) {
            const el = document.getElementById(field);
            if (el) {
                const val = el.value.trim();
                data[field] = val !== '' ? Number(val) : null;
            }
        }

        for (const field of BOOLEAN_FIELDS) {
            const elId = field;
            const el = document.getElementById(elId);
            if (el) {
                data[field] = el.checked;
            }
        }

        // garage checkbox
        const garageEl = document.getElementById('garage_feat');
        if (garageEl) data.garage = garageEl.checked;

        // agent_id
        const agentSelect = document.getElementById('agent_id');
        if (agentSelect) {
            data.agent_id = agentSelect.value || null;
        }

        return data;
    }

    /* ── Validation ────────────────────────────────────────── */

    function validateForm() {
        const errors = [];
        const required = {
            type: 'Type',
            title: 'Titel',
            city: 'Stad',
            price: 'Prijs',
            status: 'Status',
        };

        for (const [field, label] of Object.entries(required)) {
            const el = document.getElementById(field);
            if (!el) continue;
            const val = el.value.trim();
            if (!val) {
                errors.push(`${label} is verplicht.`);
                el.classList.add('invalid');
            } else {
                el.classList.remove('invalid');
            }
        }

        return errors;
    }

    function showFormErrors(errors) {
        const el = document.getElementById('formErrors');
        el.innerHTML = '<ul>' + errors.map((e) => `<li>${e}</li>`).join('') + '</ul>';
        el.style.display = 'block';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hideFormErrors() {
        const el = document.getElementById('formErrors');
        el.style.display = 'none';
        el.innerHTML = '';
    }

    /* ── Photo upload ──────────────────────────────────────── */

    async function uploadPhotos(files, propertyId) {
        const startOrder = existingPhotos.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `photos/${propertyId}/${timestamp}-${safeName}`;

            const { error: uploadError } = await db.storage
                .from('property-media')
                .upload(storagePath, file, {
                    contentType: file.type,
                    upsert: false,
                });

            if (uploadError) {
                console.error('Photo upload error:', uploadError);
                continue;
            }

            // Insert media row
            const { error: insertError } = await db
                .from('property_media')
                .insert({
                    property_id: propertyId,
                    type: 'photo',
                    storage_path: storagePath,
                    file_name: file.name,
                    mime_type: file.type,
                    sort_order: startOrder + i,
                    is_primary: existingPhotos.length === 0 && i === 0,
                });

            if (insertError) {
                console.error('Photo media insert error:', insertError);
            }
        }
    }

    /* ── Document upload ───────────────────────────────────── */

    async function uploadDocuments(docEntries, propertyId) {
        for (const entry of docEntries) {
            const file = entry.file;
            const label = (entry.label === 'Andere' && entry.customLabel) ? entry.customLabel : entry.label;
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `documents/${propertyId}/${timestamp}-${safeName}`;

            const { error: uploadError } = await db.storage
                .from('property-media')
                .upload(storagePath, file, {
                    contentType: file.type,
                    upsert: false,
                });

            if (uploadError) {
                console.error('Document upload error:', uploadError);
                continue;
            }

            const { error: insertError } = await db
                .from('property_media')
                .insert({
                    property_id: propertyId,
                    type: 'document',
                    storage_path: storagePath,
                    file_name: file.name,
                    mime_type: file.type,
                    sort_order: 0,
                    is_primary: false,
                    label: label || null,
                });

            if (insertError) {
                console.error('Document media insert error:', insertError);
            }
        }
    }

    /* ── Delete media ──────────────────────────────────────── */

    async function deleteMedia(mediaId, storagePath) {
        try {
            // Delete from storage
            const { error: storageError } = await db.storage
                .from('property-media')
                .remove([storagePath]);

            if (storageError) {
                console.error('Storage delete error:', storageError);
            }

            // Delete the row
            const { error } = await db
                .from('property_media')
                .delete()
                .eq('id', mediaId);

            if (error) {
                console.error('Media delete error:', error);
                showToast('Fout bij het verwijderen.', 'error');
                return;
            }

            // Refresh media
            await loadMedia(currentPropertyId);
            showToast('Bestand verwijderd.', 'success');
        } catch (err) {
            console.error('Delete media failed:', err);
        }
    }

    /* ── Set primary photo ─────────────────────────────────── */

    async function setPrimaryPhoto(mediaId, propertyId) {
        try {
            // Unset all primary for this property
            const { error: unsetError } = await db
                .from('property_media')
                .update({ is_primary: false })
                .eq('property_id', propertyId)
                .eq('type', 'photo');

            if (unsetError) {
                console.error('Unset primary error:', unsetError);
                return;
            }

            // Set new primary
            const { error: setError } = await db
                .from('property_media')
                .update({ is_primary: true })
                .eq('id', mediaId);

            if (setError) {
                console.error('Set primary error:', setError);
                return;
            }

            await loadMedia(propertyId);
            showToast('Hoofdfoto ingesteld.', 'success');
        } catch (err) {
            console.error('Set primary failed:', err);
        }
    }

    /* ── Reorder photos ────────────────────────────────────── */

    async function movePhoto(mediaId, direction) {
        const idx = existingPhotos.findIndex((p) => String(p.id) === String(mediaId));
        if (idx === -1) return;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= existingPhotos.length) return;

        // Swap sort_order values
        const a = existingPhotos[idx];
        const b = existingPhotos[targetIdx];

        try {
            await db
                .from('property_media')
                .update({ sort_order: b.sort_order })
                .eq('id', a.id);

            await db
                .from('property_media')
                .update({ sort_order: a.sort_order })
                .eq('id', b.id);

            await loadMedia(currentPropertyId);
        } catch (err) {
            console.error('Reorder failed:', err);
        }
    }

    /* ── Generate reference number ─────────────────────────── */

    function generateRefNr() {
        const year = new Date().getFullYear();
        const rand = String(Math.floor(Math.random() * 900) + 100);
        return `VH-${year}-${rand}`;
    }

    /* ── Render helpers ────────────────────────────────────── */

    function getPublicUrl(path) {
        const { data } = db.storage
            .from('property-media')
            .getPublicUrl(path);
        return data?.publicUrl || '';
    }

    function renderPhotoGrid() {
        const grid = document.getElementById('photoGrid');
        if (!grid) return;

        let html = '';

        // Existing photos
        for (let i = 0; i < existingPhotos.length; i++) {
            const photo = existingPhotos[i];
            const url = getPublicUrl(photo.storage_path);
            const isPrimary = photo.is_primary;

            html += `
            <div class="photo-card" data-media-id="${photo.id}">
                <img src="${url}" alt="${escapeHtml(photo.file_name || '')}" loading="lazy">
                <input type="text" class="photo-label-input" data-media-id="${photo.id}" value="${escapeHtml(photo.label || '')}" placeholder="Beschrijving (optioneel)">
                <div class="photo-card-actions">
                    <button type="button" class="btn-set-primary ${isPrimary ? 'is-primary' : ''}"
                            data-media-id="${photo.id}"
                            ${isPrimary ? 'disabled' : ''}>
                        ${isPrimary ? '★ Hoofd' : 'Hoofdfoto'}
                    </button>
                    <div class="photo-card-order">
                        <button type="button" data-move="up" data-media-id="${photo.id}" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
                        <button type="button" data-move="down" data-media-id="${photo.id}" ${i === existingPhotos.length - 1 ? 'disabled' : ''}>&#9660;</button>
                    </div>
                    <button type="button" class="btn-delete-photo" data-media-id="${photo.id}" data-path="${photo.storage_path}">&#10005;</button>
                </div>
            </div>`;
        }

        // Pending photo previews
        for (let i = 0; i < pendingPhotoFiles.length; i++) {
            const file = pendingPhotoFiles[i];
            const previewUrl = URL.createObjectURL(file);
            html += `
            <div class="photo-card pending">
                <img src="${previewUrl}" alt="${escapeHtml(file.name)}" loading="lazy">
                <div class="photo-card-actions">
                    <span style="font-size:0.7rem;color:var(--gray-500)">Nieuw</span>
                    <button type="button" class="btn-delete-photo" data-pending-idx="${i}">&#10005;</button>
                </div>
            </div>`;
        }

        grid.innerHTML = html;

        // Wire events
        grid.querySelectorAll('.btn-set-primary:not([disabled])').forEach((btn) => {
            btn.addEventListener('click', () => {
                setPrimaryPhoto(btn.dataset.mediaId, currentPropertyId);
            });
        });

        grid.querySelectorAll('[data-move]').forEach((btn) => {
            btn.addEventListener('click', () => {
                movePhoto(btn.dataset.mediaId, btn.dataset.move);
            });
        });

        grid.querySelectorAll('.btn-delete-photo[data-media-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (confirm('Foto verwijderen?')) {
                    deleteMedia(btn.dataset.mediaId, btn.dataset.path);
                }
            });
        });

        grid.querySelectorAll('.btn-delete-photo[data-pending-idx]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.pendingIdx, 10);
                pendingPhotoFiles.splice(idx, 1);
                renderPhotoGrid();
            });
        });

        // Photo label (description) — save on blur
        grid.querySelectorAll('.photo-label-input').forEach((input) => {
            input.addEventListener('blur', async () => {
                const mediaId = input.dataset.mediaId;
                const label = input.value.trim();
                try {
                    await db.from('property_media').update({ label }).eq('id', mediaId);
                    // Update local state
                    const photo = existingPhotos.find(p => String(p.id) === String(mediaId));
                    if (photo) photo.label = label;
                } catch (e) {
                    console.error('Failed to save photo label:', e);
                }
            });
        });
    }

    function renderDocumentsList() {
        const list = document.getElementById('documentsList');
        if (!list) return;

        if (existingDocuments.length === 0) {
            list.innerHTML = '';
            return;
        }

        list.innerHTML = existingDocuments
            .map((doc) => {
                const ext = (doc.file_name || '').split('.').pop().toUpperCase();
                return `
                <div class="document-row">
                    <div class="doc-icon">${escapeHtml(ext)}</div>
                    <div class="doc-info">
                        <div class="doc-name">${escapeHtml(doc.file_name || 'Document')}</div>
                        <div class="doc-label">${escapeHtml(doc.label || '—')}</div>
                    </div>
                    <button type="button" class="btn-icon danger" data-doc-id="${doc.id}" data-doc-path="${doc.storage_path}" title="Verwijderen">&#128465;</button>
                </div>`;
            })
            .join('');

        list.querySelectorAll('[data-doc-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (confirm('Document verwijderen?')) {
                    deleteMedia(btn.dataset.docId, btn.dataset.docPath);
                }
            });
        });
    }

    function renderPendingDocs() {
        const container = document.getElementById('pendingDocs');
        if (!container) return;

        if (pendingDocFiles.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = pendingDocFiles
            .map((entry, i) => {
                const optionsHtml = DOCUMENT_LABELS
                    .map((lbl) => `<option value="${lbl}" ${entry.label === lbl || (lbl === 'Andere' && entry.customLabel) ? 'selected' : ''}>${lbl}</option>`)
                    .join('');

                const showCustom = entry.label === 'Andere' || entry.customLabel;

                return `
                <div class="pending-doc-row">
                    <div class="doc-info">
                        <div class="doc-name">${escapeHtml(entry.file.name)}</div>
                    </div>
                    <div>
                        <select data-pending-doc-idx="${i}">
                            <option value="">— Label kiezen —</option>
                            ${optionsHtml}
                        </select>
                        <input type="text" class="custom-label-input" data-custom-label-idx="${i}" placeholder="Typ label..." value="${escapeHtml(entry.customLabel || '')}" style="${showCustom ? '' : 'display:none;'}">
                    </div>
                    <button type="button" class="btn-remove-pending" data-remove-doc="${i}">&#10005;</button>
                </div>`;
            })
            .join('');

        container.querySelectorAll('select[data-pending-doc-idx]').forEach((sel) => {
            sel.addEventListener('change', () => {
                const idx = parseInt(sel.dataset.pendingDocIdx, 10);
                const customInput = container.querySelector(`input[data-custom-label-idx="${idx}"]`);
                if (sel.value === 'Andere') {
                    pendingDocFiles[idx].label = 'Andere';
                    if (customInput) customInput.style.display = '';
                } else {
                    pendingDocFiles[idx].label = sel.value;
                    pendingDocFiles[idx].customLabel = '';
                    if (customInput) {
                        customInput.style.display = 'none';
                        customInput.value = '';
                    }
                }
            });
        });

        container.querySelectorAll('input[data-custom-label-idx]').forEach((inp) => {
            inp.addEventListener('input', () => {
                const idx = parseInt(inp.dataset.customLabelIdx, 10);
                pendingDocFiles[idx].customLabel = inp.value;
            });
        });

        container.querySelectorAll('[data-remove-doc]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.removeDoc, 10);
                pendingDocFiles.splice(idx, 1);
                renderPendingDocs();
            });
        });
    }

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

    /* ── Drag & Drop for photos ────────────────────────────── */

    function initPhotoUpload() {
        const dropZone = document.getElementById('photoDropZone');
        const fileInput = document.getElementById('photoInput');
        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files).filter((f) =>
                f.type.startsWith('image/')
            );
            if (files.length > 0) {
                pendingPhotoFiles.push(...files);
                renderPhotoGrid();
            }
        });

        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files);
            if (files.length > 0) {
                pendingPhotoFiles.push(...files);
                renderPhotoGrid();
            }
            fileInput.value = '';
        });
    }

    /* ── Drag & Drop for documents ─────────────────────────── */

    function initDocUpload() {
        const dropZone = document.getElementById('docDropZone');
        const fileInput = document.getElementById('docInput');
        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            for (const file of files) {
                pendingDocFiles.push({ file, label: '' });
            }
            renderPendingDocs();
        });

        fileInput.addEventListener('change', () => {
            const files = Array.from(fileInput.files);
            for (const file of files) {
                pendingDocFiles.push({ file, label: '' });
            }
            renderPendingDocs();
            fileInput.value = '';
        });
    }

    /* ── Collapsible sections ──────────────────────────────── */

    function initSections() {
        document.querySelectorAll('.section-header[data-toggle="section"]').forEach((header) => {
            header.addEventListener('click', () => {
                const section = header.closest('.form-section');
                const body = section.querySelector('.section-body');
                const icon = header.querySelector('.toggle-icon');
                const isOpen = section.classList.contains('open');

                if (isOpen) {
                    section.classList.remove('open');
                    body.style.display = 'none';
                    icon.innerHTML = '&#9654;';
                } else {
                    section.classList.add('open');
                    body.style.display = '';
                    icon.innerHTML = '&#9660;';
                }
            });
        });
    }

    /* ── Terrace area toggle ───────────────────────────────── */

    function initTerraceToggle() {
        const terraceCheckbox = document.getElementById('terrace');
        const terraceRow = document.getElementById('terraceAreaRow');
        if (!terraceCheckbox || !terraceRow) return;

        terraceCheckbox.addEventListener('change', () => {
            terraceRow.style.display = terraceCheckbox.checked ? '' : 'none';
        });
    }

    /* ── Load agents dropdown ─────────────────────────────────── */

    async function loadAgentsDropdown() {
        try {
            const { data: agents, error } = await db
                .from('agents')
                .select('id, first_name, last_name')
                .eq('is_active', true)
                .order('first_name', { ascending: true });

            if (error) {
                console.error('Load agents error:', error);
                return;
            }

            const select = document.getElementById('agent_id');
            if (!select) return;

            (agents || []).forEach(agent => {
                const option = document.createElement('option');
                option.value = agent.id;
                option.textContent = `${agent.first_name} ${agent.last_name}`;
                select.appendChild(option);
            });
        } catch (err) {
            console.error('Failed to load agents:', err);
        }
    }

    /* ── Property map preview ─────────────────────────────────── */

    function previewPropertyMap() {
        const address = (document.getElementById('address').value || '').trim();
        const postalCode = (document.getElementById('postal_code').value || '').trim();
        const city = (document.getElementById('city').value || '').trim();

        if (!address && !city) {
            showToast('Vul minstens een adres of stad in.', 'error');
            return;
        }

        const parts = [address, postalCode, city, 'Belgium'].filter(Boolean);
        const addr = encodeURIComponent(parts.join(', '));
        const iframe = document.getElementById('propertyMapIframe');
        if (iframe) {
            iframe.src = `https://maps.google.com/maps?q=${addr}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
        }

        const container = document.getElementById('property-map-preview');
        if (container) container.style.display = 'block';
    }

    /* ── Init ──────────────────────────────────────────────── */

    document.addEventListener('DOMContentLoaded', async () => {
        const session = await window.Auth.checkAuth();
        if (!session) return;

        // Show user email
        const user = await window.Auth.getUser();
        const emailEl = document.getElementById('userEmail');
        if (emailEl && user) emailEl.textContent = user.email;

        // Init UI
        initSections();
        initPhotoUpload();
        initDocUpload();
        initTerraceToggle();

        // Load agents dropdown
        await loadAgentsDropdown();

        // Check edit mode
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('id');

        if (editId) {
            isEditMode = true;
            currentPropertyId = editId;
            await loadProperty(editId);
        }

        // Form submit
        document.getElementById('propertyForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveProperty();
        });

        // Property map preview button
        const mapBtn = document.getElementById('previewPropertyMapBtn');
        if (mapBtn) {
            mapBtn.addEventListener('click', (e) => {
                e.preventDefault();
                previewPropertyMap();
            });
        }

        // Remove invalid class on input
        document.querySelectorAll('input, select, textarea').forEach((el) => {
            el.addEventListener('input', () => el.classList.remove('invalid'));
            el.addEventListener('change', () => el.classList.remove('invalid'));
        });
    });
})();
