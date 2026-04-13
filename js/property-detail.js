// ============================================================
// VH Vastgoed — Property Detail Page
// Requires: js/supabase-config.js loaded first
// ============================================================

(function () {
    'use strict';

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------

    function getPublicUrlDetail(storagePath) {
        if (!storagePath) return null;
        const { data } = db.storage
            .from('property-media')
            .getPublicUrl(storagePath);
        return data?.publicUrl ?? null;
    }

    function formatPriceDetail(price, status) {
        if (price == null) return 'Prijs op aanvraag';
        const formatted = new Intl.NumberFormat('nl-BE', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
        if (status === 'te huur' || status === 'verhuurd') {
            return `\u20AC ${formatted} /maand`;
        }
        return `\u20AC ${formatted}`;
    }

    function boolLabel(val) {
        if (val === true) return 'Ja';
        if (val === false) return 'Nee';
        return null;
    }

    // ----------------------------------------------------------
    // Data fetching
    // ----------------------------------------------------------

    async function loadPropertyDetail(id) {
        try {
            const { data, error } = await db
                .from('properties')
                .select(`
                    *,
                    property_media (
                        id,
                        type,
                        storage_path,
                        file_name,
                        mime_type,
                        sort_order,
                        is_primary,
                        label
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('loadPropertyDetail error:', err);
            return null;
        }
    }

    // ----------------------------------------------------------
    // Gallery & Lightbox
    // ----------------------------------------------------------

    let lightboxImages = [];
    let lightboxIndex = 0;

    function openLightbox(index) {
        lightboxIndex = index;
        const overlay = document.getElementById('lightbox');
        const img = document.getElementById('lightbox-img');
        if (!overlay || !img) return;
        img.src = lightboxImages[index];
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        const overlay = document.getElementById('lightbox');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    function lightboxPrev() {
        lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
        document.getElementById('lightbox-img').src = lightboxImages[lightboxIndex];
    }

    function lightboxNext() {
        lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
        document.getElementById('lightbox-img').src = lightboxImages[lightboxIndex];
    }

    function initLightbox() {
        const overlay = document.getElementById('lightbox');
        if (!overlay) return;

        document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
        document.getElementById('lightbox-prev').addEventListener('click', lightboxPrev);
        document.getElementById('lightbox-next').addEventListener('click', lightboxNext);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeLightbox();
        });

        document.addEventListener('keydown', (e) => {
            if (overlay.style.display === 'none') return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') lightboxPrev();
            if (e.key === 'ArrowRight') lightboxNext();
        });
    }

    function renderGallery(media) {
        const mainImg = document.getElementById('gallery-main-img');
        const thumbsContainer = document.getElementById('gallery-thumbs');
        const prevBtn = document.getElementById('gallery-prev');
        const nextBtn = document.getElementById('gallery-next');
        if (!mainImg) return;

        const photos = (media ?? [])
            .filter((m) => m.type === 'photo')
            .sort((a, b) => {
                if (a.is_primary && !b.is_primary) return -1;
                if (!a.is_primary && b.is_primary) return 1;
                return (a.sort_order ?? 0) - (b.sort_order ?? 0);
            });

        if (photos.length === 0) {
            mainImg.src = 'assets/logo_transparent.png';
            mainImg.alt = 'Geen foto beschikbaar';
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            return;
        }

        lightboxImages = photos.map((p) => getPublicUrlDetail(p.storage_path));

        // Set main image
        mainImg.src = lightboxImages[0];
        mainImg.alt = 'Hoofdfoto';
        mainImg.style.cursor = 'pointer';
        mainImg.addEventListener('click', () => openLightbox(lightboxIndex));

        // Gallery arrow navigation
        let currentGalleryIndex = 0;

        function goToGalleryIndex(idx) {
            currentGalleryIndex = idx;
            lightboxIndex = idx;
            mainImg.src = lightboxImages[idx];
            if (thumbsContainer) {
                thumbsContainer.querySelectorAll('.gallery-thumb').forEach((t, i) => {
                    t.classList.toggle('active', i === idx);
                });
            }
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                goToGalleryIndex((currentGalleryIndex - 1 + lightboxImages.length) % lightboxImages.length);
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                goToGalleryIndex((currentGalleryIndex + 1) % lightboxImages.length);
            });
        }

        // Hide arrows if only one photo
        if (photos.length <= 1) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
        }

        // Render thumbnails
        if (thumbsContainer && photos.length > 1) {
            let thumbsHtml = '';
            photos.forEach((photo, idx) => {
                const url = lightboxImages[idx];
                thumbsHtml += `<img
                    class="gallery-thumb ${idx === 0 ? 'active' : ''}"
                    src="${url}"
                    alt="${photo.label || photo.file_name || 'Foto ' + (idx + 1)}"
                    data-index="${idx}"
                    loading="lazy"
                >`;
            });
            thumbsContainer.innerHTML = thumbsHtml;

            thumbsContainer.querySelectorAll('.gallery-thumb').forEach((thumb) => {
                thumb.addEventListener('click', () => {
                    goToGalleryIndex(Number(thumb.dataset.index));
                });
            });
        }
    }

    // ----------------------------------------------------------
    // Detail sections
    // ----------------------------------------------------------

    function renderHeader(property) {
        const typeEl = document.getElementById('detail-type');
        const addressEl = document.getElementById('detail-address');
        const priceEl = document.getElementById('detail-price');
        const specsEl = document.getElementById('detail-key-specs');

        if (typeEl) typeEl.textContent = property.type;
        if (addressEl) {
            addressEl.textContent =
                (property.address ? property.address + ', ' : '') +
                (property.postal_code ?? '') + ' ' +
                (property.city ?? '');
        }
        if (priceEl) priceEl.textContent = formatPriceDetail(property.price, property.status);

        if (specsEl) {
            const specs = [];
            if (property.bedrooms != null) specs.push(`<span><i class="fas fa-bed"></i> ${property.bedrooms} slpk</span>`);
            if (property.bathrooms != null) specs.push(`<span><i class="fas fa-bath"></i> ${property.bathrooms} badk</span>`);
            if (property.living_area != null) specs.push(`<span><i class="fas fa-vector-square"></i> ${property.living_area} m\u00B2</span>`);
            specsEl.innerHTML = specs.join('');
        }
    }

    function renderDescription(property) {
        const textEl = document.getElementById('detail-description-text');
        const refEl = document.getElementById('detail-ref');

        if (textEl) {
            textEl.innerHTML = (property.description ?? '').replace(/\n/g, '<br>');
        }
        if (refEl && property.reference_nr) {
            refEl.textContent = 'Ref: ' + property.reference_nr;
        }
    }

    function renderSpecs(property) {
        const grid = document.getElementById('specs-grid');
        if (!grid) return;

        const sections = {
            'Ligging': {
                'Adres': property.address,
                'Postcode': property.postal_code,
                'Gemeente': property.city,
                'Ori\u00EBntatie': property.orientation,
            },
            'Gebouw': {
                'Type': property.type,
                'Bouwjaar': property.build_year,
                'Staat': property.condition,
                'Verdiepingen': property.floors,
                'Totale oppervlakte': property.total_area != null ? `${property.total_area} m\u00B2` : null,
                'Bewoonbare opp.': property.living_area != null ? `${property.living_area} m\u00B2` : null,
            },
            'Indeling': {
                'Slaapkamers': property.bedrooms,
                'Badkamers': property.bathrooms,
                'Toiletten': property.toilets,
                'Keuken': property.kitchen_type,
                'Badkamer type': property.bathroom_type,
                'Wasruimte': boolLabel(property.laundry_room),
            },
            'Comfort': {
                'Tuin': boolLabel(property.garden),
                'Terras': boolLabel(property.terrace),
                'Terras oppervlakte': property.terrace_area != null ? `${property.terrace_area} m\u00B2` : null,
                'Garage': boolLabel(property.garage),
                'Parking': boolLabel(property.parking),
                'Kelder': boolLabel(property.cellar),
                'Zolder': boolLabel(property.attic),
                'Lift': boolLabel(property.elevator),
                'Gemeubeld': boolLabel(property.furnished),
            },
            'Energie': {
                'EPC score': property.epc_score != null ? `${property.epc_score} kWh/m\u00B2` : null,
                'EPC label': property.epc_label,
                'EPC unieke code': property.epc_unique_code,
                'Verwarming type': property.heating_type,
                'Verwarmingssysteem': property.heating_system,
                'Dubbele beglazing': boolLabel(property.double_glazing),
                'Raamtype': property.window_type,
            },
            'Technieken': {
                'Alarm': boolLabel(property.alarm),
                'Video-parlofoon': boolLabel(property.video_intercom),
                'Elektriciteitskeuring': boolLabel(property.electricity_inspection),
            },
            'Stedenbouw': {
                'Bouwvergunning': boolLabel(property.building_permit),
                'Verkavelingsvergunning': boolLabel(property.subdivision_permit),
                'Recht van voorkoop': boolLabel(property.pre_emption_right),
                'Overstromingsgebied': property.flood_zone,
                'G-score': property.g_score,
                'P-score': property.p_score,
                'Vonnissen': property.judgments,
                'Erfdienstbaarheid': property.servitude,
                'Bestemming': property.destination,
            },
        };

        let html = '';

        for (const [sectionTitle, fields] of Object.entries(sections)) {
            const rows = Object.entries(fields).filter(
                ([, val]) => val != null && val !== '' && val !== undefined
            );
            if (rows.length === 0) continue;

            html += `<div class="spec-section">
                <h3>${sectionTitle}</h3>
                <table class="spec-table">`;
            for (const [label, value] of rows) {
                html += `<tr><td>${label}</td><td>${value}</td></tr>`;
            }
            html += '</table></div>';
        }

        grid.innerHTML = html;
    }

    function renderPhotoStrip(media) {
        const section = document.getElementById('photo-strip-section');
        const strip = document.getElementById('photo-strip');
        if (!section || !strip) return;

        const photos = (media ?? [])
            .filter((m) => m.type === 'photo')
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        if (photos.length < 2) return; // No strip needed for 0-1 photos

        section.style.display = '';

        // Duplicate photos for infinite scroll effect
        const allPhotos = [...photos, ...photos];
        let html = '';

        allPhotos.forEach((photo, idx) => {
            const url = getPublicUrlDetail(photo.storage_path);
            const label = photo.label || photo.file_name || '';
            const realIdx = idx % photos.length;

            html += `<div class="photo-strip-item" data-lightbox-idx="${realIdx}">
                <img src="${url}" alt="${label}" loading="lazy">
                ${label ? `<span class="photo-strip-label">${label}</span>` : ''}
            </div>`;
        });

        strip.innerHTML = html;

        // Click to open lightbox
        strip.querySelectorAll('.photo-strip-item').forEach((item) => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.lightboxIdx, 10);
                openLightbox(idx);
            });
        });
    }

    function renderDocuments(media) {
        const section = document.getElementById('detail-documents');
        const list = document.getElementById('downloads-list');
        if (!section || !list) return;

        const docs = (media ?? [])
            .filter((m) => m.type === 'document')
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        if (docs.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';

        let html = '';
        for (const doc of docs) {
            const url = getPublicUrlDetail(doc.storage_path);
            const ext = (doc.file_name || '').split('.').pop().toUpperCase();
            html += `<a href="${url}" target="_blank" rel="noopener" download class="download-item">
                <span class="download-ext">${ext}</span>
                <span class="download-name">${doc.label || doc.file_name || 'Document'}</span>
                <i class="fas fa-download"></i>
            </a>`;
        }
        list.innerHTML = html;
    }

    async function renderAgent(property) {
        const contactCard = document.getElementById('detail-contact');
        if (!contactCard) return;

        // Default agent info (Nico Van Hulle)
        let agentName = 'Nico Van Hulle';
        let agentPhone = '0475/73.40.69';
        let agentPhoneTel = '+32475734069';
        let agentEmail = 'nico@vh-vastgoed.be';
        let agentPhotoUrl = null;

        if (property.agent_id) {
            try {
                const { data: agent, error } = await db
                    .from('agents')
                    .select('*')
                    .eq('id', property.agent_id)
                    .maybeSingle();

                if (agent && !error) {
                    agentName = `${agent.first_name} ${agent.last_name}`;
                    agentPhone = agent.phone || agentPhone;
                    agentEmail = agent.email || agentEmail;

                    // Build tel: link from phone
                    agentPhoneTel = '+32' + agentPhone.replace(/[\s\/\-\+]/g, '').replace(/^0/, '');

                    if (agent.photo_path) {
                        const { data: urlData } = db.storage
                            .from('agent-photos')
                            .getPublicUrl(agent.photo_path);
                        agentPhotoUrl = urlData?.publicUrl || null;
                    }
                }
            } catch (err) {
                console.error('Failed to load agent:', err);
            }
        }

        const photoHtml = agentPhotoUrl
            ? `<img src="${agentPhotoUrl}" alt="${agentName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
            : '<i class="fas fa-user-tie"></i>';

        contactCard.innerHTML = `
            <h3>Uw Contact</h3>
            <div class="agent-photo">${photoHtml}</div>
            <p class="agent-name">${agentName}</p>
            <p class="agent-phone"><i class="fas fa-phone"></i> <a href="tel:${agentPhoneTel}">${agentPhone}</a></p>
            <p class="agent-email"><i class="fas fa-envelope"></i> <a href="mailto:${agentEmail}">${agentEmail}</a></p>
            <a href="contact.html" class="btn-contact">Contact</a>
        `;
    }

    function renderShareLinks(property, displayTitle) {
        const pageUrl = encodeURIComponent(window.location.href);
        const pageTitle = encodeURIComponent(displayTitle + ' \u2014 VH Vastgoed');

        const fb = document.getElementById('share-facebook');
        const tw = document.getElementById('share-twitter');
        const wa = document.getElementById('share-whatsapp');
        const em = document.getElementById('share-email');

        if (fb) fb.href = `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`;
        if (tw) tw.href = `https://twitter.com/intent/tweet?url=${pageUrl}&text=${pageTitle}`;
        if (wa) wa.href = `https://wa.me/?text=${pageTitle}%20${pageUrl}`;
        if (em) em.href = `mailto:?subject=${pageTitle}&body=${pageUrl}`;

        // Map link
        const mapLink = document.getElementById('action-map');
        if (mapLink && property.address) {
            const addr = encodeURIComponent(
                (property.address || '') + ', ' +
                (property.postal_code || '') + ' ' +
                (property.city || '')
            );
            mapLink.href = `https://www.google.com/maps/search/?api=1&query=${addr}`;
            mapLink.target = '_blank';
        }

        // Back link
        const backLink = document.getElementById('back-link');
        if (backLink) {
            const isRent = property.status === 'te huur' || property.status === 'verhuurd';
            const a = backLink.querySelector('a');
            if (a) a.href = isRent ? 'te-huur.html' : 'te-koop.html';
        }
    }

    // ----------------------------------------------------------
    // JSON-LD Structured Data
    // ----------------------------------------------------------

    function injectJsonLd(property, photos, displayTitle) {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'RealEstateListing',
            name: displayTitle,
            description: property.description ?? '',
            url: window.location.href,
            datePosted: property.created_at,
            image: photos,
            address: {
                '@type': 'PostalAddress',
                streetAddress: property.address ?? '',
                postalCode: property.postal_code ?? '',
                addressLocality: property.city ?? '',
                addressCountry: 'BE',
            },
        };

        if (property.price != null) {
            const isRent = property.status === 'te huur' || property.status === 'verhuurd';
            schema.offers = {
                '@type': 'Offer',
                price: property.price,
                priceCurrency: 'EUR',
                availability: (property.status === 'verkocht' || property.status === 'verhuurd')
                    ? 'https://schema.org/SoldOut'
                    : 'https://schema.org/InStock',
            };
            if (isRent) {
                schema.offers.priceSpecification = {
                    '@type': 'UnitPriceSpecification',
                    price: property.price,
                    priceCurrency: 'EUR',
                    unitText: 'MONTH',
                };
            }
        }

        if (property.living_area != null) {
            schema.floorSize = {
                '@type': 'QuantitativeValue',
                value: property.living_area,
                unitCode: 'MTK',
            };
        }
        if (property.bedrooms != null) {
            schema.numberOfBedrooms = property.bedrooms;
        }
        if (property.bathrooms != null) {
            schema.numberOfBathroomsTotal = property.bathrooms;
        }

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
    }

    // ----------------------------------------------------------
    // State management
    // ----------------------------------------------------------

    function showLoading() {
        const el = document.getElementById('loading-state');
        if (el) el.style.display = '';
    }

    function hideLoading() {
        const el = document.getElementById('loading-state');
        if (el) el.style.display = 'none';
    }

    function showNotFound() {
        hideLoading();
        const empty = document.getElementById('empty-state');
        if (empty) empty.style.display = '';
        const content = document.getElementById('property-content');
        if (content) content.style.display = 'none';
        document.title = 'Pand niet gevonden \u2014 VH Vastgoed';
    }

    function showContent() {
        hideLoading();
        const empty = document.getElementById('empty-state');
        if (empty) empty.style.display = 'none';
        const content = document.getElementById('property-content');
        if (content) content.style.display = '';
    }

    // ----------------------------------------------------------
    // Init
    // ----------------------------------------------------------

    async function init() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');

        if (!id) {
            showNotFound();
            return;
        }

        const property = await loadPropertyDetail(id);

        if (!property) {
            showNotFound();
            return;
        }

        // Build a display title with fallback
        const displayTitle = property.title ||
            ((property.type || '') + ' ' + (property.address || '') + ' ' + (property.city || '')).trim() ||
            'Pand Details';

        // Update page title
        document.title = `${displayTitle} \u2014 VH Vastgoed`;

        // Init lightbox
        initLightbox();

        // Show content
        showContent();

        // Render all sections
        renderGallery(property.property_media);
        renderHeader(property);
        renderDescription(property);
        renderSpecs(property);
        renderDocuments(property.property_media);
        renderPhotoStrip(property.property_media);
        renderShareLinks(property, displayTitle);
        await renderAgent(property);

        // SEO structured data
        const photoUrls = (property.property_media ?? [])
            .filter((m) => m.type === 'photo')
            .map((m) => getPublicUrlDetail(m.storage_path))
            .filter(Boolean);
        injectJsonLd(property, photoUrls, displayTitle);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
