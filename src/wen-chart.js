import frappe from 'https://esm.sh/frappe-charts@1.6.2';
const Chart = frappe.Chart || frappe;

export class WenChartView {
  constructor(node, getPos, editor) {
    this.node = node;
    this.getPos = getPos;
    this.editor = editor;

    this.dom = document.createElement('div');
    this.dom.className = 'wen-chart-block';
    this.dom.contentEditable = 'false';

    this.dom.innerHTML = `
      <div class="wen-chart-header">
        <span class="wen-chart-title">📊 Frappe Chart</span>
        <button class="wen-chart-toggle-btn" data-state="visual">Edit Data</button>
      </div>
      <div class="wen-chart-view-visual active">
        <div class="frappe-container"></div>
      </div>
      <div class="wen-chart-view-raw"><textarea class="wen-chart-raw-input"></textarea></div>
    `;

    const toggleBtn = this.dom.querySelector('.wen-chart-toggle-btn');
    const visualView = this.dom.querySelector('.wen-chart-view-visual');
    const chartContainer = this.dom.querySelector('.frappe-container');
    const rawView = this.dom.querySelector('.wen-chart-view-raw');
    const rawInput = this.dom.querySelector('.wen-chart-raw-input');

    rawInput.value = this.node.textContent;
    let isUpdatingFromUI = false;
    let chartInstance = null;

    const updateTipTapState = (newRawContent) => {
      if (newRawContent === this.node.textContent) return;
      if (typeof this.getPos === 'function') {
        const tr = this.editor.state.tr;
        const start = this.getPos() + 1;
        const end = start + this.node.nodeSize - 2;
        if (newRawContent) tr.replaceWith(start, end, this.editor.schema.text(newRawContent));
        else tr.delete(start, end);
        this.editor.view.dispatch(tr);
      }
    };

    const parseMicroFormat = (text) => {
      const lines = text.trim().split('\n');
      let type = 'bar';
      let title = '';
      let dataStartIndex = 0;
      
      // 1. Extract config above the ---
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '---') { dataStartIndex = i + 1; break; }
        if (line.toLowerCase().startsWith('type:')) type = line.split(':')[1].trim();
        if (line.toLowerCase().startsWith('title:')) title = line.split(':')[1].trim();
      }
      
      // If no --- divider is found, assume the whole thing is just CSV
      if (dataStartIndex === 0) dataStartIndex = 0;

      // 2. Parse the CSV headers
      const headers = lines[dataStartIndex].split(',').map(s => s.trim());
      const labels = [];
      const datasets = headers.slice(1).map(name => ({ name, values: [] }));
      
      // 3. Parse the CSV data rows
      for (let i = dataStartIndex + 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty rows
        const cols = lines[i].split(',').map(s => s.trim());
        labels.push(cols[0]);
        cols.slice(1).forEach((val, idx) => {
          if (datasets[idx]) datasets[idx].values.push(Number(val) || 0);
        });
      }

      return { title, type, data: { labels, datasets } };
    };

    const renderChart = () => {
      try {
        const config = parseMicroFormat(rawInput.value);
        chartContainer.innerHTML = ''; // Clear previous SVG
        
        // Let Frappe do its magic
        chartInstance = new Chart(chartContainer, {
          title: config.title,
          data: config.data,
          type: config.type, 
          height: 250,
          colors: ['#8250df', '#0d9488', '#cf222e', '#bf8700'] // Default categorical palette
        });
        
        let errorMsg = visualView.querySelector('.wen-chart-error');
        if (errorMsg) errorMsg.remove();
        chartContainer.style.display = 'block';

      } catch (err) {
        chartContainer.style.display = 'none';
        let errorMsg = visualView.querySelector('.wen-chart-error');
        if (!errorMsg) {
          errorMsg = document.createElement('div');
          errorMsg.className = 'wen-chart-error';
          visualView.appendChild(errorMsg);
        }
        errorMsg.innerHTML = `<strong>Data Parsing Error:</strong><br/>Ensure you have a header row and valid numbers.`;
      }
    };

    toggleBtn.addEventListener('click', () => {
      const isVisual = toggleBtn.getAttribute('data-state') === 'visual';
      if (isVisual) {
        visualView.classList.remove('active');
        rawView.classList.add('active');
        toggleBtn.setAttribute('data-state', 'raw');
        toggleBtn.innerText = 'View Chart';
      } else {
        renderChart();
        rawView.classList.remove('active');
        visualView.classList.add('active');
        toggleBtn.setAttribute('data-state', 'visual');
        toggleBtn.innerText = 'Edit Data';
      }
    });

    rawInput.addEventListener('input', () => {
      isUpdatingFromUI = true;
      updateTipTapState(rawInput.value);
      isUpdatingFromUI = false;
    });
    
    renderChart();

    this.update = (updatedNode) => {
      if (updatedNode.type.name !== 'codeBlock' || updatedNode.attrs.language !== 'chart') return false;
      if (this.node.textContent !== updatedNode.textContent) {
        this.node = updatedNode;
        rawInput.value = this.node.textContent;
        if (!isUpdatingFromUI) renderChart();
      }
      return true;
    };

    this.stopEvent = () => true;
  }
}
