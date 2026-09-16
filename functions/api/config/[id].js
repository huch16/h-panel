// functions/api/config/[id].js
import { isAdminAuthenticated, errorResponse, jsonResponse, normalizeSortOrder, markHomeCacheDirty } from '../../_middleware';
import { buildFaviconUrl, getUrlMatchCandidates, normalizeUrlForStorage } from '../../lib/utils';
import { normalizeBookmarkDesc, normalizeBookmarkLogo, normalizeBookmarkName, normalizeBookmarkUrl } from '../../lib/validators';


export async function onRequestGet(context) {
  const { request, env, params } = context;
  const id = params.id;
  const { results } = await env.NAV_DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).all();
  if (results.length === 0) {
    return errorResponse('config not found', 404);
  }
  const config = results[0];
  
  // 私密站点需要认证才能访问
  if (config.is_private && !(await isAdminAuthenticated(request, env))) {
    return errorResponse('config not found', 404);
  }
  
  return jsonResponse({
    code: 200,
    data: config
  });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const id = params.id;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }
  
  try {
    const existing = await env.NAV_DB.prepare('SELECT id, is_private FROM sites WHERE id = ?').bind(id).first();
    if (!existing) {
      return errorResponse('config not found', 404);
    }

    const config = await request.json();
    const { name, url, logo, desc, catelog_id, sort_order, is_private } = config;

    const nameResult = normalizeBookmarkName(name);
    if (!nameResult.ok) return errorResponse(nameResult.message, 400);

    const urlResult = normalizeBookmarkUrl(url);
    if (!urlResult.ok) return errorResponse(urlResult.message, 400);

    const logoResult = normalizeBookmarkLogo(logo, { nullIfEmpty: true });
    if (!logoResult.ok) return errorResponse(logoResult.message, 400);

    const descResult = normalizeBookmarkDesc(desc, { nullIfEmpty: true });
    if (!descResult.ok) return errorResponse(descResult.message, 400);

    const sanitizedName = nameResult.value;
    const rawUrl = urlResult.value;
    const sanitizedUrl = normalizeUrlForStorage(rawUrl);
    let sanitizedLogo = logoResult.value;
    const sanitizedDesc = descResult.value;
    const sortOrderValue = normalizeSortOrder(sort_order);
    const isPrivateValue = is_private ? 1 : 0;

    if (!catelog_id) {
      return errorResponse('Catelog is required', 400);
    }
    if (!sanitizedUrl) {
      return errorResponse('URL must be a valid http or https URL', 400);
    }

    const urlCandidates = getUrlMatchCandidates(rawUrl);
    const placeholders = urlCandidates.map(() => '?').join(',');
    const duplicate = await env.NAV_DB.prepare(`SELECT id FROM sites WHERE url IN (${placeholders}) AND id != ?`)
      .bind(...urlCandidates, id)
      .first();
    if (duplicate) {
      return errorResponse('该 URL 已存在，请勿重复添加', 409);
    }

    const iconAPI = env.ICON_API || 'https://faviconsnap.com/api/favicon?url=';
    sanitizedLogo = buildFaviconUrl(sanitizedUrl, sanitizedLogo, iconAPI);

    // 🔶 若仍未获取到 logo 且 Workers AI 可用，则自动生成
    if (!sanitizedLogo && env.AI) {
      try {
        const aiResp = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
          prompt: `A clean, modern, flat‑design icon or logo for a website titled "${sanitizedName}". ${sanitizedDesc ? 'Theme: ' + sanitizedDesc + '.' : ''} The icon should be simple, instantly recognizable, suitable for a 64×64 size, vibrant colors, no text, no background clutter, vector‑like style.`,
          height: 256,
          width: 256,
          num_steps: 20,
          guidance_scale: 7.5,
        });
        let b64;
        if (aiResp instanceof ArrayBuffer) {
          const bytes = new Uint8Array(aiResp);
          let bin = '';
          for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
          b64 = btoa(bin);
        } else if (aiResp instanceof Uint8Array) {
          let bin = '';
          for (let i = 0; i < aiResp.byteLength; i++) bin += String.fromCharCode(aiResp[i]);
          b64 = btoa(bin);
        } else if (typeof ReadableStream !== 'undefined' && aiResp instanceof ReadableStream) {
          const reader = aiResp.getReader();
          const chunks = [];
          let total = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            total += value.byteLength;
          }
          const bytes = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          let bin = '';
          for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
          b64 = btoa(bin);
        } else if (typeof aiResp === 'string') {
          b64 = aiResp;
        } else if (aiResp?.image) {
          b64 = aiResp.image;
        } else if (aiResp?.result?.image) {
          b64 = aiResp.result.image;
        }
        if (b64 && b64.startsWith('data:')) {
          const m = b64.match(/base64,(.*)$/);
          b64 = m ? m[1] : b64;
        }
        if (b64) sanitizedLogo = `data:image/png;base64,${b64}`;
      } catch (e) {
        console.log('AUTO_ICON_GEN_FAIL', e.message);
      }
    }

    // Fetch category name
    const categoryResult = await env.NAV_DB.prepare('SELECT catelog, is_private FROM category WHERE id = ?').bind(catelog_id).first();
    if (!categoryResult) {
      return errorResponse('Category not found.', 400);
    }
    const catelogName = categoryResult.catelog;

    // If category is private, force site to be private
    let finalIsPrivate = isPrivateValue;
    if (categoryResult.is_private === 1) {
        finalIsPrivate = 1;
    }

    const update = await env.NAV_DB.prepare(`
      UPDATE sites
      SET name = ?, url = ?, logo = ?, desc = ?, catelog_id = ?, catelog_name = ?, sort_order = ?, is_private = ?, update_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(sanitizedName, sanitizedUrl, sanitizedLogo, sanitizedDesc, catelog_id, catelogName, sortOrderValue, finalIsPrivate, id).run();

    const dirtyScope = (existing.is_private === 1 && finalIsPrivate === 1) ? 'private' : 'all';
    await markHomeCacheDirty(env, dirtyScope);

    return jsonResponse({
      code: 200,
      message: 'Config updated successfully',
      update
    });
  } catch (e) {
    return errorResponse(`Failed to update config: ${e.message}`, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const id = params.id;

  if (!(await isAdminAuthenticated(request, env))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const existing = await env.NAV_DB.prepare('SELECT id, is_private FROM sites WHERE id = ?').bind(id).first();
    if (!existing) {
      return errorResponse('config not found', 404);
    }

    const del = await env.NAV_DB.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();

    await markHomeCacheDirty(env, existing.is_private ? 'private' : 'all');

    return jsonResponse({
      code: 200,
      message: 'Config deleted successfully',
      del
    });
  } catch (e) {
    return errorResponse(`Failed to delete config: ${e.message}`, 500);
  }
}
