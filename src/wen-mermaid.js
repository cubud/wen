import mermaid from 'https://esm.sh/mermaid@10.9.1';
import { escapeHtml } from './wen-utils.js';

// Initialize Mermaid with a neutral theme that works well inside the editor.
// Default to 'strict' (no inline HTML / click handlers); re-initialized per render
// to 'loose' only when the editor is in unsafe mode.
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict'
});

export class WenMermaidView {
  constructor(node, getPos, editor) {
    this.node = node;
    this.getPos = getPos;
    this.editor = editor;
    // Mermaid requires a strictly unique ID for every diagram it renders
    this.id = 'mermaid-' + Math.random().toString(36).substr(2, 9);

    this.dom = document.createElement('div');
    this.dom.className = 'wen-mermaid-block';
    this.dom.contentEditable = 'false';

    this.dom.innerHTML = `
      <div class="wen-mermaid-header">
        <span class="wen-mermaid-title">🧜‍♀️ Mermaid Diagram</span>
        <button class="wen-mermaid-toggle-btn" data-state="visual">Edit Chart</button>
      </div>
      <div class="wen-mermaid-view-visual active"></div>
      <div class="wen-mermaid-view-raw"><textarea class="wen-mermaid-raw-input"></textarea></div>
    `;

    const toggleBtn = this.dom.querySelector('.wen-mermaid-toggle-btn');
    const visualView = this.dom.querySelector('.wen-mermaid-view-visual');
    const rawView = this.dom.querySelector('.wen-mermaid-view-raw');
    const rawInput = this.dom.querySelector('.wen-mermaid-raw-input');

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

    const renderVisualDiagram = async () => {
      visualView.innerHTML = '';
      const code = rawInput.value.trim();
      
      if (!code) {
        visualView.innerHTML = `<div class="wen-mermaid-empty">Empty diagram</div>`;
        return;
      }

      try {
        // Respect the editor's trust setting: only loosen mermaid for unsafe mode.
        const unsafe = this.editor.wenEditorInstance?.unsafe === true;
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: unsafe ? 'loose' : 'strict' });

        // Parse and render the SVG asynchronously
        const { svg } = await mermaid.render(this.id, code);
        visualView.innerHTML = svg;
      } catch (err) {
        // If the syntax is invalid, show a safe error message instead of crashing
        visualView.innerHTML = `<div class="wen-mermaid-error"><strong>Syntax Error:</strong><br/>${escapeHtml(err.message)}</div>`;
        
        // Mermaid occasionally leaves garbage DOM nodes behind on failure, clean them up
        const garbage = document.getElementById(this.id);
        if (garbage) garbage.remove();
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
        renderVisualDiagram();
        rawView.classList.remove('active');
        visualView.classList.add('active');
        toggleBtn.setAttribute('data-state', 'visual');
        toggleBtn.innerText = 'Edit Chart';
      }
    });

    // When the raw textarea changes, update TipTap
    rawInput.addEventListener('input', () => {
      isUpdatingFromUI = true;
      updateTipTapState(rawInput.value);
      isUpdatingFromUI = false;
    });
    
    // Initial Render
    renderVisualDiagram();

    // The TipTap Sync Hook
    this.update = (updatedNode) => {
      if (updatedNode.type.name !== 'codeBlock' || updatedNode.attrs.language !== 'mermaid') return false;
      
      if (this.node.textContent !== updatedNode.textContent) {
        this.node = updatedNode;
        rawInput.value = this.node.textContent;
        
        // If Monaco (or another external source) changed the text, re-render the visual
        if (!isUpdatingFromUI) {
          renderVisualDiagram();
        }
      }
      return true;
    };

    this.stopEvent = () => true;
  }
}
