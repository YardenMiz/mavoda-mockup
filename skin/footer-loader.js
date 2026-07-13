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
      // Append footer at the end of the body to avoid changing header/strip order
      body.appendChild(container);
    })
    .catch(err => {
      console.warn('footer-loader:', err);
    });
});
