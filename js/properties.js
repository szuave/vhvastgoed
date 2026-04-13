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
function formatPrice(price, status) {
    if (price == null) return 'Prijs op aanvraag';

    const formatted = new Intl.NumberFormat('nl-BE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price);

    if (status === 'te huur' || status === 'verhuurd') {
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
            .eq('status', status)
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
        return (data ?? []).map((property) => {
            const photos = (property.property_media ?? []).filter((m) => m.type === 'photo');
            const primary = photos.find((m) => m.is_primary) ?? photos[0] ?? null;
            return {
                ...property,
                primaryPhoto: primary ? getPublicUrl(primary.storage_path) : null,
            };
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
    const isSold = property.status === 'verkocht' || property.status === 'verhuurd';
    const isRental = property.status === 'te huur';
    const badgeClass = isSold ? 'badge sold' : isRental ? 'badge huur' : 'badge';

    const title = escapeHtml(property.title);
    const city = escapeHtml(property.city);
    const status = escapeHtml(property.status);
    const safeId = escapeHtml(property.id);
    const safeImg = escapeHtml(imageUrl);

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
            .eq('status', status)
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
