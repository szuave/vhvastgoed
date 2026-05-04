// ============================================================
// VH Vastgoed — Shared Property Loading & Rendering
// Used by te-koop.html and te-huur.html
// Requires: js/supabase-config.js loaded first
// ============================================================

/**
 * Build the public URL for a file in the property-media storage bucket.
 */
function getPublicUrl(storagePath) {
    if (!storagePath) return null;
    const { data } = db.storage
        .from('property-media')
        .getPublicUrl(storagePath);
    return data?.publicUrl ?? null;
}

/**
 * Format a price value for display.
 * Sale  → "€ 349.000"
 * Rent  → "€ 850 /maand"
 */
function inOptieStatusFor(status) {
    return status === 'te huur' ? 'in optie te huur' : 'in optie te koop';
}

function soldStatusFor(status) {
    return status === 'te huur' ? 'verhuurd' : 'verkocht';
}

function isInOptie(status) {
    return status === 'in optie te koop' || status === 'in optie te huur';
}

function isSold(status) {
    return status === 'verkocht' || status === 'verhuurd';
}

function formatPrice(price, status) {
    if (price == null) return 'Prijs op aanvraag';

    const formatted = new Intl.NumberFormat('nl-BE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price);

    if (status === 'te huur' || status === 'verhuurd' || status === 'in optie te huur') {
        return `€ ${formatted} /maand`;
    }
    return `€ ${formatted}`;
}

/**
 * Load properties from Supabase filtered by status with optional filters.
 *
 * @param {string}  status  - 'te koop' | 'te huur' | etc.
 * @param {Object}  filters - { type, city, minPrice, maxPrice, bedrooms }
 * @returns {Promise<Array>}
 */
async function loadProperties(status, filters = {}) {
    try {
        let query = db
            .from('properties')
            .select(`
                *,
                property_media (
                    id,
                    storage_path,
                    file_name,
                    sort_order,
                    is_primary,
                    type
                )
            `)
            .in('status', [status, inOptieStatusFor(status), soldStatusFor(status)])
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        // Optional filters
        if (filters.type) query = query.eq('type', filters.type);
        if (filters.city) query = query.eq('city', filters.city);
        if (filters.minPrice) query = query.gte('price', Number(filters.minPrice));
        if (filters.maxPrice) query = query.lte('price', Number(filters.maxPrice));
        if (filters.bedrooms) query = query.gte('bedrooms', Number(filters.bedrooms));

        const { data, error } = await query;
        if (error) throw error;

        // Pick primary photo client-side: prefer is_primary=true, fall back to first photo
        const enriched = (data ?? []).map((property) => {
            const photos = (property.property_media ?? []).filter((m) => m.type === 'photo');
            const primary = photos.find((m) => m.is_primary) ?? photos[0] ?? null;
            return {
                ...property,
                primaryPhoto: primary ? getPublicUrl(primary.storage_path) : null,
            };
        });

        // Sort sold/rented properties to the end so active listings appear first
        return enriched.sort((a, b) => {
            const aSold = isSold(a.status) ? 1 : 0;
            const bSold = isSold(b.status) ? 1 : 0;
            return aSold - bSold;
        });
    } catch (err) {
        console.error('loadProperties error:', err);
        return [];
    }
}

/**
 * Render a single property card as an HTML string.
 * Uses the existing CSS class structure.
 */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderPropertyCard(property) {
    const imageUrl = property.primaryPhoto ?? 'assets/logo_transparent.png';
    const sold = isSold(property.status);
    const isOptie = isInOptie(property.status);
    const isRental = property.status === 'te huur' || property.status === 'in optie te huur';
    const badgeClass = isOptie ? 'badge optie' : sold ? 'badge sold' : isRental ? 'badge huur' : 'badge';
    const badgeLabel = isOptie ? 'In Optie' : property.status;

    const title = escapeHtml(property.title);
    const city = escapeHtml(property.city);
    const status = escapeHtml(badgeLabel);
    const safeId = escapeHtml(property.id);
    const safeImg = escapeHtml(imageUrl);

    // Sold/rented properties: show as non-clickable, dimmed, photo-only card
    if (sold) {
        return `
            <div class="property-card sold-card">
                <div class="property-img">
                    <img src="${safeImg}" alt="${title}" loading="lazy">
                    <span class="${badgeClass}">${status}</span>
                </div>
                <div class="property-info">
                    <h4>${title}</h4>
                    <p class="property-location"><i class="fas fa-map-marker-alt"></i> ${city}</p>
                </div>
            </div>`;
    }

    const specs = [];
    if (property.bedrooms != null)   specs.push(`<span>${Number(property.bedrooms)} slpk</span>`);
    if (property.bathrooms != null)  specs.push(`<span>${Number(property.bathrooms)} badk</span>`);
    if (property.living_area != null) specs.push(`<span>${Number(property.living_area)} m²</span>`);

    return `
        <div class="property-card" onclick="window.location.href='property.html?id=${safeId}'" style="cursor:pointer;">
            <div class="property-img">
                <img src="${safeImg}" alt="${title}" loading="lazy">
                <span class="${badgeClass}">${status}</span>
                <div class="property-img-overlay"><a href="property.html?id=${safeId}" class="btn-view">Bekijken</a></div>
            </div>
            <div class="property-info">
                <h4>${title}</h4>
                <p class="property-location"><i class="fas fa-map-marker-alt"></i> ${city}</p>
                <p class="property-price">${formatPrice(property.price, property.status)}</p>
                <div class="property-specs">
                    ${specs.join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Load unique cities for a given status to populate the city filter dropdown.
 */
async function loadCities(status) {
    try {
        const { data, error } = await db
            .from('properties')
            .select('city')
            .in('status', [status, inOptieStatusFor(status)])
            .not('city', 'is', null)
            .order('city', { ascending: true });

        if (error) throw error;

        // Deduplicate
        const unique = [...new Set((data ?? []).map((r) => r.city))];
        return unique;
    } catch (err) {
        console.error('loadCities error:', err);
        return [];
    }
}

/**
 * Read the current state of all filter controls.
 */
function readFilters() {
    return {
        type:      document.getElementById('filter-type')?.value     || '',
        city:      document.getElementById('filter-city')?.value     || '',
        minPrice:  document.getElementById('filter-price')?.value?.split('-')[0] || '',
        maxPrice:  document.getElementById('filter-price')?.value?.split('-')[1] || '',
        bedrooms:  document.getElementById('filter-bedrooms')?.value || '',
    };
}

/**
 * Main init function — call on page load with the relevant status.
 *
 * @param {string} status - 'te koop' | 'te huur'
 */
async function initPropertyPage(status) {
    const grid = document.getElementById('properties-grid');
    const countEl = document.getElementById('property-count');

    // Reusable observer (avoids memory leak from creating new observer per refresh)
    let cardObserver = null;
    const getObserver = () => {
        if (cardObserver) cardObserver.disconnect();
        cardObserver = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
        }, { threshold: 0.1 });
        return cardObserver;
    };

    // Helper: load & render
    const refresh = async () => {
        if (grid) grid.innerHTML = '<p class="loading">Laden...</p>';

        const filters = readFilters();
        const properties = await loadProperties(status, filters);

        if (countEl) countEl.textContent = properties.length;
        if (!grid) return;

        if (properties.length === 0) {
            grid.innerHTML = '<p class="no-results">Geen panden gevonden.</p>';
            return;
        }

        grid.innerHTML = properties.map(renderPropertyCard).join('');
        const observer = getObserver();
        grid.querySelectorAll('.property-card').forEach(el => observer.observe(el));
    };

    // Populate city dropdown
    const citySelect = document.getElementById('filter-city');
    if (citySelect) {
        const cities = await loadCities(status);
        cities.forEach((city) => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.textContent = city;
            citySelect.appendChild(opt);
        });
    }

    // Bind filter controls
    const filterIds = ['filter-type', 'filter-city', 'filter-price', 'filter-bedrooms'];
    for (const id of filterIds) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', refresh);
    }

    // Bind the "Zoeken" button
    const filterBtn = document.querySelector('.filter-btn');
    if (filterBtn) filterBtn.addEventListener('click', refresh);

    // Initial load
    await refresh();
}
