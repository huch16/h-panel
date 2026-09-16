import { isAdminAuthenticated, errorResponse, jsonResponse } from '../../_middleware';

/**
 * POST /api/ai/generate-icon
 * Body: { title: string, url?: string, desc?: string }
 * Returns: { logo: "data:image/png;base64,..." }
 *
 * Uses Cloudflare Workers AI (Stable Diffusion XL) to create a simple,
 * flat‑style icon/logo for a bookmark.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAdminAuthenticated || !(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }
  if (!env.AI) {
    return errorResponse('AI binding not configured', 503);
  }

  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON', 400); }

  const title = String(body?.title || '').trim();
  const desc  = String(body?.desc  || '').trim();
  const url   = String(body?.url   || '').trim();

  if (!title) return errorResponse('Title is required', 400);

  // Construct a concise, design‑oriented prompt
  const prompt = [
    `A clean, modern, flat‑design icon or logo for a website titled "${title}".`,
    desc ? `Theme: ${desc}.` : '',
    url ? `Domain: ${url}.` : '',
    'The icon should be simple, instantly recognizable, suitable for a 64×64 size, vibrant colors, no text, no background clutter, vector‑like style.'
  ].filter(Boolean).join(' ');

  try {
    const result = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt,
      height: 256,
      width: 256,
      num_steps: 20,
      guidance_scale: 7.5,
    });

    // Result may be ArrayBuffer, string, or { image: base64 }
    let base64;
    if (result instanceof ArrayBuffer) {
      const bytes = new Uint8Array(result);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      base64 = btoa(binary);
    } else if (typeof result === 'string') {
      base64 = result;
    } else if (result?.image) {
      base64 = result.image;
    } else if (result?.result?.image) {
      base64 = result.result.image;
    }

    if (!base64) throw new Error('AI did not return image data');

    // Strip data URL prefix if present
    if (base64.startsWith('data:')) {
      const match = base64.match(/base64,(.*)$/);
      base64 = match ? match[1] : base64;
    }

    return jsonResponse({ logo: `data:image/png;base64,${base64}` });
  } catch (e) {
    return errorResponse('AI generation failed: ' + (e?.message || e), 500);
  }
}
