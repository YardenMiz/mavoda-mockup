document.addEventListener('DOMContentLoaded', () => {
  // If the page already manages a moving strip via a placeholder, do nothing
  if (document.getElementById('moving-strip-placeholder')) return;

  // Fetch the moving strip HTML and insert it at the top of the <body>
  fetch('skin/moving-strip.html')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load moving-strip');
      return res.text();
    })
    .then(html => {
      const container = document.createElement('div');
      container.id = 'moving-strip-placeholder';
      container.innerHTML = html;
      const body = document.body;
      if (body.firstChild) body.insertBefore(container, body.firstChild);
      else body.appendChild(container);
    })
    .catch(err => {
      console.warn('moving-strip-loader:', err);
    });
});
