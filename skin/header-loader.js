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
      // If moving strip exists, insert header before it so header appears above the strip
      const moving = document.getElementById('moving-strip-placeholder') || document.querySelector('.moving-strip');
      if (moving && moving.parentNode) {
        moving.parentNode.insertBefore(container, moving);
      } else if (body.firstChild) {
        body.insertBefore(container, body.firstChild);
      } else {
        body.appendChild(container);
      }
      // <script> tags inserted via innerHTML don't execute, so re-create them
      container.querySelectorAll('script').forEach(oldScript => {
        const newScript = document.createElement('script');
        for (const attr of oldScript.attributes) {
          newScript.setAttribute(attr.name, attr.value);
        }
        newScript.textContent = oldScript.textContent;
        oldScript.replaceWith(newScript);
      });
    })
    .catch(err => {
      console.warn('header-loader:', err);
    });
});
