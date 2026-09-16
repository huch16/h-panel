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

    // 调试日志：记录返回类型
    console.log('AI_RESULT_TYPE', typeof result, result && (result.constructor?.name || Object.keys(result)));
    if (result instanceof ArrayBuffer) {
      console.log('AI_RESULT_AB_LENGTH', result.byteLength);
    }

    // Result may be ArrayBuffer, Uint8Array, Blob, ReadableStream, string, or { image: base64 }
    let bytes;
    if (result instanceof ArrayBuffer) {
      bytes = new Uint8Array(result);
    } else if (result instanceof Uint8Array) {
      bytes = result;
    } else if (typeof Blob !== 'undefined' && result instanceof Blob) {
      bytes = new Uint8Array(await result.arrayBuffer());
    } else if (typeof ReadableStream !== 'undefined' && result instanceof ReadableStream) {
      // Cloudflare Workers AI in Pages Functions returns a ReadableStream
      const reader = result.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
      }
      bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    } else if (typeof result === 'string') {
      // Assume base64 string
      let s = result;
      if (s.startsWith('data:')) {
        const m = s.match(/base64,(.*)$/);
        s = m ? m[1] : s;
      }
      return jsonResponse({ logo: `data:image/png;base64,${s}` });
    } else if (result?.image) {
      let s = result.image;
      if (s.startsWith('data:')) {
        const m = s.match(/base64,(.*)$/);
        s = m ? m[1] : s;
      }
      return jsonResponse({ logo: `data:image/png;base64,${s}` });
    } else {
      throw new Error('Unsupported AI response type: ' + (typeof result));
    }

    // Convert Uint8Array to base64
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    return jsonResponse({ logo: `data:image/png;base64,${base64}` });
  } catch (e) {
    return errorResponse('AI generation failed: ' + (e?.message || e), 500);
  }
}
