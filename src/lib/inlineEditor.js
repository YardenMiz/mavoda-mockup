import { supabase } from './supabase.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function uploadImageFile(file, pathPrefix) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('gallery-images').upload(path, file);
  if (error) return { error };
  const { data } = supabase.storage.from('gallery-images').getPublicUrl(path);
  return { url: data.publicUrl };
}

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    #edit-mode-bar { position: fixed; top: 0; inset-inline: 0; z-index: 3000; background: #111827; color: #fff;
      padding: 8px 16px; display: flex; justify-content: space-between; align-items: center;
      font-size: 14px; font-family: Rubik, Arial, sans-serif; }
    #edit-mode-bar button { background: #d33; color: #fff; border: none; border-radius: 6px;
      padding: 4px 12px; cursor: pointer; font-family: inherit; }
    .ie-edit-affordance { display: inline-flex; align-items: center; gap: 4px; margin: 8px 0;
      background: #eef; color: #1f2937; border: 1px dashed #3ac41e; border-radius: 6px;
      padding: 6px 12px; cursor: pointer; font-size: 13px; font-family: Rubik, Arial, sans-serif; }
    .ie-delete-btn { position: absolute; top: 6px; left: 6px; background: #d33; color: #fff; border: none;
      border-radius: 50%; width: 22px; height: 22px; line-height: 22px; text-align: center; cursor: pointer;
      font-size: 13px; z-index: 5; }
    .ie-item-relative { position: relative; }
    .ie-inline-form { background: #fff; border: 1px solid #3ac41e; border-radius: 8px; padding: 12px;
      margin: 8px 0; display: flex; flex-direction: column; gap: 8px; font-family: Rubik, Arial, sans-serif; }
    .ie-inline-form input, .ie-inline-form textarea { padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px;
      font-family: inherit; font-size: 14px; }
    .ie-inline-form .ie-form-actions { display: flex; gap: 8px; }
    .ie-inline-form button { padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .ie-inline-form .ie-save-btn { background: #3ac41e; color: #fff; }
    .ie-inline-form .ie-cancel-btn { background: #eee; color: #333; }
    .ie-reg-section { background: #f8f9fa; border-radius: 6px; padding: 10px; margin-bottom: 8px;
      display: flex; flex-direction: column; gap: 6px; }
    .ie-reg-section input, .ie-reg-section textarea { padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px;
      font-family: inherit; font-size: 14px; }
    .ie-reg-section .ie-reg-delete { background: #d33; color: #fff; border: none; border-radius: 6px;
      padding: 4px 10px; cursor: pointer; width: fit-content; }
    .ie-form-error { color: #d33; font-size: 13px; margin: 0; }
    .ie-manage-list { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; font-family: Rubik, Arial, sans-serif; }
    .ie-manage-row { background: #f8f9fa; border-radius: 8px; padding: 10px 12px; display: flex;
      justify-content: space-between; align-items: flex-start; gap: 10px; }
    .ie-manage-row-body { flex: 1; min-width: 0; }
    .ie-manage-row-body strong { display: block; }
    .ie-manage-row-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .ie-manage-row-actions button { border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer;
      font-family: inherit; font-size: 13px; }
    .ie-edit-small-btn { background: #e5e7eb; color: #111827; }
    .ie-delete-small-btn { background: #d33; color: #fff; }
    .ie-ad-edit-btn { position: absolute; bottom: 6px; inset-inline-end: 6px; background: #111827; color: #fff;
      border: none; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; z-index: 5; }
    .ad-placeholder { position: relative; }
    .ad-placeholder img { max-width: 100%; border-radius: 8px; }
    .ie-about-edit-btn { margin-inline-start: 10px; }
    .ie-board-row-form { display: flex; gap: 6px; align-items: center; }
    .ie-board-row-form input { padding: 4px 8px; border: 1px solid #ddd; border-radius: 6px; font-family: inherit; }
    .ie-about-image-edit { margin-top: 8px; }
  `;
  document.head.appendChild(style);
}

let cachedContextPromise = null;

// Cached per page load (module-level, shared by every importer of this file
// on the same page) so BaseLayout's site-wide edit bar and a sport page's
// inline controls don't each independently re-fetch the same role/assignment
// rows.
export function getEditContext() {
  if (!cachedContextPromise) {
    cachedContextPromise = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data: roleRow } = await supabase.from('user_roles').select('role').maybeSingle();
      const role = roleRow?.role;
      if (!role || role === 'reader') return null;

      let assignedSlugs = null; // null means "all sports" (admin)
      if (role !== 'admin') {
        const { data: assigned } = await supabase.from('coordinator_sports').select('sport_slug');
        assignedSlugs = (assigned || []).map((a) => a.sport_slug);
      }
      return { role, assignedSlugs };
    })();
  }
  return cachedContextPromise;
}

export function canEditSport(ctx, slug) {
  if (!ctx) return false;
  if (ctx.role === 'admin') return true;
  return (ctx.assignedSlugs || []).includes(slug);
}

export function mountEditBar(ctx) {
  if (!ctx) return;
  injectStyles();
  const bar = document.createElement('div');
  bar.id = 'edit-mode-bar';
  const roleLabel = ctx.role === 'admin' ? 'מנהל אתר' : 'רכז';
  bar.innerHTML = `<span>מצב עריכה פעיל · מחובר/ת כ${roleLabel}</span>`;
  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.textContent = 'התנתק';
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
  });
  bar.appendChild(logoutBtn);
  document.body.prepend(bar);
  document.body.style.paddingTop = '38px';
  // The moving strip and header are both position:fixed at top:0/56px, so
  // without this they'd render hidden underneath the (higher z-index) bar.
  document.body.classList.add('ie-edit-bar-active');
}

function makeAddAffordance(label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ie-edit-affordance';
  btn.textContent = `+ ${label}`;
  btn.addEventListener('click', onClick);
  return btn;
}

function makeEditAffordance(label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ie-edit-affordance';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function makeManageRow(summaryHtml, { onEdit, onDelete }) {
  const row = document.createElement('div');
  row.className = 'ie-manage-row';
  const body = document.createElement('div');
  body.className = 'ie-manage-row-body';
  body.innerHTML = summaryHtml;
  const actions = document.createElement('div');
  actions.className = 'ie-manage-row-actions';
  if (onEdit) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ie-edit-small-btn';
    editBtn.textContent = 'ערוך';
    editBtn.addEventListener('click', onEdit);
    actions.appendChild(editBtn);
  }
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'ie-delete-small-btn';
  delBtn.textContent = 'מחק';
  delBtn.addEventListener('click', async () => {
    const { error } = await onDelete();
    if (error) alert(`מחיקה נכשלה: ${error.message}`);
  });
  actions.appendChild(delBtn);
  row.append(body, actions);
  return row;
}

function attachDeleteButton(itemEl, onDelete) {
  itemEl.classList.add('ie-item-relative');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ie-delete-btn';
  btn.textContent = '×';
  btn.title = 'מחק';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const { error } = await onDelete();
    if (error) alert(`מחיקה נכשלה: ${error.message}`);
  });
  itemEl.appendChild(btn);
}

function showFormError(form, error) {
  let errorEl = form.querySelector('.ie-form-error');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.className = 'ie-form-error';
    form.appendChild(errorEl);
  }
  errorEl.textContent = error ? `שמירה נכשלה: ${error.message}` : '';
}

// The content containers (#upcoming, #results, #gallery, #regulations) get
// their innerHTML fully replaced every time sportContent.js re-renders them
// after a save, which would wipe out any "add" button/form placed inside.
// Placing those controls in a sibling wrapper right after the container, and
// reusing that same wrapper on repeat calls, lets mountSportEditControls be
// safely re-run after every refresh without duplicating controls.
function ensureControlsWrapper(container) {
  const next = container.nextElementSibling;
  if (next && next.classList.contains('ie-controls-wrapper')) {
    return { wrapper: next, isNew: false };
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'ie-controls-wrapper';
  container.insertAdjacentElement('afterend', wrapper);
  return { wrapper, isNew: true };
}

// --- Coordinator info (name + phone) -------------------------------------

function mountCoordinatorEditing(main, slug, refresh) {
  const nameEl = main.querySelector('.coordinator-name');
  const phoneEl = main.querySelector('.coordinator-phone');
  if (!nameEl && !phoneEl) return;

  const anchor = phoneEl || nameEl;
  if (anchor.nextElementSibling?.classList.contains('ie-edit-affordance')) return;

  const editBtn = makeAddAffordance('ערוך פרטי רכז', () => {
    if (anchor.parentElement.querySelector('.ie-inline-form')) return;
    const form = document.createElement('div');
    form.className = 'ie-inline-form';
    form.innerHTML = `
      <input type="text" class="ie-coord-name" placeholder="שם הרכז">
      <input type="text" class="ie-coord-phone" placeholder="טלפון">
      <div class="ie-form-actions">
        <button type="button" class="ie-save-btn">שמור</button>
        <button type="button" class="ie-cancel-btn">ביטול</button>
      </div>
    `;
    const nameInput = form.querySelector('.ie-coord-name');
    const phoneInput = form.querySelector('.ie-coord-phone');
    nameInput.value = (nameEl?.textContent || '').replace(/^רכז:\s*/, '');
    phoneInput.value = (phoneEl?.textContent || '').replace(/^טלפון:\s*/, '');

    form.querySelector('.ie-save-btn').addEventListener('click', async () => {
      const { error } = await supabase.from('sports').update({
        coordinator_name: nameInput.value,
        coordinator_phone: phoneInput.value,
      }).eq('slug', slug);
      if (error) return showFormError(form, error);
      form.remove();
      await refresh();
    });
    form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
    anchor.insertAdjacentElement('afterend', form);
  });
  anchor.insertAdjacentElement('afterend', editBtn);
}

// --- Matches (upcoming / results) -----------------------------------------

function mountMatchesEditing(main, slug, refresh) {
  for (const [selector, withScore] of [['#upcoming', false], ['#results', true]]) {
    const container = main.querySelector(selector);
    if (!container) continue;

    container.querySelectorAll('.results-item').forEach((item) => {
      attachDeleteButton(item, async () => {
        const { error } = await supabase.from('sport_matches').delete().eq('id', item.dataset.id);
        if (!error) await refresh();
        return { error };
      });
    });

    const { wrapper, isNew } = ensureControlsWrapper(container);
    if (!isNew) continue;

    const addBtn = makeAddAffordance(withScore ? 'הוסף תוצאה' : 'הוסף משחק קרוב', () => {
      if (wrapper.querySelector('.ie-inline-form')) return;
      const form = document.createElement('div');
      form.className = 'ie-inline-form';
      form.innerHTML = `
        <input type="text" class="ie-opponent" placeholder="קבוצות / תיאור">
        <input type="text" class="ie-when" placeholder="${withScore ? 'תאריך' : 'מתי (למשל: שבת, 18:00)'}">
        ${withScore ? '<input type="text" class="ie-score" placeholder="תוצאה">' : ''}
        <div class="ie-form-actions">
          <button type="button" class="ie-save-btn">הוסף</button>
          <button type="button" class="ie-cancel-btn">ביטול</button>
        </div>
      `;
      form.querySelector('.ie-save-btn').addEventListener('click', async () => {
        const opponent = form.querySelector('.ie-opponent').value.trim();
        const whenLabel = form.querySelector('.ie-when').value.trim();
        if (!opponent) return;
        const payload = {
          sport_slug: slug,
          opponent,
          when_label: whenLabel,
          is_result: withScore,
        };
        if (withScore) {
          payload.score = form.querySelector('.ie-score').value.trim() || null;
          payload.season_year = new Date().getFullYear();
        }
        const { error } = await supabase.from('sport_matches').insert(payload);
        if (error) return showFormError(form, error);
        form.remove();
        await refresh();
      });
      form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
      wrapper.appendChild(form);
    });
    wrapper.appendChild(addBtn);
  }
}

// --- Gallery ---------------------------------------------------------------

function mountGalleryEditing(main, slug, refresh) {
  const container = main.querySelector('#gallery');
  if (!container) return;
  const grid = container.querySelector('.gallery-grid') || container;

  grid.querySelectorAll('.gallery-item').forEach((item) => {
    attachDeleteButton(item, async () => {
      const { error } = await supabase.from('sport_gallery').delete().eq('id', item.dataset.id);
      if (!error) await refresh();
      return { error };
    });
  });

  const { wrapper, isNew } = ensureControlsWrapper(container);
  if (!isNew) return;

  const addBtn = makeAddAffordance('הוסף תמונה', () => {
    if (wrapper.querySelector('.ie-inline-form')) return;
    const form = document.createElement('div');
    form.className = 'ie-inline-form';
    form.innerHTML = `
      <input type="file" class="ie-image-file" accept="image/*">
      <input type="text" class="ie-caption" placeholder="כיתוב (אופציונלי)">
      <div class="ie-form-actions">
        <button type="button" class="ie-save-btn">הוסף</button>
        <button type="button" class="ie-cancel-btn">ביטול</button>
      </div>
    `;
    const saveBtn = form.querySelector('.ie-save-btn');
    saveBtn.addEventListener('click', async () => {
      const file = form.querySelector('.ie-image-file').files[0];
      if (!file) return showFormError(form, { message: 'יש לבחור קובץ תמונה' });
      saveBtn.disabled = true;
      saveBtn.textContent = 'מעלה...';
      const { url, error: uploadError } = await uploadImageFile(file, slug);
      if (uploadError) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'הוסף';
        return showFormError(form, uploadError);
      }
      const { error } = await supabase.from('sport_gallery').insert({
        sport_slug: slug,
        image_url: url,
        caption: form.querySelector('.ie-caption').value.trim() || null,
      });
      if (error) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'הוסף';
        return showFormError(form, error);
      }
      form.remove();
      await refresh();
    });
    form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
    wrapper.appendChild(form);
  });
  wrapper.appendChild(addBtn);
}

// --- Regulations (title/content sections, same model as /admin) -----------

function parseRegulationsHtml(html) {
  const container = document.createElement('div');
  container.innerHTML = html || '';
  const children = [...container.children];
  const sections = [];
  for (let i = 0; i < children.length; i++) {
    if (children[i].tagName === 'H3') {
      const title = children[i].textContent;
      let content = '';
      if (children[i + 1] && children[i + 1].tagName === 'P') {
        content = children[i + 1].textContent;
        i++;
      }
      sections.push({ title, content });
    }
  }
  if (!sections.length) {
    const text = container.textContent.trim();
    if (text) sections.push({ title: '', content: text });
  }
  return sections;
}

function buildRegulationsHtml(sections) {
  return sections
    .filter((s) => s.title.trim() || s.content.trim())
    .map((s) => `<h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.content)}</p>`)
    .join('');
}

function mountRegulationsEditing(main, slug, refresh) {
  const container = main.querySelector('#regulations');
  if (!container) return;

  const { wrapper, isNew } = ensureControlsWrapper(container);
  if (!isNew) return;

  const editBtn = makeAddAffordance('ערוך תקנון', () => {
    if (wrapper.querySelector('.ie-inline-form')) return;
    const existingHtml = container.querySelector('.regulations-text')?.innerHTML || '';
    let sections = parseRegulationsHtml(existingHtml);
    if (!sections.length) sections = [{ title: '', content: '' }];

    const form = document.createElement('div');
    form.className = 'ie-inline-form';
    const sectionsWrap = document.createElement('div');
    form.appendChild(sectionsWrap);

    function renderSections() {
      sectionsWrap.innerHTML = '';
      sections.forEach((section, i) => {
        const row = document.createElement('div');
        row.className = 'ie-reg-section';
        const titleInput = document.createElement('input');
        titleInput.placeholder = 'כותרת הסעיף';
        titleInput.value = section.title;
        titleInput.addEventListener('input', () => { sections[i].title = titleInput.value; });
        const contentTextarea = document.createElement('textarea');
        contentTextarea.rows = 3;
        contentTextarea.placeholder = 'תוכן הסעיף';
        contentTextarea.value = section.content;
        contentTextarea.addEventListener('input', () => { sections[i].content = contentTextarea.value; });
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'ie-reg-delete';
        delBtn.textContent = 'מחק סעיף';
        delBtn.addEventListener('click', () => { sections.splice(i, 1); renderSections(); });
        row.append(titleInput, contentTextarea, delBtn);
        sectionsWrap.appendChild(row);
      });
    }
    renderSections();

    const actions = document.createElement('div');
    actions.className = 'ie-form-actions';
    actions.innerHTML = `
      <button type="button" class="ie-add-section-btn">הוסף סעיף</button>
      <button type="button" class="ie-save-btn">שמור תקנון</button>
      <button type="button" class="ie-cancel-btn">ביטול</button>
    `;
    form.appendChild(actions);

    actions.querySelector('.ie-add-section-btn').addEventListener('click', () => {
      sections.push({ title: '', content: '' });
      renderSections();
    });
    actions.querySelector('.ie-save-btn').addEventListener('click', async () => {
      const { error } = await supabase.from('sport_regulations').upsert({
        sport_slug: slug,
        body: buildRegulationsHtml(sections),
      }, { onConflict: 'sport_slug' });
      if (error) return showFormError(form, error);
      form.remove();
      await refresh();
    });
    actions.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());

    wrapper.appendChild(form);
  });
  wrapper.appendChild(editBtn);
}

export function mountSportEditControls(main, slug, refresh) {
  injectStyles();
  mountCoordinatorEditing(main, slug, refresh);
  mountMatchesEditing(main, slug, refresh);
  mountGalleryEditing(main, slug, refresh);
  mountRegulationsEditing(main, slug, refresh);
}

// --- Site-wide gallery (homepage carousel), admin-only ---------------------

export function mountSiteGalleryEditControls(listContainer, images, refresh) {
  injectStyles();

  images.forEach((img) => {
    const item = document.createElement('div');
    item.className = 'ie-item-relative';
    item.style.cssText = 'display:inline-block;margin:4px;';
    item.innerHTML = `<img src="${escapeHtml(img.image_url)}" alt="${escapeHtml(img.caption || '')}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;">`;
    attachDeleteButton(item, async () => {
      const { error } = await supabase.from('site_gallery').delete().eq('id', img.id);
      if (!error) await refresh();
      return { error };
    });
    listContainer.appendChild(item);
  });

  const addBtn = makeAddAffordance('הוסף תמונה לגלריה הכללית', () => {
    if (listContainer.querySelector('.ie-inline-form')) return;
    const form = document.createElement('div');
    form.className = 'ie-inline-form';
    form.innerHTML = `
      <input type="file" class="ie-image-file" accept="image/*">
      <input type="text" class="ie-caption" placeholder="כיתוב (אופציונלי)">
      <div class="ie-form-actions">
        <button type="button" class="ie-save-btn">הוסף</button>
        <button type="button" class="ie-cancel-btn">ביטול</button>
      </div>
    `;
    const saveBtn = form.querySelector('.ie-save-btn');
    saveBtn.addEventListener('click', async () => {
      const file = form.querySelector('.ie-image-file').files[0];
      if (!file) return showFormError(form, { message: 'יש לבחור קובץ תמונה' });
      saveBtn.disabled = true;
      saveBtn.textContent = 'מעלה...';
      const { url, error: uploadError } = await uploadImageFile(file, 'site');
      if (uploadError) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'הוסף';
        return showFormError(form, uploadError);
      }
      const { error } = await supabase.from('site_gallery').insert({
        image_url: url,
        caption: form.querySelector('.ie-caption').value.trim() || null,
      });
      if (error) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'הוסף';
        return showFormError(form, error);
      }
      form.remove();
      await refresh();
    });
    form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
    listContainer.appendChild(form);
  });
  listContainer.appendChild(addBtn);
}

// --- Homepage notices (admin-only) ------------------------------------------

export function mountNoticesAdmin(container, notices, refresh) {
  injectStyles();
  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'ie-manage-list';

  notices.forEach((notice) => {
    const row = makeManageRow(
      `<strong>${escapeHtml(notice.title)}</strong><span>${escapeHtml(notice.body)}</span>`,
      {
        onEdit: () => openNoticeForm(list, refresh, notice),
        onDelete: async () => {
          const { error } = await supabase.from('homepage_notices').delete().eq('id', notice.id);
          if (!error) await refresh();
          return { error };
        },
      }
    );
    list.appendChild(row);
  });
  container.appendChild(list);

  const addBtn = makeAddAffordance('הוסף הודעה', () => openNoticeForm(container, refresh, null, notices.length));
  container.appendChild(addBtn);
}

function openNoticeForm(anchor, refresh, notice, nextSortOrder = 0) {
  if (anchor.querySelector('.ie-inline-form')) return;
  const form = document.createElement('div');
  form.className = 'ie-inline-form';
  form.innerHTML = `
    <input type="text" class="ie-notice-title" placeholder="כותרת">
    <textarea class="ie-notice-body" rows="2" placeholder="תוכן ההודעה"></textarea>
    <div class="ie-form-actions">
      <button type="button" class="ie-save-btn">שמור</button>
      <button type="button" class="ie-cancel-btn">ביטול</button>
    </div>
  `;
  form.querySelector('.ie-notice-title').value = notice?.title || '';
  form.querySelector('.ie-notice-body').value = notice?.body || '';
  form.querySelector('.ie-save-btn').addEventListener('click', async () => {
    const title = form.querySelector('.ie-notice-title').value.trim();
    const body = form.querySelector('.ie-notice-body').value.trim();
    if (!title) return showFormError(form, { message: 'יש להזין כותרת' });
    const { error } = notice
      ? await supabase.from('homepage_notices').update({ title, body }).eq('id', notice.id)
      : await supabase.from('homepage_notices').insert({ title, body, sort_order: nextSortOrder });
    if (error) return showFormError(form, error);
    form.remove();
    await refresh();
  });
  form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
  anchor.appendChild(form);
}

// --- Homepage articles (admin-only) -----------------------------------------

export function mountArticlesAdmin(container, articles, refresh) {
  injectStyles();
  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'ie-manage-list';

  articles.forEach((article) => {
    const row = makeManageRow(
      `<strong>${escapeHtml(article.title)}</strong><span>${escapeHtml(article.badge_label)} · ${escapeHtml(article.url || 'ללא קישור')}</span>`,
      {
        onEdit: () => openArticleForm(list, refresh, article),
        onDelete: async () => {
          const { error } = await supabase.from('homepage_articles').delete().eq('id', article.id);
          if (!error) await refresh();
          return { error };
        },
      }
    );
    list.appendChild(row);
  });
  container.appendChild(list);

  const addBtn = makeAddAffordance('הוסף מאמר', () => openArticleForm(container, refresh, null, articles.length));
  container.appendChild(addBtn);
}

function openArticleForm(anchor, refresh, article, nextSortOrder = 0) {
  if (anchor.querySelector('.ie-inline-form')) return;
  const form = document.createElement('div');
  form.className = 'ie-inline-form';
  form.innerHTML = `
    <input type="text" class="ie-art-badge" placeholder="תווית מקור (למשל: ספורט 5)">
    <input type="color" class="ie-art-color" title="צבע התווית">
    <input type="text" class="ie-art-title" placeholder="כותרת המאמר">
    <input type="url" class="ie-art-url" placeholder="קישור (אופציונלי)">
    <textarea class="ie-art-body" rows="3" placeholder="תקציר"></textarea>
    <input type="text" class="ie-art-time" placeholder="תווית זמן (למשל: לפני שעה)">
    <div class="ie-form-actions">
      <button type="button" class="ie-save-btn">שמור</button>
      <button type="button" class="ie-cancel-btn">ביטול</button>
    </div>
  `;
  form.querySelector('.ie-art-badge').value = article?.badge_label || '';
  form.querySelector('.ie-art-color').value = article?.badge_color || '#0b66ff';
  form.querySelector('.ie-art-title').value = article?.title || '';
  form.querySelector('.ie-art-url').value = article?.url || '';
  form.querySelector('.ie-art-body').value = article?.body || '';
  form.querySelector('.ie-art-time').value = article?.time_label || '';
  form.querySelector('.ie-save-btn').addEventListener('click', async () => {
    const title = form.querySelector('.ie-art-title').value.trim();
    if (!title) return showFormError(form, { message: 'יש להזין כותרת' });
    const payload = {
      badge_label: form.querySelector('.ie-art-badge').value.trim() || 'חדשות',
      badge_color: form.querySelector('.ie-art-color').value,
      title,
      url: form.querySelector('.ie-art-url').value.trim() || null,
      body: form.querySelector('.ie-art-body').value.trim(),
      time_label: form.querySelector('.ie-art-time').value.trim(),
    };
    const { error } = article
      ? await supabase.from('homepage_articles').update(payload).eq('id', article.id)
      : await supabase.from('homepage_articles').insert({ ...payload, sort_order: nextSortOrder });
    if (error) return showFormError(form, error);
    form.remove();
    await refresh();
  });
  form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
  anchor.appendChild(form);
}

// --- Ad slots (site-wide, admin-only) ---------------------------------------

export function mountAdSlotEditor(adEl, slot, adRow, refresh) {
  injectStyles();
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'ie-ad-edit-btn';
  editBtn.textContent = 'ערוך פרסומת';
  editBtn.addEventListener('click', () => {
    if (adEl.querySelector('.ie-inline-form')) return;
    const form = document.createElement('div');
    form.className = 'ie-inline-form';
    form.innerHTML = `
      <input type="file" class="ie-ad-file" accept="image/*">
      <input type="url" class="ie-ad-link" placeholder="קישור בלחיצה (אופציונלי)">
      <input type="text" class="ie-ad-caption" placeholder="טקסט (כאשר אין תמונה)">
      <div class="ie-form-actions">
        <button type="button" class="ie-save-btn">שמור</button>
        <button type="button" class="ie-clear-btn">נקה פרסומת</button>
        <button type="button" class="ie-cancel-btn">ביטול</button>
      </div>
    `;
    form.querySelector('.ie-ad-link').value = adRow?.link_url || '';
    form.querySelector('.ie-ad-caption').value = adRow?.caption || '';
    const saveBtn = form.querySelector('.ie-save-btn');
    saveBtn.addEventListener('click', async () => {
      const file = form.querySelector('.ie-ad-file').files[0];
      let image_url = adRow?.image_url || null;
      if (file) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'מעלה...';
        const { url, error: uploadError } = await uploadImageFile(file, 'ads');
        if (uploadError) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'שמור';
          return showFormError(form, uploadError);
        }
        image_url = url;
      }
      const { error } = await supabase.from('site_ads').upsert({
        slot,
        image_url,
        link_url: form.querySelector('.ie-ad-link').value.trim() || null,
        caption: form.querySelector('.ie-ad-caption').value.trim() || (slot === 'left' ? 'פרסומת שמאל' : 'פרסומת ימין'),
      }, { onConflict: 'slot' });
      if (error) return showFormError(form, error);
      form.remove();
      await refresh();
    });
    form.querySelector('.ie-clear-btn').addEventListener('click', async () => {
      const { error } = await supabase.from('site_ads').upsert({
        slot,
        image_url: null,
        link_url: null,
        caption: slot === 'left' ? 'פרסומת שמאל' : 'פרסומת ימין',
      }, { onConflict: 'slot' });
      if (error) return showFormError(form, error);
      form.remove();
      await refresh();
    });
    form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
    adEl.appendChild(form);
  });
  adEl.appendChild(editBtn);
}

// --- About page: free-text sections (admin-only) ----------------------------

export function mountAboutSectionEditor(headingEl, section, refresh) {
  injectStyles();
  const editBtn = makeEditAffordance('ערוך טקסט', () => {
    if (headingEl.nextElementSibling?.classList.contains('ie-inline-form')) return;
    const form = document.createElement('div');
    form.className = 'ie-inline-form';
    form.innerHTML = `
      <textarea class="ie-section-body" rows="6" placeholder="כל שורה = פסקה נפרדת"></textarea>
      <div class="ie-form-actions">
        <button type="button" class="ie-save-btn">שמור</button>
        <button type="button" class="ie-cancel-btn">ביטול</button>
      </div>
    `;
    form.querySelector('.ie-section-body').value = section.body || '';
    form.querySelector('.ie-save-btn').addEventListener('click', async () => {
      const body = form.querySelector('.ie-section-body').value;
      const { error } = await supabase.from('about_sections').update({ body }).eq('section_key', section.section_key);
      if (error) return showFormError(form, error);
      form.remove();
      await refresh();
    });
    form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
    headingEl.insertAdjacentElement('afterend', form);
  });
  editBtn.classList.add('ie-about-edit-btn');
  headingEl.appendChild(editBtn);
}

// --- About page: board members table (admin-only) ---------------------------

export function mountAboutBoardEditor(tableBodyEl, members, refresh) {
  injectStyles();
  const table = tableBodyEl.closest('table');
  const theadRow = table.querySelector('thead tr');
  if (theadRow && !theadRow.querySelector('.ie-actions-col')) {
    const th = document.createElement('th');
    th.className = 'ie-actions-col';
    theadRow.appendChild(th);
  }

  const { wrapper, isNew } = ensureControlsWrapper(table);

  members.forEach((member) => {
    const tr = tableBodyEl.querySelector(`tr[data-id="${member.id}"]`);
    if (!tr) return;
    const tdActions = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ie-edit-small-btn';
    editBtn.textContent = 'ערוך';
    editBtn.addEventListener('click', () => {
      if (wrapper.querySelector('.ie-inline-form')) return;
      openBoardMemberForm(wrapper, refresh, member);
    });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'ie-delete-small-btn';
    delBtn.textContent = 'מחק';
    delBtn.addEventListener('click', async () => {
      const { error } = await supabase.from('about_board_members').delete().eq('id', member.id);
      if (!error) await refresh();
      else alert(`מחיקה נכשלה: ${error.message}`);
    });
    tdActions.append(editBtn, delBtn);
    tr.appendChild(tdActions);
  });

  if (!isNew) return;
  const addBtn = makeAddAffordance('הוסף חבר הנהלה', () => {
    if (wrapper.querySelector('.ie-inline-form')) return;
    openBoardMemberForm(wrapper, refresh, null, members.length);
  });
  wrapper.appendChild(addBtn);
}

function openBoardMemberForm(anchor, refresh, member, nextSortOrder = 0) {
  const form = document.createElement('div');
  form.className = 'ie-inline-form ie-board-row-form';
  form.innerHTML = `
    <input type="text" class="ie-member-name" placeholder="שם">
    <input type="text" class="ie-member-role" placeholder="תפקיד">
    <div class="ie-form-actions">
      <button type="button" class="ie-save-btn">שמור</button>
      <button type="button" class="ie-cancel-btn">ביטול</button>
    </div>
  `;
  form.querySelector('.ie-member-name').value = member?.name || '';
  form.querySelector('.ie-member-role').value = member?.role || 'חבר הנהלה';
  form.querySelector('.ie-save-btn').addEventListener('click', async () => {
    const name = form.querySelector('.ie-member-name').value.trim();
    const role = form.querySelector('.ie-member-role').value.trim() || 'חבר הנהלה';
    if (!name) return showFormError(form, { message: 'יש להזין שם' });
    const { error } = member
      ? await supabase.from('about_board_members').update({ name, role }).eq('id', member.id)
      : await supabase.from('about_board_members').insert({ name, role, sort_order: nextSortOrder });
    if (error) return showFormError(form, error);
    form.remove();
    await refresh();
  });
  form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
  anchor.appendChild(form);
}

// --- About page: the 3 person-photo cards (admin-only) ----------------------

export function mountAboutImageEditor(figureEl, slot, imageRow, refresh) {
  injectStyles();
  figureEl.querySelector('.ie-about-image-edit')?.remove();
  const editBtn = makeEditAffordance('ערוך תמונה', () => {
    if (figureEl.querySelector('.ie-inline-form')) return;
    const form = document.createElement('div');
    form.className = 'ie-inline-form';
    form.innerHTML = `
      <input type="file" class="ie-image-file" accept="image/*">
      <input type="text" class="ie-caption" placeholder="כיתוב">
      <div class="ie-form-actions">
        <button type="button" class="ie-save-btn">שמור</button>
        <button type="button" class="ie-cancel-btn">ביטול</button>
      </div>
    `;
    form.querySelector('.ie-caption').value = imageRow?.caption || '';
    const saveBtn = form.querySelector('.ie-save-btn');
    saveBtn.addEventListener('click', async () => {
      const file = form.querySelector('.ie-image-file').files[0];
      let image_url = imageRow?.image_url || null;
      if (file) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'מעלה...';
        const { url, error: uploadError } = await uploadImageFile(file, 'about');
        if (uploadError) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'שמור';
          return showFormError(form, uploadError);
        }
        image_url = url;
      }
      const { error } = await supabase.from('about_people_images').upsert({
        slot,
        image_url,
        caption: form.querySelector('.ie-caption').value.trim(),
      }, { onConflict: 'slot' });
      if (error) return showFormError(form, error);
      form.remove();
      await refresh();
    });
    form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
    figureEl.appendChild(form);
  });
  editBtn.classList.add('ie-about-image-edit');
  figureEl.appendChild(editBtn);
}

// --- Top moving strip (admin-only) ------------------------------------------

export function mountStripAdmin(container, items, refresh) {
  injectStyles();
  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'ie-manage-list';

  items.forEach((item) => {
    const row = makeManageRow(
      `<span>${escapeHtml(item.text)}</span>`,
      {
        onEdit: () => openStripItemForm(list, refresh, item),
        onDelete: async () => {
          const { error } = await supabase.from('strip_items').delete().eq('id', item.id);
          if (!error) await refresh();
          return { error };
        },
      }
    );
    list.appendChild(row);
  });
  container.appendChild(list);

  const addBtn = makeAddAffordance('הוסף פריט לסטריפ', () => openStripItemForm(container, refresh, null, items.length));
  container.appendChild(addBtn);
}

function openStripItemForm(anchor, refresh, item, nextSortOrder = 0) {
  if (anchor.querySelector('.ie-inline-form')) return;
  const form = document.createElement('div');
  form.className = 'ie-inline-form';
  form.innerHTML = `
    <input type="text" class="ie-strip-text" placeholder="טקסט הפריט (אפשר גם עם אימוג'י)">
    <div class="ie-form-actions">
      <button type="button" class="ie-save-btn">שמור</button>
      <button type="button" class="ie-cancel-btn">ביטול</button>
    </div>
  `;
  form.querySelector('.ie-strip-text').value = item?.text || '';
  form.querySelector('.ie-save-btn').addEventListener('click', async () => {
    const text = form.querySelector('.ie-strip-text').value.trim();
    if (!text) return showFormError(form, { message: 'יש להזין טקסט' });
    const { error } = item
      ? await supabase.from('strip_items').update({ text }).eq('id', item.id)
      : await supabase.from('strip_items').insert({ text, sort_order: nextSortOrder });
    if (error) return showFormError(form, error);
    form.remove();
    await refresh();
  });
  form.querySelector('.ie-cancel-btn').addEventListener('click', () => form.remove());
  anchor.appendChild(form);
}
