export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Password-protected personal archive administration.
    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      return handleAdminLogin(request, env);
    }

    if (url.pathname === '/api/admin/session' && request.method === 'GET') {
      return handleAdminSession(request, env);
    }

    if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
      return handleAdminLogout(request, env);
    }

    if (url.pathname === '/api/admin/photos' && request.method === 'POST') {
      return handleAdminPhotoUpload(request, env, ctx);
    }

    const adminMomentMatch = url.pathname.match(/^\/api\/admin\/moments\/([^/]+)$/);
    if (adminMomentMatch && request.method === 'PATCH') {
      return handleAdminMomentUpdate(request, env, ctx, decodeURIComponent(adminMomentMatch[1]));
    }
    if (adminMomentMatch && request.method === 'DELETE') {
      return handleAdminMomentDelete(request, env, ctx, decodeURIComponent(adminMomentMatch[1]));
    }

    const adminMomentPhotosMatch = url.pathname.match(/^\/api\/admin\/moments\/([^/]+)\/photos$/);
    if (adminMomentPhotosMatch && request.method === 'POST') {
      return handleAdminMomentPhotoAppend(request, env, ctx, decodeURIComponent(adminMomentPhotosMatch[1]));
    }

    const adminPhotoMatch = url.pathname.match(/^\/api\/admin\/moments\/([^/]+)\/photos\/([^/]+)$/);
    if (adminPhotoMatch && request.method === 'DELETE') {
      return handleAdminPhotoDelete(
        request,
        env,
        ctx,
        decodeURIComponent(adminPhotoMatch[1]),
        decodeURIComponent(adminPhotoMatch[2])
      );
    }

    // Route API request for personal photos
    if (url.pathname === '/api/personal-photos') {
      return await handlePersonalPhotos(request, env, ctx);
    }

    // Route /meet -> meet.html
    if (url.pathname === '/meet' || url.pathname === '/meet/') {
      const meetUrl = new URL(request.url);
      meetUrl.pathname = '/meet.html';
      return await env.ASSETS.fetch(new Request(meetUrl.toString(), request));
    }

    // Route /blog and /blog/* to the generated MkDocs output
    if (url.pathname === '/blog' || url.pathname === '/blog/') {
      const blogUrl = new URL(request.url);
      blogUrl.pathname = '/blog/index.html';
      return await env.ASSETS.fetch(new Request(blogUrl.toString(), request));
    }

    if (url.pathname.startsWith('/blog/')) {
      const blogUrl = new URL(request.url);
      const lastSegment = blogUrl.pathname.split('/').pop();
      const looksLikeFile = Boolean(lastSegment && lastSegment.includes('.'));

      if (!looksLikeFile) {
        blogUrl.pathname = `${blogUrl.pathname.replace(/\/$/, '')}/index.html`;
      }

      return await env.ASSETS.fetch(new Request(blogUrl.toString(), request));
    }

    // Route /personal -> personal.html (handles subpages client-side)
    if (url.pathname.startsWith('/personal')) {
      const personalUrl = new URL(request.url);
      personalUrl.pathname = '/personal.html';
      return await env.ASSETS.fetch(new Request(personalUrl.toString(), request));
    }

    return await env.ASSETS.fetch(request);
  }
}

async function handlePersonalPhotos(request, env, ctx) {
  const url = new URL(request.url);
  const privateKey = env.IMAGEKIT_PRIVATE_KEY;

  // Graceful fallback if credentials are missing
  if (!privateKey) {
    console.warn("ImageKit API configuration missing. Falling back to local mock data.");
    return new Response(JSON.stringify({
      error: "ImageKit credentials missing in environment variables.",
      fallback: true
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  let folder = env.IMAGEKIT_PERSONAL_FOLDER || "/personal";
  if (!folder.startsWith('/')) folder = '/' + folder;
  if (!folder.endsWith('/')) folder = folder + '/';

  // Caching using Cloudflare Cache API (if available) - disabled locally to prevent Miniflare SQLite lockups
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const cache = (typeof caches !== 'undefined' && !isLocal) ? caches.default : null;
  let cacheKey = null;
  if (cache) {
    try {
      const cacheUrl = new URL(request.url);
      cacheKey = new Request(cacheUrl.toString(), request);
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    } catch (e) {
      console.warn("Cache lookup failed: ", e);
    }
  }

  try {
    const imagekitUrl = `https://api.imagekit.io/v1/files?path=${encodeURIComponent(folder)}&fileType=image&limit=100`;
    
    // Auth encoding supporting both standard Workers (btoa) and local Node fallbacks (Buffer)
    let authString;
    const rawAuth = `${privateKey}:`;
    if (typeof btoa === 'function') {
      authString = btoa(rawAuth);
    } else if (typeof Buffer !== 'undefined') {
      authString = Buffer.from(rawAuth).toString('base64');
    } else {
      throw new Error("Base64 encoder not available");
    }

    // Add AbortController fetch timeout (8s) to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(imagekitUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authString}`
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ImageKit API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Invalid ImageKit API response structure (expected array)");
    }

    const normalizedPhotos = [];
    data.forEach(item => {
      const customMetadata = item.customMetadata || {};

      // Only display photos that have an explicitly set title in the metadata (Publishing Gatekeeper)
      if (!customMetadata.title) {
        return;
      }

      const tags = item.tags || [];

      // Format ISO Date to YYYY-MM-DD
      let displayDate = '';
      if (customMetadata.date) {
        try {
          displayDate = customMetadata.date.split('T')[0];
        } catch (e) {
          displayDate = '';
        }
      }

      const captionData = parsePortfolioCaption(customMetadata.caption || '');
      const derivedIdentity = derivePhotoIdentity(item);
      const rawCategory = customMetadata.category || getCategoryFromTags(tags) || 'Life';
      normalizedPhotos.push({
        title: customMetadata.title,
        subtitle: customMetadata.subtitle || captionData.subtitle,
        caption: customMetadata.subtitle || captionData.subtitle,
        imageUrl: item.url,
        // A moderate-size delivery image for the timeline. The untouched
        // original remains available as imageUrl for the lightbox.
        displayUrl: imageKitDisplayUrl(item.url),
        thumbnailUrl: item.thumbnail || '',
        category: rawCategory === 'Small Notes' ? 'Thoughts' : rawCategory,
        location: customMetadata.location || '',
        tags: tags,
        alt: customMetadata.alt || customMetadata.title || 'Personal photo',
        createdAt: item.createdAt,
        date: displayDate || item.createdAt.split('T')[0],
        publicId: item.fileId,
        entryId: customMetadata.entryId || derivedIdentity.entryId || item.fileId,
        sortOrder: Number(customMetadata.sortOrder ?? derivedIdentity.sortOrder ?? 0),
        links: sanitizeLinks(parseStoredLinks(customMetadata.links)).length
          ? sanitizeLinks(parseStoredLinks(customMetadata.links))
          : captionData.links
      });
    });

    const successResponse = new Response(JSON.stringify({
      photos: normalizedPhotos,
      fallback: false
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300" // Cache-control (5 min)
      }
    });

    if (cache && cacheKey) {
      try {
        ctx.waitUntil(cache.put(cacheKey, successResponse.clone()));
      } catch (e) {
        console.warn("Cache put failed: ", e);
      }
    }

    return successResponse;

  } catch (err) {
    console.error("ImageKit fetching process failed: ", err);
    return new Response(JSON.stringify({
      error: err.message,
      fallback: true
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}

const ADMIN_COOKIE = 'portfolio_admin';
const ADMIN_SESSION_SECONDS = 60 * 60 * 8;
const MAX_UPLOAD_FILES = 12;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const loginAttempts = new Map();

async function handleAdminLogin(request, env) {
  if (!sameOriginRequest(request)) {
    return jsonResponse({ error: 'Cross-origin requests are not allowed.' }, 403);
  }

  if (!env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Admin uploads are not configured yet.' }, 503);
  }

  const clientKey = request.headers.get('CF-Connecting-IP') || 'local';
  const attempt = loginAttempts.get(clientKey) || { count: 0, resetAt: 0 };
  const now = Date.now();
  if (attempt.resetAt > now && attempt.count >= 5) {
    return jsonResponse({ error: 'Too many attempts. Try again in a few minutes.' }, 429);
  }
  if (attempt.resetAt <= now) {
    attempt.count = 0;
    attempt.resetAt = now + 15 * 60 * 1000;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!constantTimeEqual(password, env.ADMIN_PASSWORD)) {
    attempt.count += 1;
    loginAttempts.set(clientKey, attempt);
    return jsonResponse({ error: 'Incorrect password.' }, 401);
  }

  loginAttempts.delete(clientKey);
  const token = await createAdminToken(env);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';

  return new Response(JSON.stringify({ authenticated: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${ADMIN_SESSION_SECONDS}`
    }
  });
}

async function handleAdminSession(request, env) {
  const authenticated = await isAdminRequest(request, env);
  return jsonResponse({ authenticated }, 200, { 'Cache-Control': 'no-store' });
}

async function handleAdminLogout(request, env) {
  if (!sameOriginRequest(request)) {
    return jsonResponse({ error: 'Cross-origin requests are not allowed.' }, 403);
  }
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return new Response(JSON.stringify({ authenticated: false }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': `${ADMIN_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`
    }
  });
}

async function handleAdminPhotoUpload(request, env, ctx) {
  if (!sameOriginRequest(request)) {
    return jsonResponse({ error: 'Cross-origin requests are not allowed.' }, 403);
  }
  if (!await isAdminRequest(request, env)) {
    return jsonResponse({ error: 'Your admin session has expired.' }, 401);
  }
  if (!env.IMAGEKIT_PRIVATE_KEY) {
    return jsonResponse({ error: 'ImageKit is not configured.' }, 503);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: 'The upload form could not be read.' }, 400);
  }

  const title = cleanText(form.get('title'), 160);
  const subtitle = cleanText(form.get('subtitle'), 2000);
  const date = cleanText(form.get('date'), 10);
  const category = cleanText(form.get('category'), 80) || 'Life';
  const location = cleanText(form.get('location'), 160);
  const links = validateLinks(form.get('links'));
  const photos = form.getAll('photos').filter(value => value && typeof value === 'object' && 'size' in value);

  if (!title || !subtitle || !isValidDateInput(date)) {
    return jsonResponse({ error: 'Title, subtitle, and a valid date are required.' }, 400);
  }
  if (!photos.length || photos.length > MAX_UPLOAD_FILES) {
    return jsonResponse({ error: `Choose between 1 and ${MAX_UPLOAD_FILES} photos.` }, 400);
  }
  for (const photo of photos) {
    if (!String(photo.type || '').startsWith('image/')) {
      return jsonResponse({ error: `${photo.name || 'A selected file'} is not an image.` }, 400);
    }
    if (photo.size > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: `${photo.name || 'A selected image'} is too large after optimization.` }, 400);
    }
  }

  let folder = env.IMAGEKIT_PERSONAL_FOLDER || '/personal';
  if (!folder.startsWith('/')) folder = `/${folder}`;
  if (!folder.endsWith('/')) folder += '/';

  const entryId = crypto.randomUUID();
  const uploaded = [];
  try {
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const extension = mimeExtension(photo.type);
      const fileName = `${date}-${entryId}-${String(index + 1).padStart(2, '0')}.${extension}`;
      const customMetadata = {
        title,
        caption: packPortfolioCaption(subtitle, links),
        date: `${date}T00:00:00.000Z`,
        category: normalizeImageKitCategory(category),
        alt: photos.length > 1 ? `${title} - photo ${index + 1} of ${photos.length}` : title
      };
      if (location) customMetadata.location = location;

      const imageKitForm = new FormData();
      imageKitForm.append('file', photo, fileName);
      imageKitForm.append('fileName', fileName);
      imageKitForm.append('folder', folder);
      imageKitForm.append('useUniqueFileName', 'false');
      imageKitForm.append('isPublished', 'true');
      imageKitForm.append('tags', `personal,${slugifyTag(category)}`);
      imageKitForm.append('customMetadata', JSON.stringify(customMetadata));
      imageKitForm.append('responseFields', 'tags,customMetadata');

      const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        headers: { Authorization: imageKitAuthorization(env.IMAGEKIT_PRIVATE_KEY) },
        body: imageKitForm
      });
      const uploadResult = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok) {
        if ([401, 403].includes(uploadResponse.status) || (uploadResponse.status === 500 && !uploadResult.message)) {
          throw new Error('ImageKit rejected write access. Configure a private key with Media management Read and write permission.');
        }
        throw new Error(uploadResult.message || `ImageKit upload failed with ${uploadResponse.status}`);
      }
      uploaded.push(uploadResult);
    }
  } catch (error) {
    console.error('ImageKit upload failed:', error);
    await Promise.allSettled(uploaded.map(item => deleteImageKitFile(item.fileId, env.IMAGEKIT_PRIVATE_KEY)));
    return jsonResponse({ error: error.message || 'Upload failed.' }, 502);
  }

  purgePersonalPhotosCache(request, ctx);

  return jsonResponse({
    success: true,
    entryId,
    photos: uploaded.map(item => ({ fileId: item.fileId, url: item.url }))
  }, 201, { 'Cache-Control': 'no-store' });
}

async function handleAdminMomentUpdate(request, env, ctx, entryId) {
  const accessError = await validateAdminMutation(request, env);
  if (accessError) return accessError;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'The edit form could not be read.' }, 400);
  }

  const title = cleanText(body.title, 160);
  const subtitle = cleanText(body.subtitle, 2000);
  const date = cleanText(body.date, 10);
  const category = cleanText(body.category, 80) || 'Life';
  const location = cleanText(body.location, 160);
  const links = sanitizeLinks(Array.isArray(body.links) ? body.links : []);

  if (!entryId || !title || !subtitle || !isValidDateInput(date)) {
    return jsonResponse({ error: 'Title, subtitle, and a valid date are required.' }, 400);
  }

  let files;
  try {
    files = await findImageKitMomentFiles(entryId, env);
  } catch (error) {
    console.error('Could not find ImageKit moment:', error);
    return jsonResponse({ error: 'Could not load this moment from ImageKit.' }, 502);
  }
  if (!files.length) return jsonResponse({ error: 'This timeline moment no longer exists.' }, 404);

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const current = file.customMetadata || {};
      const customMetadata = {
        ...current,
        title,
        caption: packPortfolioCaption(subtitle, links),
        date: `${date}T00:00:00.000Z`,
        category: normalizeImageKitCategory(category),
        alt: files.length > 1 ? `${title} - photo ${index + 1} of ${files.length}` : title
      };
      if (location) customMetadata.location = location;
      else delete customMetadata.location;
      const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(file.fileId)}/details`, {
        method: 'PATCH',
        headers: {
          Authorization: imageKitAuthorization(env.IMAGEKIT_PRIVATE_KEY),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags: ['personal', slugifyTag(category)], customMetadata })
      });
      if (!response.ok) {
        const detail = await response.text();
        if (response.status === 403) throw new Error('ImageKit key does not have Media management write permission.');
        throw new Error(`ImageKit update failed: ${detail}`);
      }
    }
  } catch (error) {
    console.error('ImageKit moment update failed:', error);
    return jsonResponse({ error: 'Could not update every photo in this moment.' }, 502);
  }

  purgePersonalPhotosCache(request, ctx);
  return jsonResponse({ success: true, updated: files.length }, 200, { 'Cache-Control': 'no-store' });
}

async function handleAdminMomentPhotoAppend(request, env, ctx, entryId) {
  const accessError = await validateAdminMutation(request, env);
  if (accessError) return accessError;

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: 'The additional photos could not be read.' }, 400);
  }
  const photos = form.getAll('photos').filter(value => value && typeof value === 'object' && 'size' in value);

  let existing;
  try {
    existing = await findImageKitMomentFiles(entryId, env);
  } catch (error) {
    console.error('Could not find ImageKit moment:', error);
    return jsonResponse({ error: 'Could not load this moment from ImageKit.' }, 502);
  }
  if (!existing.length) return jsonResponse({ error: 'This timeline moment no longer exists.' }, 404);
  const remainingSlots = MAX_UPLOAD_FILES - existing.length;
  if (remainingSlots <= 0) {
    return jsonResponse({ error: `This moment already contains the maximum of ${MAX_UPLOAD_FILES} photos.` }, 400);
  }
  if (!photos.length || photos.length > remainingSlots) {
    return jsonResponse({ error: `Choose between 1 and ${remainingSlots} additional photos.` }, 400);
  }
  for (const photo of photos) {
    if (!String(photo.type || '').startsWith('image/')) {
      return jsonResponse({ error: `${photo.name || 'A selected file'} is not an image.` }, 400);
    }
    if (photo.size > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: `${photo.name || 'A selected image'} is too large after optimization.` }, 400);
    }
  }

  let folder = env.IMAGEKIT_PERSONAL_FOLDER || '/personal';
  if (!folder.startsWith('/')) folder = `/${folder}`;
  if (!folder.endsWith('/')) folder += '/';
  const sourceMetadata = existing[0].customMetadata || {};
  const date = String(sourceMetadata.date || existing[0].createdAt || new Date().toISOString()).split('T')[0];
  const title = cleanText(sourceMetadata.title, 160) || 'Timeline moment';
  const safeEntryId = cleanFileNamePart(entryId);
  const uploaded = [];

  try {
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const sortOrder = existing.length + index;
      const fileName = `${date}-${safeEntryId}-${String(sortOrder + 1).padStart(2, '0')}.${mimeExtension(photo.type)}`;
      const customMetadata = {
        title,
        caption: sourceMetadata.caption || '',
        date: sourceMetadata.date || `${date}T00:00:00.000Z`,
        category: normalizeImageKitCategory(sourceMetadata.category || 'Life'),
        alt: `${title} - photo ${sortOrder + 1} of ${existing.length + photos.length}`
      };
      if (sourceMetadata.location) customMetadata.location = sourceMetadata.location;

      const imageKitForm = new FormData();
      imageKitForm.append('file', photo, fileName);
      imageKitForm.append('fileName', fileName);
      imageKitForm.append('folder', folder);
      imageKitForm.append('useUniqueFileName', 'false');
      imageKitForm.append('isPublished', 'true');
      imageKitForm.append('tags', `personal,${slugifyTag(sourceMetadata.category || 'Life')}`);
      imageKitForm.append('customMetadata', JSON.stringify(customMetadata));
      imageKitForm.append('responseFields', 'tags,customMetadata');

      const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        headers: { Authorization: imageKitAuthorization(env.IMAGEKIT_PRIVATE_KEY) },
        body: imageKitForm
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if ([401, 403].includes(response.status) || (response.status === 500 && !result.message)) {
          throw new Error('ImageKit rejected write access. Configure a private key with Media management Read and write permission.');
        }
        throw new Error(result.message || `ImageKit upload failed with ${response.status}`);
      }
      uploaded.push(result);
    }
  } catch (error) {
    console.error('Appending ImageKit photos failed:', error);
    await Promise.allSettled(uploaded.map(item => deleteImageKitFile(item.fileId, env.IMAGEKIT_PRIVATE_KEY)));
    return jsonResponse({ error: error.message || 'Could not add the photos.' }, 502);
  }

  purgePersonalPhotosCache(request, ctx);
  return jsonResponse({ success: true, added: uploaded.length }, 201, { 'Cache-Control': 'no-store' });
}

async function handleAdminMomentDelete(request, env, ctx, entryId) {
  const accessError = await validateAdminMutation(request, env);
  if (accessError) return accessError;

  let files;
  try {
    files = await findImageKitMomentFiles(entryId, env);
  } catch (error) {
    console.error('Could not find ImageKit moment:', error);
    return jsonResponse({ error: 'Could not load this moment from ImageKit.' }, 502);
  }
  if (!files.length) return jsonResponse({ error: 'This timeline moment no longer exists.' }, 404);

  try {
    for (const file of files) await deleteImageKitFile(file.fileId, env.IMAGEKIT_PRIVATE_KEY);
  } catch (error) {
    console.error('ImageKit moment deletion failed:', error);
    return jsonResponse({ error: 'The entire moment could not be deleted. Refresh and check its photos.' }, 502);
  }

  purgePersonalPhotosCache(request, ctx);
  return jsonResponse({ success: true, deleted: files.length }, 200, { 'Cache-Control': 'no-store' });
}

async function handleAdminPhotoDelete(request, env, ctx, entryId, fileId) {
  const accessError = await validateAdminMutation(request, env);
  if (accessError) return accessError;

  let files;
  try {
    files = await findImageKitMomentFiles(entryId, env);
  } catch (error) {
    console.error('Could not find ImageKit moment:', error);
    return jsonResponse({ error: 'Could not load this moment from ImageKit.' }, 502);
  }
  const target = files.find(file => file.fileId === fileId);
  if (!target) return jsonResponse({ error: 'That photo is not part of this timeline moment.' }, 404);

  try {
    await deleteImageKitFile(fileId, env.IMAGEKIT_PRIVATE_KEY);
  } catch (error) {
    console.error('ImageKit photo deletion failed:', error);
    return jsonResponse({ error: 'Could not delete this photo.' }, 502);
  }

  purgePersonalPhotosCache(request, ctx);
  return jsonResponse({ success: true, momentDeleted: files.length === 1 }, 200, { 'Cache-Control': 'no-store' });
}

async function validateAdminMutation(request, env) {
  if (!sameOriginRequest(request)) return jsonResponse({ error: 'Cross-origin requests are not allowed.' }, 403);
  if (!await isAdminRequest(request, env)) return jsonResponse({ error: 'Your admin session has expired.' }, 401);
  if (!env.IMAGEKIT_PRIVATE_KEY) return jsonResponse({ error: 'ImageKit is not configured.' }, 503);
  return null;
}

async function findImageKitMomentFiles(entryId, env) {
  let folder = env.IMAGEKIT_PERSONAL_FOLDER || '/personal';
  if (!folder.startsWith('/')) folder = `/${folder}`;
  if (!folder.endsWith('/')) folder += '/';
  const response = await fetch(`https://api.imagekit.io/v1/files?path=${encodeURIComponent(folder)}&fileType=image&limit=100`, {
    headers: { Authorization: imageKitAuthorization(env.IMAGEKIT_PRIVATE_KEY) }
  });
  if (!response.ok) throw new Error(`ImageKit listing failed with ${response.status}`);
  const files = await response.json();
  if (!Array.isArray(files)) return [];
  return files.filter(file => {
    const storedEntryId = file.customMetadata && file.customMetadata.entryId;
    const derivedEntryId = derivePhotoIdentity(file).entryId;
    return storedEntryId === entryId || derivedEntryId === entryId || (!storedEntryId && !derivedEntryId && file.fileId === entryId);
  }).sort((a, b) => {
    const aOrder = a.customMetadata?.sortOrder ?? derivePhotoIdentity(a).sortOrder ?? 0;
    const bOrder = b.customMetadata?.sortOrder ?? derivePhotoIdentity(b).sortOrder ?? 0;
    return Number(aOrder) - Number(bOrder);
  });
}

function purgePersonalPhotosCache(request, ctx) {
  if (typeof caches === 'undefined' || !ctx || typeof ctx.waitUntil !== 'function') return;
  const publicEndpoint = new URL('/api/personal-photos', request.url);
  ctx.waitUntil(caches.default.delete(new Request(publicEndpoint.toString())));
}

async function deleteImageKitFile(fileId, privateKey) {
  if (!fileId) return;
  const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: imageKitAuthorization(privateKey) }
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error('ImageKit key does not have Media management write permission.');
    throw new Error(`ImageKit deletion failed with ${response.status}`);
  }
}

function imageKitAuthorization(privateKey) {
  return `Basic ${btoa(`${privateKey}:`)}`;
}

function imageKitDisplayUrl(url) {
  if (!url) return '';
  return `${url}${url.includes('?') ? '&' : '?'}tr=w-1600,q-90`;
}

const PORTFOLIO_LINKS_MARKER = '\n[portfolio-links-json]';

function packPortfolioCaption(subtitle, links) {
  const safeLinks = sanitizeLinks(Array.isArray(links) ? links : []);
  if (!safeLinks.length) return subtitle;
  return `${subtitle}${PORTFOLIO_LINKS_MARKER}${JSON.stringify(safeLinks)}`;
}

function parsePortfolioCaption(value) {
  const caption = String(value || '');
  const markerIndex = caption.lastIndexOf(PORTFOLIO_LINKS_MARKER);
  if (markerIndex < 0) return { subtitle: caption, links: [] };
  const subtitle = caption.slice(0, markerIndex);
  const storedLinks = caption.slice(markerIndex + PORTFOLIO_LINKS_MARKER.length);
  return { subtitle, links: sanitizeLinks(parseStoredLinks(storedLinks)) };
}

function derivePhotoIdentity(item) {
  const name = String(item && (item.name || item.filePath || '')).split('/').pop();
  const match = name.match(/^\d{4}-\d{2}-\d{2}-(.+)-(\d{2})\.[^.]+$/i);
  if (!match) return { entryId: '', sortOrder: null };
  return { entryId: match[1], sortOrder: Math.max(0, Number(match[2]) - 1) };
}

function cleanFileNamePart(value) {
  return String(value || 'moment').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'moment';
}

function normalizeImageKitCategory(category) {
  const requested = category === 'Thoughts' ? 'Small Notes' : category;
  const allowed = new Set([
    'City', 'Travel', 'Music', 'Food', 'Friends', 'India', 'Germany',
    'Campus', 'Bike Routes', 'Small Notes', 'Life'
  ]);
  return allowed.has(requested) ? requested : 'Life';
}

function parseStoredLinks(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function validateLinks(value) {
  return sanitizeLinks(parseStoredLinks(String(value || '')));
}

function sanitizeLinks(links) {
  return links.slice(0, 6).flatMap(link => {
    const label = cleanText(link && link.label, 80);
    const href = cleanText(link && link.url, 1000);
    if (!label || !href) return [];
    try {
      const parsed = new URL(href);
      if (!['http:', 'https:'].includes(parsed.protocol)) return [];
      return [{ label, url: parsed.toString() }];
    } catch {
      return [];
    }
  });
}

function isValidDateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function slugifyTag(value) {
  return String(value || 'life').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'life';
}

function mimeExtension(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  return 'webp';
}

function sameOriginRequest(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function createAdminToken(env) {
  const payload = base64UrlEncode(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS,
    nonce: crypto.randomUUID()
  }));
  const signature = await signAdminPayload(payload, env);
  return `${payload}.${signature}`;
}

async function isAdminRequest(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const token = readCookie(request, ADMIN_COOKIE);
  if (!token) return false;
  const separator = token.lastIndexOf('.');
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  const expectedSignature = await signAdminPayload(payload, env);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return false;
  try {
    const claims = JSON.parse(base64UrlDecode(payload));
    return Number(claims.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function signAdminPayload(payload, env) {
  const secret = env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index % Math.max(a.length, 1)] || 0) ^ (b[index % Math.max(b.length, 1)] || 0);
  }
  return mismatch === 0;
}

function base64UrlEncode(value) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

function getCategoryFromTags(tags) {
  if (!tags) return 'Life';
  const mapping = {
    'city': 'City',
    'travel': 'Travel',
    'music': 'Music',
    'food': 'Food',
    'friends': 'Friends',
    'india': 'India',
    'germany': 'Germany',
    'campus': 'Campus',
    'bike-routes': 'Bike Routes',
    'small-notes': 'Small Notes',
    'life': 'Life'
  };
  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    if (mapping[lowerTag]) return mapping[lowerTag];
  }
  return null;
}
