// Import the industry-standard markdown parser for our live previews
import { marked } from 'https://esm.sh/marked@12.0.1';
import { sanitizeHtml } from './wen-utils.js';

export class WenComponentView {
  constructor(node, getPos, editor) {
    this.node = node;
    this.getPos = getPos;
    this.editor = editor;

    this.dom = document.createElement('div');
    this.dom.className = 'wen-component-block';
    this.dom.contentEditable = 'false';

    this.dom.innerHTML = `
      <div class="wen-component-header">
        <span class="wen-component-title">🧩 Component Wireframe</span>
        <button class="wen-component-toggle-btn" data-state="visual">View Raw XML</button>
      </div>
      <div class="wen-component-view-visual active"></div>
      <div class="wen-component-view-raw"><textarea class="wen-component-raw-input"></textarea></div>
    `;

    const toggleBtn = this.dom.querySelector('.wen-component-toggle-btn');
    const visualView = this.dom.querySelector('.wen-component-view-visual');
    const rawView = this.dom.querySelector('.wen-component-view-raw');
    const rawInput = this.dom.querySelector('.wen-component-raw-input');

    rawInput.value = this.node.textContent;
    let isUpdatingFromUI = false;

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

    const renderVisualWireframe = () => {
      visualView.innerHTML = '';

      // Safe by default: marked output is sanitized unless the editor opts into unsafe mode.
      const unsafe = this.editor.wenEditorInstance?.unsafe === true;

      let rawCode = rawInput.value.trim();
      rawCode = rawCode.replace(/^```[a-zA-Z0-9-]*\r?\n/, '').replace(/\r?\n```$/, '').trim();
      
      const componentRegex = /^<([a-zA-Z0-9-]+)\s*([^>]*?)(?:(?:>([\s\S]*)<\/\1>)|(?:\/?>))$/;
      const match = rawCode.match(componentRegex);

      if (!match) {
         visualView.innerHTML = `<div class="wen-component-error">Syntax Error: Cannot parse component structure.</div>`;
         return;
      }

      let currentTagName = match[1];
      let attributesStr = match[2].trim();
      let currentInner = match[3];
      let isSelfClosing = currentInner === undefined && rawCode.endsWith('/>');

      let currentAttributes = [];
      const attrRegex = /([a-zA-Z0-9_]+)=(?:'([^']*)'|"([^"]*)"|\{([^}]*)\})/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attributesStr)) !== null) {
        currentAttributes.push({ name: attrMatch[1], value: attrMatch[2] || attrMatch[3] || attrMatch[4] || '' });
      }

      const syncState = () => {
        const attrsStr = currentAttributes.map(a => `${a.name}="${a.value}"`).join(' ');
        const space = attrsStr ? ' ' + attrsStr : '';
        let newRaw = isSelfClosing 
          ? `<${currentTagName}${space} />`
          : `<${currentTagName}${space}>\n${currentInner}\n</${currentTagName}>`;
          
        rawInput.value = newRaw;
        isUpdatingFromUI = true;
        updateTipTapState(newRaw);
        isUpdatingFromUI = false;
      };

      const wireframe = document.createElement('div');
      wireframe.className = 'wen-wireframe';

      const header = document.createElement('div');
      header.className = 'wen-wireframe-header';
      header.innerHTML = `<strong>${currentTagName}</strong> ${isSelfClosing ? '<em>(Self-Closing)</em>' : ''}`;
      wireframe.appendChild(header);

      if (currentAttributes.length > 0) {
        const propsContainer = document.createElement('div');
        propsContainer.className = 'wen-wireframe-props';
        
        currentAttributes.forEach((attr, idx) => {
          const prop = document.createElement('span');
          prop.className = 'wen-wireframe-prop';
          prop.innerHTML = `<span class="wen-prop-key">${attr.name}</span> = `;
          
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'wen-prop-val-input';
          input.value = attr.value;
          
          input.addEventListener('input', (e) => {
            currentAttributes[idx].value = e.target.value;
            syncState();
          });
          
          prop.appendChild(input);
          propsContainer.appendChild(prop);
        });
        wireframe.appendChild(propsContainer);
      }

      if (!isSelfClosing) {
        const contentContainer = document.createElement('div');
        contentContainer.className = 'wen-wireframe-content';
        
        // 1. The DOMParser Preview Logic (Restored!)
        let previewHTML = '<em>Empty content</em>';
        if ((currentInner || '').trim()) {
           try {
             const doc = new DOMParser().parseFromString(currentInner, 'text/html');
             
             const parseNode = (n) => {
               if (n.nodeType === 1) { // HTML node
                 const name = n.localName;
                 if (n.hasChildNodes() && n.childNodes.length > 0) {
                   return `<div class="wen-preview-tag">&lt;${name}&gt;</div>\n${parseChildren(n.childNodes)}\n<div class="wen-preview-tag">&lt;/${name}&gt;</div>\n`;
                 } else {
                   return `<div class="wen-preview-tag">&lt;${name}/&gt;</div>\n`;
                 }
               } else if (n.nodeType === 3) { // Text node
                 const text = n.textContent.replace(/^ +/gm, '');
                 if (!text.trim()) return '';
                 return `<div class="wen-preview-md">${marked.parse(text)}</div>`;
               }
               return '';
             };

             const parseChildren = (children) => {
               let raw = '';
               for (let i = 0; i < children.length; i++) {
                 raw += parseNode(children[i]);
               }
               return raw;
             };

             const parsed = parseChildren(doc.body.childNodes);
             if (parsed.trim()) previewHTML = parsed;
           } catch(e) {
             previewHTML = '<em>Preview unavailable</em>';
           }
        }
        
        const safePreview = unsafe ? previewHTML : sanitizeHtml(previewHTML);
        contentContainer.innerHTML = `
          <div class="wen-wireframe-preview-box">
            <div class="wen-wireframe-preview">${safePreview}</div>
          </div>
          <button class="wen-wireframe-edit-btn">✏️ Edit in WYSIWYG</button>
        `;
        
        // 2. The Smart Outdent Utility
        const outdent = (str) => {
          if (!str) return '';
          const lines = str.split('\n');
          let minIndent = Infinity;
          lines.forEach(line => {
            if (line.trim().length > 0) {
              const match = line.match(/^[ \t]*/);
              if (match) {
                const indent = match[0].length;
                if (indent < minIndent) minIndent = indent;
              }
            }
          });
          if (minIndent === Infinity || minIndent === 0) return str;
          return lines.map(line => line.trim().length === 0 ? line : line.substring(minIndent)).join('\n');
        };

        contentContainer.querySelector('.wen-wireframe-edit-btn').addEventListener('click', () => {
          // Clean the indentation before handing it to the modal
          const cleanMarkdown = outdent(currentInner || '');
          
          this.editor.wenEditorInstance.showRichModal(currentTagName, cleanMarkdown, (newMd) => {
            currentInner = '\n' + newMd + '\n';
            syncState();
            renderVisualWireframe();
          });
        });
        
        wireframe.appendChild(contentContainer);
      }

      visualView.appendChild(wireframe);
    };

    toggleBtn.addEventListener('click', () => {
      const isVisual = toggleBtn.getAttribute('data-state') === 'visual';
      if (isVisual) {
        visualView.classList.remove('active');
        rawView.classList.add('active');
        toggleBtn.setAttribute('data-state', 'raw');
        toggleBtn.innerText = 'View UI';
      } else {
        renderVisualWireframe();
        rawView.classList.remove('active');
        visualView.classList.add('active');
        toggleBtn.setAttribute('data-state', 'visual');
        toggleBtn.innerText = 'View Raw XML';
      }
    });

    rawInput.addEventListener('input', () => {
      isUpdatingFromUI = true;
      updateTipTapState(rawInput.value);
      isUpdatingFromUI = false;
    });
    
    renderVisualWireframe();

    this.update = (updatedNode) => {
      if (updatedNode.type.name !== 'codeBlock' || !['xml', 'component', 'jsx'].includes(updatedNode.attrs.language)) return false;
      if (this.node.textContent !== updatedNode.textContent) {
        this.node = updatedNode;
        rawInput.value = this.node.textContent;
        if (!isUpdatingFromUI) renderVisualWireframe();
      }
      return true;
    };

    this.stopEvent = () => true;
  }
}