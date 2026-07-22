let printAreaReady = false;

function ensurePrintArea() {
  if (printAreaReady) return document.getElementById('print-area');
  const printArea = document.createElement('div');
  printArea.id = 'print-area';
  document.body.appendChild(printArea);
  const style = document.createElement('style');
  style.textContent = `
    #print-area { display: none; }
    @media print {
      body > *:not(#print-area) { display: none !important; }
      #print-area { display: block !important; padding: 20px; }
    }
  `;
  document.head.appendChild(style);
  printAreaReady = true;
  return printArea;
}

export function printRegulation(title, bodyHtml) {
  const printArea = ensurePrintArea();
  printArea.innerHTML = `<h2>${title}</h2>${bodyHtml}`;
  window.print();
}

// Renders a "download file" link (if present) + a print button into
// `container`. Used both on each sport page's תקנון tab and on the general
// תקנונים page's modal, so the file/print UI stays identical everywhere.
export function renderRegulationControls(container, { title, bodyHtml, fileUrl }) {
  container.innerHTML = '';
  if (fileUrl) {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'regulation-file-link';
    link.textContent = '📎 הורדת קובץ התקנון';
    container.appendChild(link);
  }
  const printBtn = document.createElement('button');
  printBtn.type = 'button';
  printBtn.className = 'regulation-print-btn';
  printBtn.textContent = '🖨️ הדפס תקנון';
  printBtn.addEventListener('click', () => printRegulation(title, bodyHtml));
  container.appendChild(printBtn);
}
