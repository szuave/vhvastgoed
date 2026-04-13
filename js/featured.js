// ============================================================
// VH Vastgoed — Homepage Featured Properties
// Requires: js/supabase-config.js and js/properties.js loaded first
// ============================================================

/**
 * Load featured properties (max 4) that are actively for sale or rent.
 */
async function loadFeaturedProperties() {
    try {
        const { data, error } = await db
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
            .eq('featured', true)
            .in('status', ['te koop', 'te huur'])
            .order('sort_order', { ascending: true })
            .limit(4);

        if (error) throw error;

        // Pick primary photo client-side
        return (data ?? []).map((property) => {
            const photos = (property.property_media ?? []).filter((m) => m.type === 'photo');
            const primary = photos.find((m) => m.is_primary) ?? photos[0] ?? null;
            return {
                ...property,
                primaryPhoto: primary ? getPublicUrl(primary.storage_path) : null,
            };
        });
    } catch (err) {
        console.error('loadFeaturedProperties error:', err);
        return [];
    }
}

/**
 * Render featured properties into #featured-grid.
 */
async function renderFeatured() {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;

    grid.innerHTML = '<p class="loading">Laden...</p>';

    try {
        const properties = await loadFeaturedProperties();

        if (properties.length === 0) {
            grid.innerHTML = '<p class="no-results">Momenteel geen aanbod beschikbaar</p>';
            return;
        }

        grid.innerHTML = properties.map(renderPropertyCard).join('');

        // Trigger scroll animations on new cards
        const observer = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
        }, { threshold: 0.1 });
        grid.querySelectorAll('.property-card').forEach(el => observer.observe(el));
    } catch (err) {
        console.error('renderFeatured error:', err);
        grid.innerHTML = '<p class="no-results">Er ging iets mis bij het laden.</p>';
    }
}

// Self-executing on DOMContentLoaded
document.addEventListener('DOMContentLoaded', renderFeatured);
