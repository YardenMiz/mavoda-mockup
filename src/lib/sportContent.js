import { supabase } from './supabase.js';
import { getEditContext, canEditSport, mountSportEditControls } from './inlineEditor.js';
import { renderRegulationControls } from './printRegulation.js';

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
    const locationHtml = m.location ? `<div class="location">📍 ${escapeHtml(m.location)}</div>` : '';
    if (withScore) {
      item.innerHTML = `<div><div class="teams">${escapeHtml(m.opponent)}</div><div class="date">${escapeHtml(m.when_label)}</div>${locationHtml}</div>${
        m.score ? `<div class="score">${escapeHtml(m.score)}</div>` : ''
      }`;
    } else {
      // Order matters: .results-item is a flex row, so with the RTL first
      // child rightmost/last child leftmost, this puts location in the
      // middle and the time on the left.
      item.innerHTML = `<div><strong>${escapeHtml(m.opponent)}</strong></div>${locationHtml}<div class="time">${escapeHtml(m.when_label)}</div>`;
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

// The "בחר שנה" select above the results list only makes sense once it
// actually filters the results shown below it by the chosen season_year,
// instead of just sitting there decoratively (its options are static
// leftover mockup markup, not tied to real data).
function wireYearSelect(container, results, onChange) {
  const select = container.querySelector('select');
  if (!select) {
    renderMatches(container, results, { withScore: true });
    return;
  }
  const years = [...new Set(results.map((m) => m.season_year))].filter(Boolean).sort((a, b) => b - a);
  if (!years.length) {
    renderMatches(container, results, { withScore: true });
    return;
  }
  const requested = Number(select.value);
  const selectedYear = years.includes(requested) ? requested : years[0];
  select.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
  select.value = String(selectedYear);
  renderMatches(container, results.filter((m) => m.season_year === selectedYear), { withScore: true });
  // Property assignment (not addEventListener) so re-running this on every
  // refresh replaces the old handler instead of stacking duplicates.
  select.onchange = () => {
    const year = Number(select.value);
    renderMatches(container, results.filter((m) => m.season_year === year), { withScore: true });
    onChange?.();
  };
}

async function loadAndRender(main, slug, onYearChange) {
  const [sportRes, matchesRes, galleryRes, regsRes] = await Promise.all([
    supabase.from('sports').select('*').eq('slug', slug).maybeSingle(),
    supabase.from('sport_matches').select('*').eq('sport_slug', slug).order('created_at'),
    supabase.from('sport_gallery').select('*').eq('sport_slug', slug).order('created_at'),
    supabase.from('sport_regulations').select('*').eq('sport_slug', slug).maybeSingle(),
  ]);

  if (sportRes.data) {
    const nameEl = main.querySelector('.coordinator-name');
    const phoneEl = main.querySelector('.coordinator-phone');
    const emailEl = main.querySelector('.coordinator-email');
    const photoEl = main.querySelector('.coordinator-photo');
    if (nameEl && sportRes.data.coordinator_name) nameEl.textContent = `רכז: ${sportRes.data.coordinator_name}`;
    if (phoneEl && sportRes.data.coordinator_phone) phoneEl.textContent = `טלפון: ${sportRes.data.coordinator_phone}`;
    if (emailEl) emailEl.textContent = sportRes.data.coordinator_email || '';
    if (photoEl) {
      if (sportRes.data.coordinator_photo) {
        photoEl.src = sportRes.data.coordinator_photo;
        photoEl.hidden = false;
      } else {
        photoEl.hidden = true;
      }
    }
  }

  const matches = matchesRes.data || [];
  const upcoming = matches.filter((m) => !m.is_result);
  const results = matches.filter((m) => m.is_result);
  if (upcoming.length) renderMatches(main.querySelector('#upcoming'), upcoming, { withScore: false });
  const resultsContainer = main.querySelector('#results');
  if (results.length && resultsContainer) wireYearSelect(resultsContainer, results, onYearChange);

  if (galleryRes.data && galleryRes.data.length) {
    renderGallery(main.querySelector('#gallery'), galleryRes.data);
  }

  if (regsRes.data && (regsRes.data.body || regsRes.data.file_url)) {
    const regsContainer = main.querySelector('#regulations');
    if (regsContainer) {
      regsContainer.dataset.fileUrl = regsRes.data.file_url || '';
      regsContainer.innerHTML = `<div class="regulations-text">${regsRes.data.body || ''}</div><div class="regulation-controls"></div>`;
      renderRegulationControls(regsContainer.querySelector('.regulation-controls'), {
        title: `תקנון ${sportRes.data?.name || ''}`,
        bodyHtml: regsRes.data.body || '',
        fileUrl: regsRes.data.file_url,
      });
    }
  }

  return { sport: sportRes.data, matches, gallery: galleryRes.data || [], regulations: regsRes.data };
}

export async function initSportContent() {
  const main = document.querySelector('main[data-sport]');
  if (!main) return;
  const slug = main.dataset.sport;

  const ctx = await getEditContext();
  const editable = canEditSport(ctx, slug);

  // Switching the year filter re-renders `.results-item`s outside the normal
  // loadAndRender/refresh cycle, so editors need their delete buttons
  // re-attached the same way `refresh` below does after a save.
  let refresh;
  const reattachIfEditable = () => { if (editable) mountSportEditControls(main, slug, refresh); };

  await loadAndRender(main, slug, reattachIfEditable);

  if (editable) {
    refresh = async () => {
      await loadAndRender(main, slug, reattachIfEditable);
      // Re-run: content containers just had their innerHTML replaced, so
      // freshly rendered items need their delete buttons re-attached. The
      // "add" controls live in a sibling wrapper and are left alone (see
      // ensureControlsWrapper in inlineEditor.js), so this is safe to repeat.
      mountSportEditControls(main, slug, refresh);
    };
    mountSportEditControls(main, slug, refresh);
  }
}
