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
}

function makeAddAffordance(label, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ie-edit-affordance';
  btn.textContent = `+ ${label}`;
  btn.addEventListener('click', onClick);
  return btn;
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
