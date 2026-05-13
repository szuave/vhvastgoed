// Cloudflare Pages Function: proxy Supabase Storage through Cloudflare's CDN.
// Each image is fetched once from Supabase, then cached at Cloudflare's edge
// (no egress fees, no bandwidth limits).
//
// Route: /storage-img/<bucket>/<rest-of-path>
// Example: /storage-img/property-media/abc/foto.jpg
//   -> https://....supabase.co/storage/v1/object/public/property-media/abc/foto.jpg

const SUPABASE_PUBLIC_BASE =
    'https://vziiwmfrqzdosnlnenbq.supabase.co/storage/v1/object/public';

export async function onRequest(context) {
    const path = (context.params.path || []).join('/');
    const supabaseUrl = `${SUPABASE_PUBLIC_BASE}/${path}`;

    const upstream = await fetch(supabaseUrl, {
        cf: { cacheTtl: 31536000, cacheEverything: true },
    });

    const headers = new Headers(upstream.headers);
    headers.set(
        'Cache-Control',
        'public, max-age=2592000, s-maxage=31536000, immutable'
    );

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
    });
}
