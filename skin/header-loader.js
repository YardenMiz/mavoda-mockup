document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('header-placeholder')) return;

  fetch('skin/header.html')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load header');
      return res.text();
    })
    .then(html => {
      const container = document.createElement('div');
      container.id = 'header-placeholder';
      container.innerHTML = html;
      const body = document.body;
      if (body.firstChild) body.insertBefore(container, body.firstChild);
      else body.appendChild(container);
    })
    .catch(err => {
      console.warn('header-loader:', err);
    });
});
