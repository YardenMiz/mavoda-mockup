document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('footer-placeholder')) return;

  fetch('skin/footer.html')
    .then(res => {
      if (!res.ok) throw new Error('Failed to load footer');
      return res.text();
    })
    .then(html => {
      const container = document.createElement('div');
      container.id = 'footer-placeholder';
      container.innerHTML = html;
      const body = document.body;
      if (body.firstChild) body.insertBefore(container, body.firstChild);
      else body.appendChild(container);
    })
    .catch(err => {
      console.warn('footer-loader:', err);
    });
});
