document.addEventListener('DOMContentLoaded', () => {
  // Load the moving strip
  // The moving strip is now statically included in all HTML files, so dynamic loading is not needed.

  // Initialize header scripts (e.g., search functionality)
  initializeHeaderScripts();

  // If header and footer are also dynamic, uncomment these:
  // loadHTML('header-placeholder', 'includes/header.html', initializeHeaderScripts);
  // loadHTML('footer-placeholder', 'includes/footer.html');
});

function initializeHeaderScripts() {
  const sportMap = {
    'כדורגל': 'soccer.html',
    'כדורסל': 'basketball.html',
    'כדורעף': 'volleyball.html',
    'כדורשת': 'handball.html',
    'טניס': 'tennis.html',
    'שחייה': 'swimming.html',
    'ריצה': 'running.html',
    'אופני הרים': 'mountainbike.html',
    'פאדל': 'padel.html',
    'טניס שולחן': 'pingpong.html',
    'באולינג': 'bowling.html',
    'סנוקר': 'snooker.html',
    'שחמט': 'chess.html',
    'שש בש': 'backgammon.html',
    'ירי ספורטיבי': 'archery.html',
    'קטרגל': 'curling.html',
    'סאפ': 'sup.html'
  };

  const searchSelect = document.querySelector('.search');
  if (searchSelect) {
    searchSelect.addEventListener('change', function() {
      const sport = this.value.trim();
      if (sportMap[sport]) {
        window.location.href = sportMap[sport];
      }
    });
  }
}