(function () {
  'use strict';

  const modal = document.getElementById('admin-modal');
  const loginPane = document.getElementById('admin-login-pane');
  const uploadPane = document.getElementById('admin-upload-pane');
  const loginForm = document.getElementById('admin-login-form');
  const uploadForm = document.getElementById('admin-upload-form');
  const fileInput = document.getElementById('admin-photos');
  const previewGrid = document.getElementById('admin-preview-grid');
  const linksContainer = document.getElementById('admin-links');
  const loginStatus = document.getElementById('admin-login-status');
  const uploadStatus = document.getElementById('admin-upload-status');
  const uploadButton = document.getElementById('admin-upload-submit');
  const logoutButton = document.getElementById('admin-logout');
  const createTab = document.getElementById('admin-create-tab');
  const manageTab = document.getElementById('admin-manage-tab');
  const manageView = document.getElementById('admin-manage-view');
  const editView = document.getElementById('admin-edit-view');
  const modeSwitch = document.getElementById('admin-mode-switch');
  const momentList = document.getElementById('admin-moment-list');
  const manageStatus = document.getElementById('admin-manage-status');
  const editForm = document.getElementById('admin-edit-form');
  const editLinksContainer = document.getElementById('admin-edit-links');
  const editStatus = document.getElementById('admin-edit-status');
  const editFileInput = document.getElementById('admin-edit-photos');
  const editPreviewGrid = document.getElementById('admin-edit-preview-grid');
  let previewUrls = [];
  let editPreviewUrls = [];
  let adminMoments = [];
  let activeMoment = null;

  if (!modal || !loginForm || !uploadForm) return;

  window.openAdminUpload = async function openAdminUpload() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    showPane(false);
    const unlockButton = loginForm.querySelector('button[type="submit"]');
    unlockButton.disabled = true;
    setStatus(loginStatus, 'Securing a new admin session…');
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store'
      });
    } catch {
      // The password check below remains authoritative even if this cleanup
      // request is interrupted by the browser.
    } finally {
      unlockButton.disabled = false;
      setStatus(loginStatus, 'Enter the admin password to continue.');
      window.setTimeout(() => document.getElementById('admin-password').focus(), 50);
    }
  };

  window.closeAdminUpload = function closeAdminUpload() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Closing the manager also invalidates the server session, ensuring that
    // adding, editing, or deleting photos requires the password next time.
    fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true
    }).catch(() => {});
    editFileInput.value = '';
    clearEditPreviews();
    showPane(false);
  };

  window.addAdminLink = function addAdminLink(label = '', url = '') {
    addLinkRow(linksContainer, label, url);
  };

  function addLinkRow(container, label = '', url = '') {
    if (container.children.length >= 6) return;
    const row = document.createElement('div');
    row.className = 'admin-link-row';
    row.innerHTML = `
      <input class="admin-input admin-link-label" type="text" maxlength="80" placeholder="Link label" aria-label="Link label">
      <input class="admin-input admin-link-url" type="url" maxlength="1000" placeholder="https://…" aria-label="Link URL">
      <button class="admin-text-btn" type="button" aria-label="Remove link">Remove</button>
    `;
    row.querySelector('.admin-link-label').value = label;
    row.querySelector('.admin-link-url').value = url;
    row.querySelector('button').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const passwordInput = document.getElementById('admin-password');
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    setStatus(loginStatus, 'Signing in…');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.value })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Sign-in failed.');
      passwordInput.value = '';
      showPane(true);
      setStatus(uploadStatus, 'Authenticated. Add a timeline moment below.');
    } catch (error) {
      setStatus(loginStatus, error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  uploadForm.addEventListener('submit', async event => {
    event.preventDefault();
    const selected = Array.from(fileInput.files || []);
    if (!selected.length) {
      setStatus(uploadStatus, 'Choose at least one photo.', 'error');
      return;
    }
    if (selected.length > 12) {
      setStatus(uploadStatus, 'A timeline moment can contain at most 12 photos.', 'error');
      return;
    }

    uploadButton.disabled = true;
    try {
      const payload = new FormData();
      payload.append('title', document.getElementById('admin-title').value.trim());
      payload.append('subtitle', document.getElementById('admin-subtitle').value.trim());
      payload.append('date', document.getElementById('admin-date').value);
      payload.append('category', document.getElementById('admin-category').value);
      payload.append('location', document.getElementById('admin-location').value.trim());
      payload.append('links', JSON.stringify(collectLinks(linksContainer)));

      for (let index = 0; index < selected.length; index += 1) {
        setStatus(uploadStatus, `Optimizing photo ${index + 1} of ${selected.length}…`);
        const optimized = await optimizeImage(selected[index]);
        payload.append('photos', optimized, optimized.name);
      }

      setStatus(uploadStatus, `Uploading ${selected.length} ${selected.length === 1 ? 'photo' : 'photos'} to ImageKit…`);
      const response = await fetch('/api/admin/photos', {
        method: 'POST',
        credentials: 'same-origin',
        body: payload
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) showPane(false);
        throw new Error(result.error || 'Upload failed.');
      }

      setStatus(uploadStatus, 'Published successfully. Refreshing the timeline…', 'success');
      uploadForm.reset();
      clearPreviews();
      linksContainer.innerHTML = '';
      window.addAdminLink();
      setDefaultDate();
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setStatus(uploadStatus, error.message || 'Upload failed.', 'error');
    } finally {
      uploadButton.disabled = false;
    }
  });

  fileInput.addEventListener('change', renderPreviews);

  createTab.addEventListener('click', () => switchAdminView('create'));
  manageTab.addEventListener('click', () => switchAdminView('manage'));
  document.getElementById('admin-manage-refresh').addEventListener('click', loadAdminMoments);
  document.getElementById('admin-edit-back').addEventListener('click', () => switchAdminView('manage'));
  document.getElementById('admin-edit-add-link').addEventListener('click', () => addLinkRow(editLinksContainer));
  document.getElementById('admin-delete-moment').addEventListener('click', deleteActiveMoment);
  document.getElementById('admin-add-photos-submit').addEventListener('click', uploadAdditionalPhotos);
  editFileInput.addEventListener('change', renderEditPreviews);
  editForm.addEventListener('submit', saveActiveMoment);
  momentList.addEventListener('click', handleMomentListClick);
  document.getElementById('admin-existing-photos').addEventListener('click', handleExistingPhotoClick);

  logoutButton.addEventListener('click', signOut);
  document.getElementById('admin-manage-logout').addEventListener('click', signOut);

  async function signOut(event) {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } finally {
      button.disabled = false;
      showPane(false);
      setStatus(loginStatus, 'Signed out. Enter the admin password to continue.');
    }
  }

  const dropzone = document.querySelector('.admin-dropzone');
  ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
  }));
  dropzone.addEventListener('drop', event => {
    if (!event.dataTransfer || !event.dataTransfer.files.length) return;
    fileInput.files = event.dataTransfer.files;
    renderPreviews();
  });

  modal.addEventListener('click', event => {
    if (event.target === modal) window.closeAdminUpload();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('open')) window.closeAdminUpload();
  });

  function showPane(authenticated) {
    loginPane.hidden = authenticated;
    uploadPane.hidden = !authenticated;
    if (!authenticated) {
      setStatus(loginStatus, 'Enter the admin password to continue.');
      window.setTimeout(() => document.getElementById('admin-password').focus(), 50);
    } else {
      setDefaultDate();
      if (!linksContainer.children.length) window.addAdminLink();
      switchAdminView('create');
    }
  }

  function switchAdminView(view) {
    const isCreate = view === 'create';
    const isManage = view === 'manage';
    uploadForm.hidden = !isCreate;
    manageView.hidden = !isManage;
    editView.hidden = view !== 'edit';
    modeSwitch.hidden = view === 'edit';
    createTab.classList.toggle('is-active', isCreate);
    manageTab.classList.toggle('is-active', isManage);
    if (isManage) loadAdminMoments();
  }

  function setDefaultDate() {
    const dateInput = document.getElementById('admin-date');
    if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
  }

  function collectLinks(container) {
    return Array.from(container.querySelectorAll('.admin-link-row')).flatMap(row => {
      const label = row.querySelector('.admin-link-label').value.trim();
      const url = row.querySelector('.admin-link-url').value.trim();
      return label && url ? [{ label, url }] : [];
    });
  }

  async function loadAdminMoments() {
    setStatus(manageStatus, 'Loading moments…');
    momentList.innerHTML = '';
    try {
      const response = await fetch(`/api/personal-photos?manage=${Date.now()}`, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(result.photos)) throw new Error(result.error || 'Could not load moments.');
      adminMoments = groupAdminMoments(result.photos);
      renderAdminMoments();
      setStatus(manageStatus, adminMoments.length ? `${adminMoments.length} timeline ${adminMoments.length === 1 ? 'moment' : 'moments'}.` : 'No published moments yet.');
    } catch (error) {
      setStatus(manageStatus, error.message || 'Could not load moments.', 'error');
    }
  }

  function groupAdminMoments(photos) {
    const grouped = new Map();
    photos.forEach(photo => {
      const id = photo.entryId || photo.publicId;
      if (!grouped.has(id)) grouped.set(id, {
        id,
        title: photo.title || '',
        subtitle: photo.subtitle || photo.caption || '',
        date: photo.date || '',
        category: photo.category || 'Life',
        location: photo.location || '',
        links: Array.isArray(photo.links) ? photo.links : [],
        photos: []
      });
      grouped.get(id).photos.push(photo);
    });
    return Array.from(grouped.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function renderAdminMoments() {
    momentList.innerHTML = adminMoments.map(moment => {
      const cover = moment.photos[0] || {};
      return `
        <article class="admin-moment-item">
          <img src="${escapeAdminHTML(cover.displayUrl || cover.thumbnailUrl || cover.imageUrl || '')}" alt="">
          <div class="admin-moment-copy">
            <strong>${escapeAdminHTML(moment.title)}</strong>
            <span>${escapeAdminHTML(moment.date)} · ${moment.photos.length} ${moment.photos.length === 1 ? 'photo' : 'photos'}</span>
          </div>
          <div class="admin-moment-actions">
            <button class="admin-secondary-btn" type="button" data-action="edit" data-id="${escapeAdminHTML(moment.id)}">Edit</button>
            <button class="admin-danger-btn" type="button" data-action="delete" data-id="${escapeAdminHTML(moment.id)}">Delete</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function handleMomentListClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const moment = adminMoments.find(item => item.id === button.dataset.id);
    if (!moment) return;
    if (button.dataset.action === 'edit') openMomentEditor(moment);
    if (button.dataset.action === 'delete') deleteMoment(moment, button);
  }

  function openMomentEditor(moment) {
    activeMoment = moment;
    document.getElementById('admin-edit-entry-id').value = moment.id;
    document.getElementById('admin-edit-title').value = moment.title;
    document.getElementById('admin-edit-subtitle').value = moment.subtitle;
    document.getElementById('admin-edit-date').value = moment.date;
    document.getElementById('admin-edit-category').value = moment.category;
    document.getElementById('admin-edit-location').value = moment.location;
    editLinksContainer.innerHTML = '';
    moment.links.forEach(link => addLinkRow(editLinksContainer, link.label, link.url));
    if (!editLinksContainer.children.length) addLinkRow(editLinksContainer);
    renderExistingPhotos(moment);
    editFileInput.value = '';
    clearEditPreviews();
    setStatus(editStatus, 'Ready to save.');
    switchAdminView('edit');
  }

  function renderExistingPhotos(moment) {
    const container = document.getElementById('admin-existing-photos');
    container.innerHTML = moment.photos.map((photo, index) => `
      <div class="admin-existing-photo">
        <img src="${escapeAdminHTML(photo.displayUrl || photo.thumbnailUrl || photo.imageUrl)}" alt="Photo ${index + 1}">
        <button type="button" data-file-id="${escapeAdminHTML(photo.publicId)}">Delete</button>
      </div>
    `).join('');
  }

  async function saveActiveMoment(event) {
    event.preventDefault();
    if (!activeMoment) return;
    const button = document.getElementById('admin-edit-submit');
    button.disabled = true;
    setStatus(editStatus, 'Saving changes…');
    try {
      const response = await fetch(`/api/admin/moments/${encodeURIComponent(activeMoment.id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: document.getElementById('admin-edit-title').value.trim(),
          subtitle: document.getElementById('admin-edit-subtitle').value.trim(),
          date: document.getElementById('admin-edit-date').value,
          category: document.getElementById('admin-edit-category').value,
          location: document.getElementById('admin-edit-location').value.trim(),
          links: collectLinks(editLinksContainer)
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save this moment.');
      setStatus(editStatus, 'Changes saved. Refreshing the timeline…', 'success');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(editStatus, error.message || 'Could not save this moment.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function deleteActiveMoment() {
    if (!activeMoment) return;
    await deleteMoment(activeMoment, document.getElementById('admin-delete-moment'));
  }

  async function deleteMoment(moment, button) {
    if (!window.confirm(`Delete “${moment.title}” and all ${moment.photos.length} ${moment.photos.length === 1 ? 'photo' : 'photos'}? This cannot be undone.`)) return;
    button.disabled = true;
    const status = editView.hidden ? manageStatus : editStatus;
    setStatus(status, 'Deleting moment…');
    try {
      const response = await fetch(`/api/admin/moments/${encodeURIComponent(moment.id)}`, {
        method: 'DELETE', credentials: 'same-origin'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not delete this moment.');
      setStatus(status, 'Moment deleted. Refreshing the timeline…', 'success');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(status, error.message || 'Could not delete this moment.', 'error');
      button.disabled = false;
    }
  }

  async function handleExistingPhotoClick(event) {
    const button = event.target.closest('button[data-file-id]');
    if (!button || !activeMoment) return;
    if (!window.confirm('Delete this photo from the moment? This cannot be undone.')) return;
    button.disabled = true;
    setStatus(editStatus, 'Deleting photo…');
    try {
      const response = await fetch(`/api/admin/moments/${encodeURIComponent(activeMoment.id)}/photos/${encodeURIComponent(button.dataset.fileId)}`, {
        method: 'DELETE', credentials: 'same-origin'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not delete this photo.');
      if (result.momentDeleted) {
        setStatus(editStatus, 'The last photo was deleted. Refreshing…', 'success');
        window.setTimeout(() => window.location.reload(), 600);
        return;
      }
      activeMoment.photos = activeMoment.photos.filter(photo => photo.publicId !== button.dataset.fileId);
      renderExistingPhotos(activeMoment);
      setStatus(editStatus, 'Photo deleted.', 'success');
    } catch (error) {
      button.disabled = false;
      setStatus(editStatus, error.message || 'Could not delete this photo.', 'error');
    }
  }

  function renderEditPreviews() {
    clearEditPreviews();
    const remaining = activeMoment ? Math.max(0, 12 - activeMoment.photos.length) : 12;
    const files = Array.from(editFileInput.files || []).slice(0, remaining);
    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      editPreviewUrls.push(url);
      const item = document.createElement('div');
      item.className = 'admin-preview';
      item.innerHTML = `<img alt="Additional photo preview"><span>+${index + 1}</span>`;
      item.querySelector('img').src = url;
      editPreviewGrid.appendChild(item);
    });
    document.getElementById('admin-edit-file-summary').textContent = files.length
      ? `${files.length} additional ${files.length === 1 ? 'photo' : 'photos'} selected`
      : `Choose up to ${remaining} additional ${remaining === 1 ? 'photo' : 'photos'}`;
  }

  function clearEditPreviews() {
    editPreviewUrls.forEach(URL.revokeObjectURL);
    editPreviewUrls = [];
    editPreviewGrid.innerHTML = '';
    const remaining = activeMoment ? Math.max(0, 12 - activeMoment.photos.length) : 12;
    document.getElementById('admin-edit-file-summary').textContent = `Choose up to ${remaining} additional ${remaining === 1 ? 'photo' : 'photos'}`;
  }

  async function uploadAdditionalPhotos() {
    if (!activeMoment) return;
    const selected = Array.from(editFileInput.files || []);
    const remaining = Math.max(0, 12 - activeMoment.photos.length);
    if (!selected.length) {
      setStatus(editStatus, 'Choose at least one additional photo.', 'error');
      return;
    }
    if (selected.length > remaining) {
      setStatus(editStatus, `This moment can accept at most ${remaining} more ${remaining === 1 ? 'photo' : 'photos'}.`, 'error');
      return;
    }

    const button = document.getElementById('admin-add-photos-submit');
    button.disabled = true;
    try {
      const payload = new FormData();
      for (let index = 0; index < selected.length; index += 1) {
        setStatus(editStatus, `Optimizing additional photo ${index + 1} of ${selected.length}…`);
        const optimized = await optimizeImage(selected[index]);
        payload.append('photos', optimized, optimized.name);
      }
      setStatus(editStatus, `Adding ${selected.length} ${selected.length === 1 ? 'photo' : 'photos'} to this moment…`);
      const response = await fetch(`/api/admin/moments/${encodeURIComponent(activeMoment.id)}/photos`, {
        method: 'POST',
        credentials: 'same-origin',
        body: payload
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not add the photos.');
      setStatus(editStatus, 'Photos added. Refreshing the timeline…', 'success');
      editFileInput.value = '';
      clearEditPreviews();
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(editStatus, error.message || 'Could not add the photos.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function escapeAdminHTML(value) {
    return String(value || '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[character]);
  }

  function renderPreviews() {
    clearPreviews();
    const files = Array.from(fileInput.files || []).slice(0, 12);
    files.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      const item = document.createElement('div');
      item.className = 'admin-preview';
      item.innerHTML = `<img alt="Selected photo preview"><span>${index + 1}</span>`;
      item.querySelector('img').src = url;
      previewGrid.appendChild(item);
    });
    const suffix = files.length === 1 ? 'photo selected' : 'photos selected';
    document.getElementById('admin-file-summary').textContent = files.length ? `${files.length} ${suffix}` : 'Choose up to 12 photos';
  }

  function clearPreviews() {
    previewUrls.forEach(URL.revokeObjectURL);
    previewUrls = [];
    previewGrid.innerHTML = '';
    document.getElementById('admin-file-summary').textContent = 'Choose up to 12 photos';
  }

  async function optimizeImage(file) {
    if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`);
    if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name} exceeds ImageKit's 25 MB free-plan limit.`);

    const source = await decodeImage(file);
    const maxDimension = 2000;
    const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    if (typeof source.close === 'function') source.close();

    let blob = await canvasBlob(canvas, 'image/webp', 0.84);
    let extension = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasBlob(canvas, 'image/jpeg', 0.86);
      extension = 'jpg';
    }
    if (!blob) throw new Error(`Could not optimize ${file.name}.`);
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'photo';
    return new File([blob], `${baseName}.${extension}`, { type: blob.type, lastModified: Date.now() });
  }

  async function decodeImage(file) {
    if ('createImageBitmap' in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        return await createImageBitmap(file);
      }
    }
    return await new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not read ${file.name}.`)); };
      image.src = url;
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
  }

  function setStatus(element, message, tone = '') {
    element.textContent = message;
    element.className = `admin-status${tone ? ` is-${tone}` : ''}`;
  }
})();
