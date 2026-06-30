import yaml from 'https://esm.sh/js-yaml@4.1.0';
import { escapeHtml } from './wen-utils.js';

export class WenYamlView {
  constructor(node, getPos, editor) {
    this.node = node;
    this.getPos = getPos;
    this.editor = editor;
    
    this.dom = document.createElement('div');
    this.dom.className = 'wen-yaml-block';
    this.dom.contentEditable = 'false';

    this.dom.innerHTML = `
      <div class="wen-yaml-header">
        <span class="wen-yaml-title">🗂️ Properties</span>
        <button class="wen-yaml-toggle-btn" data-state="visual">View Raw</button>
      </div>
      <div class="wen-yaml-visual-container">
        <div class="wen-yaml-view-visual active"></div>
        <div class="wen-yaml-fade"></div>
        <button class="wen-yaml-expand-btn">▼ Show More</button>
      </div>
      <div class="wen-yaml-view-raw"><textarea class="wen-yaml-raw-input"></textarea></div>
      <div class="wen-yaml-error-state hidden"><span class="wen-yaml-error-msg"></span></div>
    `;

    const toggleBtn = this.dom.querySelector('.wen-yaml-toggle-btn');
    const visualContainer = this.dom.querySelector('.wen-yaml-visual-container');
    const visualView = this.dom.querySelector('.wen-yaml-view-visual');
    const expandBtn = this.dom.querySelector('.wen-yaml-expand-btn');
    const rawView = this.dom.querySelector('.wen-yaml-view-raw');
    const rawInput = this.dom.querySelector('.wen-yaml-raw-input');
    const errorState = this.dom.querySelector('.wen-yaml-error-state');
    const errorMsg = this.dom.querySelector('.wen-yaml-error-msg');

    rawInput.value = this.node.textContent;
    let isUpdatingFromUI = false;

    // --- EXPAND/COLLAPSE LOGIC ---
    let isExpanded = false;
    const checkHeight = () => {
      if (visualView.scrollHeight > 220) {
        visualContainer.classList.add('needs-collapse');
        visualContainer.classList.toggle('is-collapsed', !isExpanded);
      } else {
        visualContainer.classList.remove('needs-collapse', 'is-collapsed');
      }
    };

    expandBtn.addEventListener('click', () => {
      isExpanded = !isExpanded;
      visualContainer.classList.toggle('is-collapsed', !isExpanded);
      expandBtn.innerText = isExpanded ? '▲ Show Less' : '▼ Show More';
    });

    // --- TIP TAP SYNC ---
    const updateTipTapState = (newRawYaml) => {
      if (newRawYaml === this.node.textContent) return;
      if (typeof this.getPos === 'function') {
        const tr = this.editor.state.tr;
        const start = this.getPos() + 1;
        const end = start + this.node.nodeSize - 2;
        if (newRawYaml) tr.replaceWith(start, end, this.editor.schema.text(newRawYaml));
        else tr.delete(start, end);
        this.editor.view.dispatch(tr);
      }
    };

    const castValue = (str) => {
      if (str === 'true') return true;
      if (str === 'false') return false;
      if (str === 'null') return null;
      if (!isNaN(str) && str.trim() !== '') return Number(str);
      return str;
    };

    const scrapeNode = (container) => {
      if (container.classList.contains('wen-type-object')) {
        const obj = {};
        container.querySelectorAll(':scope > .wen-row-list > .wen-row').forEach(row => {
          // Strictly target the direct key input of THIS row
          const k = row.querySelector(':scope > .wen-row-top > .wen-key-wrap > .wen-key').value.trim();
          
          // Strictly check THIS row's top level or THIS row's complex wrapper
          const valContainer = row.querySelector(':scope > .wen-row-top > .wen-val-wrap > div') 
                            || row.querySelector(':scope > .wen-complex-wrap > div');
          
          if (k && valContainer) obj[k] = scrapeNode(valContainer);
        });
        return obj;
      }
      if (container.classList.contains('wen-type-array')) {
        const arr = [];
        container.querySelectorAll(':scope > .wen-array-list > .wen-array-item').forEach(item => {
          // Same strict scoping for array items
          const valContainer = item.querySelector(':scope > .wen-row-top > .wen-val-wrap > div') 
                            || item.querySelector(':scope > .wen-complex-wrap > div');
          
          if (valContainer) arr.push(scrapeNode(valContainer));
        });
        return arr;
      }
      if (container.classList.contains('wen-type-primitive')) {
        return castValue(container.querySelector('.wen-val').value);
      }
      return '';
    };

    const sync = () => {
      const newData = scrapeNode(visualView.firstElementChild);
      const newYaml = Object.keys(newData).length ? yaml.dump(newData) : '';
      rawInput.value = newYaml;
      
      isUpdatingFromUI = true;
      updateTipTapState(newYaml);
      isUpdatingFromUI = false;
      
      checkHeight(); // Re-check height if they added rows
    };

    // --- UI BUILDER ---
    const buildUI = (data) => {
      const createPrimitive = (val) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'wen-type-primitive';
        wrapper.innerHTML = `
          <textarea class="wen-val" rows="1" placeholder="Empty value...">${escapeHtml(val !== null && val !== undefined ? val : '')}</textarea>
          <div class="wen-type-controls">
            <button class="wen-make-obj" title="Add Section">📂</button>
            <button class="wen-make-arr" title="Add List">📋</button>
          </div>
        `;
        const textarea = wrapper.querySelector('.wen-val');
        const resize = () => { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'; };
        textarea.addEventListener('input', () => { resize(); sync(); });
        setTimeout(resize, 0);

        // --- THE FIX: Move the new complex object to the correct line ---
        const handleComplexSwap = (newElement) => {
          // Find the parent row (either a standard row or a list item)
          const row = wrapper.closest('.wen-row') || wrapper.closest('.wen-array-item');
          if (row) {
            row.classList.add('has-complex');
            // Append it to the dedicated block-level container underneath
            row.querySelector('.wen-complex-wrap').appendChild(newElement);
            // Delete the primitive wrapper from the top line
            wrapper.remove();
          } else {
            wrapper.replaceWith(newElement);
          }
          sync();
        };

        wrapper.querySelector('.wen-make-obj').addEventListener('click', () => handleComplexSwap(createObject({ "": "" })));
        wrapper.querySelector('.wen-make-arr').addEventListener('click', () => handleComplexSwap(createArray([""])));
        
        return wrapper;
      };

      const createArray = (arr) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'wen-type-array';
        const list = document.createElement('div');
        list.className = 'wen-array-list';

        const addItem = (val) => {
          const isComplex = typeof val === 'object' && val !== null;
          const item = document.createElement('div');
          item.className = `wen-array-item ${isComplex ? 'has-complex' : ''}`;
          item.innerHTML = `
            <div class="wen-row-top">
              <span class="wen-bullet">-</span>
              <div class="wen-val-wrap"></div>
              <button class="wen-btn-delete" title="Remove Item">×</button>
            </div>
            <div class="wen-complex-wrap"></div>
          `;
          
          const targetWrap = isComplex ? item.querySelector('.wen-complex-wrap') : item.querySelector('.wen-val-wrap');
          targetWrap.appendChild(isComplex ? (Array.isArray(val) ? createArray(val) : createObject(val)) : createPrimitive(val));
          
          item.querySelector('.wen-btn-delete').addEventListener('click', () => { item.remove(); sync(); });
          list.appendChild(item);
        };

        arr.forEach(addItem);
        const addBtn = document.createElement('button');
        addBtn.className = 'wen-btn-add';
        addBtn.innerText = '+ Add list item';
        addBtn.addEventListener('click', () => { addItem(''); sync(); });

        wrapper.appendChild(list);
        wrapper.appendChild(addBtn);
        return wrapper;
      };

      const createObject = (obj) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'wen-type-object';
        const rowList = document.createElement('div');
        rowList.className = 'wen-row-list';

        const addRow = (k, v) => {
          const isComplex = typeof v === 'object' && v !== null;
          const row = document.createElement('div');
          row.className = `wen-row ${isComplex ? 'has-complex' : ''}`;
          row.innerHTML = `
            <div class="wen-row-top">
              <div class="wen-key-wrap"><input type="text" class="wen-key" value="${escapeHtml(k)}" placeholder="Label..." /><span class="wen-colon">:</span></div>
              <div class="wen-val-wrap"></div>
              <button class="wen-btn-delete" title="Remove Property">×</button>
            </div>
            <div class="wen-complex-wrap"></div>
          `;
          
          const targetWrap = isComplex ? row.querySelector('.wen-complex-wrap') : row.querySelector('.wen-val-wrap');
          targetWrap.appendChild(isComplex ? (Array.isArray(v) ? createArray(v) : createObject(v)) : createPrimitive(v));

          row.querySelector('.wen-key').addEventListener('input', sync);
          row.querySelector('.wen-btn-delete').addEventListener('click', () => { row.remove(); sync(); });
          rowList.appendChild(row);
        };

        Object.keys(obj).forEach(k => addRow(k, obj[k]));
        const addBtn = document.createElement('button');
        addBtn.className = 'wen-btn-add';
        addBtn.innerText = '+ Add property';
        addBtn.addEventListener('click', () => { addRow('', ''); sync(); });

        wrapper.appendChild(rowList);
        wrapper.appendChild(addBtn);
        return wrapper;
      };

      return createObject(data);
    };

    const renderVisualGrid = () => {
      visualView.innerHTML = '';
      let dataObj = {};
      try {
        dataObj = yaml.load(rawInput.value) || {};
        errorState.classList.remove('active');
      } catch (err) {
        errorMsg.innerText = "YAML Error: " + err.message;
        errorState.classList.add('active');
        return;
      }
      if (typeof dataObj !== 'object' || dataObj === null || Array.isArray(dataObj)) dataObj = { "": dataObj };
      visualView.appendChild(buildUI(dataObj));
      setTimeout(checkHeight, 0); // Check height after render
    };

    toggleBtn.addEventListener('click', () => {
      const isVisual = toggleBtn.getAttribute('data-state') === 'visual';
      if (isVisual) {
        visualContainer.style.display = 'none';
        rawView.classList.add('active');
        toggleBtn.setAttribute('data-state', 'raw');
        toggleBtn.innerText = 'View UI';
      } else {
        renderVisualGrid();
        if (!errorState.classList.contains('active')) {
          rawView.classList.remove('active');
          visualContainer.style.display = 'block';
          toggleBtn.setAttribute('data-state', 'visual');
          toggleBtn.innerText = 'View Raw';
        }
      }
    });

    rawInput.addEventListener('input', () => {
      updateTipTapState(rawInput.value);
    });
    
    renderVisualGrid();

    this.update = (updatedNode) => {
      if (updatedNode.type.name !== 'codeBlock' || updatedNode.attrs.language !== 'yaml') return false;
      if (this.node.textContent !== updatedNode.textContent) {
        this.node = updatedNode;
        rawInput.value = this.node.textContent;
        if (!isUpdatingFromUI) {
          renderVisualGrid();
        }
      }
      return true;
    };

    this.stopEvent = () => true;
  }
}