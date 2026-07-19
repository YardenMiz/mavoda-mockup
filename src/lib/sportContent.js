import { supabase } from './supabase.js';
import { getEditContext, canEditSport, mountSportEditControls } from './inlineEditor.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function clearMatchItems(container) {
  // Keep the decorative year selector control (its markup varies: a bare
  // <select>, or a <select> wrapped in a .year-selector div) and drop
  // everything else, since older sport pages show their one hardcoded
  // result/blurb in a plain, unclassed <div> rather than `.results-item`.
  [...container.children].forEach((child) => {
    const isYearControl = child.classList.contains('year-selector') || child.tagName === 'SELECT';
    if (!isYearControl) child.remove();
  });
}

function renderMatches(container, matches, { withScore }) {
  if (!container) return;
  clearMatchItems(container);
  for (const m of matches) {
    const item = document.createElement('div');
    item.className = 'results-item';
    item.dataset.id = m.id;
    if (withScore) {
      item.innerHTML = `<div><div class="teams">${escapeHtml(m.opponent)}</div><div class="date">${escapeHtml(m.when_label)}</div></div>${
        m.score ? `<div class="score">${escapeHtml(m.score)}</div>` : ''
      }`;
    } else {
      item.innerHTML = `<div><strong>${escapeHtml(m.opponent)}</strong></div><div>${escapeHtml(m.when_label)}</div>`;
    }
    container.appendChild(item);
  }
}

function renderGallery(container, images) {
  if (!container) return;
  let grid = container.querySelector('.gallery-grid');
  if (!grid) {
    grid = document.createElement('div');
    grid.className = 'gallery-grid';
    container.innerHTML = '';
    container.appendChild(grid);
  } else {
    grid.innerHTML = '';
  }
  for (const g of images) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.id = g.id;
    item.innerHTML = `<img src="${escapeHtml(g.image_url)}" alt="${escapeHtml(g.caption || 'תמונה')}" width="200" height="200" loading="lazy">`;
    grid.appendChild(item);
  }
}

async function loadAndRender(main, slug) {
  const [sportRes, matchesRes, galleryRes, regsRes] = await Promise.all([
    supabase.from('sports').select('*').eq('slug', slug).maybeSingle(),
    supabase.from('sport_matches').select('*').eq('sport_slug', slug).order('created_at'),
    supabase.from('sport_gallery').select('*').eq('sport_slug', slug).order('created_at'),
    supabase.from('sport_regulations').select('*').eq('sport_slug', slug).maybeSingle(),
  ]);

  if (sportRes.data) {
    const nameEl = main.querySelector('.coordinator-name');
    const phoneEl = main.querySelector('.coordinator-phone');
    if (nameEl && sportRes.data.coordinator_name) nameEl.textContent = `רכז: ${sportRes.data.coordinator_name}`;
    if (phoneEl && sportRes.data.coordinator_phone) phoneEl.textContent = `טלפון: ${sportRes.data.coordinator_phone}`;
  }

  const matches = matchesRes.data || [];
  const upcoming = matches.filter((m) => !m.is_result);
  const results = matches.filter((m) => m.is_result);
  if (upcoming.length) renderMatches(main.querySelector('#upcoming'), upcoming, { withScore: false });
  if (results.length) renderMatches(main.querySelector('#results'), results, { withScore: true });

  if (galleryRes.data && galleryRes.data.length) {
    renderGallery(main.querySelector('#gallery'), galleryRes.data);
  }

  if (regsRes.data && regsRes.data.body) {
    const regsContainer = main.querySelector('#regulations');
    if (regsContainer) {
      regsContainer.innerHTML = `<div class="regulations-text">${regsRes.data.body}</div>`;
    }
  }

  return { sport: sportRes.data, matches, gallery: galleryRes.data || [], regulations: regsRes.data };
}

export async function initSportContent() {
  const main = document.querySelector('main[data-sport]');
  if (!main) return;
  const slug = main.dataset.sport;

  await loadAndRender(main, slug);

  const ctx = await getEditContext();
  if (canEditSport(ctx, slug)) {
    const refresh = async () => {
      await loadAndRender(main, slug);
      // Re-run: content containers just had their innerHTML replaced, so
      // freshly rendered items need their delete buttons re-attached. The
      // "add" controls live in a sibling wrapper and are left alone (see
      // ensureControlsWrapper in inlineEditor.js), so this is safe to repeat.
      mountSportEditControls(main, slug, refresh);
    };
    mountSportEditControls(main, slug, refresh);
  }
}
