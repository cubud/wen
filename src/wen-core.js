import { Editor } from 'https://esm.sh/@tiptap/core@2.2.4';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.2.4';
import { Markdown } from 'https://esm.sh/tiptap-markdown@0.8.9';
import Link from 'https://esm.sh/@tiptap/extension-link@2.2.4';
import Image from 'https://esm.sh/@tiptap/extension-image@2.2.4';

import CodeBlockLowlight from 'https://esm.sh/@tiptap/extension-code-block-lowlight@2.2.4';
import { createLowlight, common } from 'https://esm.sh/lowlight@3.1.0';

// 1. New Table Imports
import Table from 'https://esm.sh/@tiptap/extension-table@2.2.4';
import TableRow from 'https://esm.sh/@tiptap/extension-table-row@2.2.4';
import TableHeader from 'https://esm.sh/@tiptap/extension-table-header@2.2.4';
import TableCell from 'https://esm.sh/@tiptap/extension-table-cell@2.2.4';

import TaskList from 'https://esm.sh/@tiptap/extension-task-list@2.2.4';
import TaskItem from 'https://esm.sh/@tiptap/extension-task-item@2.2.4';

// ... existing imports ...
import { Extension } from 'https://esm.sh/@tiptap/core@2.2.4';
import { Plugin, PluginKey } from 'https://esm.sh/@tiptap/pm@2.2.4/state';
import { Decoration, DecorationSet } from 'https://esm.sh/@tiptap/pm@2.2.4/view';

import { escapeHtml } from './wen-utils.js';

const lowlight = createLowlight(common);

const GitHubAlerts = Extension.create({
  name: 'githubAlerts',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('githubAlerts'),
        props: {
          decorations(state) {
            const decorations = [];
            const { doc } = state;

            doc.descendants((node, pos) => {
              if (node.type.name === 'blockquote') {
                const firstChild = node.firstChild;
                
                // Check if the blockquote starts with a paragraph
                if (firstChild && firstChild.type.name === 'paragraph') {
                  const text = firstChild.textContent;
                  const match = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
                  
                  if (match) {
                    const type = match[1].toLowerCase();
                    
                    // 1. Decorate the parent Blockquote wrapper
                    decorations.push(
                      Decoration.node(pos, pos + node.nodeSize, {
                        class: `wen-github-alert wen-github-alert-${type}`
                      })
                    );
                    
                    // 2. Decorate the exact [!TYPE] text to look like a colored badge
                    // (pos = blockquote, pos+1 = paragraph, pos+2 = start of text node)
                    const startPos = pos + 2; 
                    const endPos = startPos + match[0].length;
                    
                    decorations.push(
                      Decoration.inline(startPos, endPos, {
                        class: `wen-github-alert-badge wen-github-alert-badge-${type}`
                      })
                    );
                  }
                }
              }
            });
            return DecorationSet.create(doc, decorations);
          }
        }
      })
    ];
  }
});

const WenSmartBlocks = CodeBlockLowlight.extend({
  addOptions() {
    return { ...this.parent?.(), blockViews: {}, lowlight };
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const lang = node.attrs.language;
      const ViewClass = this.options.blockViews[lang];
      if (ViewClass) return new ViewClass(node, getPos, editor);

      const dom = document.createElement('pre');
      const contentDOM = document.createElement('code');
      if (lang) contentDOM.className = `language-${lang}`;
      dom.appendChild(contentDOM);
      return { dom, contentDOM };
    };
  }
});

export class WenEditor {
  constructor(options) {
    this.container = options.element;
    this.blockViews = options.blockViews || {};
    this.useFrontmatter = options.useFrontmatter !== false;
    this.useNativeComponents = options.useNativeComponents !== false;
    // Safe by default: rich-render paths are sanitized and mermaid runs in 'strict' mode.
    // Pass `unsafe: true` to opt out and render untrusted HTML/diagrams verbatim.
    this.unsafe = options.unsafe === true;

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'wen-editor-wrapper';
    
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'wen-toolbar';
    
    this.editorNode = document.createElement('div');
    
    this.wrapper.appendChild(this.toolbar);
    this.wrapper.appendChild(this.editorNode);
    this.container.appendChild(this.wrapper);

    const processedMarkdown = this.importMarkdown(options.initialMarkdown || '');

    this.editor = new Editor({
      element: this.editorNode,
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        WenSmartBlocks.configure({ blockViews: this.blockViews }), 
        GitHubAlerts,
        Markdown,
        Image,
        Link.configure({ openOnClick: false }),
        Table.configure({ resizable: true, HTMLAttributes: { class: 'wen-table' } }),
        TableRow,
        TableHeader,
        TableCell,
        TaskList,
        TaskItem.configure({ nested: true }),
      ],
      content: processedMarkdown,
      editorProps: { attributes: { class: 'wen-editor-root' } },
      onTransaction: () => this.updateToolbarStates()
    });

    this.editor.wenEditorInstance = this;

    this.buildToolbar();
  }

  importMarkdown(md) {
    let processed = md;
    if (this.useFrontmatter) {
      processed = processed.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/, '```yaml\n$1\n```\n\n');
    }
    if (this.useNativeComponents) {
      const tokens = processed.split(/(^```[\s\S]*?^```\r?\n?)/m);
      for (let i = 0; i < tokens.length; i++) {
        if (i % 2 === 0) {
          let chunk = tokens[i];
          
          // THE FIX: Prepend a newline to ensure TipTap never merges adjacent components into a single broken code block
          const openCloseRegex = /^[ \t]*<([a-zA-Z0-9-]+)[^>]*>[\s\S]*?<\/\1>[ \t]*/gm;
          chunk = chunk.replace(openCloseRegex, (match) => '\n```component\n' + match.trim() + '\n```\n');
          
          const selfCloseRegex = /^[ \t]*<([a-zA-Z0-9-]+)[^>]*\/>[ \t]*/gm;
          chunk = chunk.replace(selfCloseRegex, (match) => '\n```component\n' + match.trim() + '\n```\n');
          
          tokens[i] = chunk;
        }
      }
      processed = tokens.join('');
    }
    return processed;
  }

  loadContent(md) {
    // Run the text through our pre-processor to handle YAML and Components
    const processed = this.importMarkdown(md);
    // Replace the entire document safely
    this.editor.commands.setContent(processed);
  }
  
  exportMarkdown() {
    let md = this.editor.storage.markdown.getMarkdown();
    if (this.useFrontmatter) {
      md = md.replace(/^```yaml\r?\n([\s\S]*?)\r?\n```\r?\n?/, '---\n$1\n---\n');
    }
    if (this.useNativeComponents) {
      // THE FIX: Allow leading [ \t]* and trailing whitespace inside the block wrapper
      const unwrapRegex = /```component\r?\n([ \t]*<(?:[a-zA-Z0-9-]+)[\s\S]*?>)[ \t]*\r?\n```\r?\n?/gm;
      md = md.replace(unwrapRegex, '$1\n');
    }
    return md;
  }

  downloadMarkdown(filename = 'wen-document.md') {
    const md = this.exportMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Append to body, click it, and instantly clean it up
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  buildToolbar() {
    // 3. Upgraded createBtn to support disabled states
    const createBtn = (label, action, isActiveCheck = null, isDisabledCheck = null) => {
      const btn = document.createElement('button');
      btn.className = 'wen-toolbar-btn';
      btn.innerHTML = label;
      btn.addEventListener('click', () => { action(); this.editor.view.focus(); });
      if (isActiveCheck) btn.isActiveCheck = isActiveCheck;
      if (isDisabledCheck) btn.isDisabledCheck = isDisabledCheck;
      this.toolbar.appendChild(btn);
      return btn;
    };

    const addDivider = () => {
      const div = document.createElement('div');
      div.className = 'wen-toolbar-divider';
      this.toolbar.appendChild(div);
    };

    createBtn('<b>B</b>', () => this.editor.chain().focus().toggleBold().run(), () => this.editor.isActive('bold'));
    createBtn('<i>I</i>', () => this.editor.chain().focus().toggleItalic().run(), () => this.editor.isActive('italic'));
    createBtn('<s>S</s>', () => this.editor.chain().focus().toggleStrike().run(), () => this.editor.isActive('strike'));
    addDivider();
    createBtn('¶ Text', () => this.editor.chain().focus().setParagraph().run(), () => this.editor.isActive('paragraph'));
    createBtn('H1', () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(), () => this.editor.isActive('heading', { level: 1 }));
    createBtn('H2', () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(), () => this.editor.isActive('heading', { level: 2 }));
    createBtn('H3', () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(), () => this.editor.isActive('heading', { level: 3 }));
    createBtn('H4', () => this.editor.chain().focus().toggleHeading({ level: 4 }).run(), () => this.editor.isActive('heading', { level: 4 }));    
    addDivider();
    createBtn('• List', () => this.editor.chain().focus().toggleBulletList().run(), () => this.editor.isActive('bulletList'));
    createBtn('1. List', () => this.editor.chain().focus().toggleOrderedList().run(), () => this.editor.isActive('orderedList'));
    createBtn('☑️ Task', () => this.editor.chain().focus().toggleTaskList().run(), () => this.editor.isActive('taskList'));
    createBtn('\" Quote', () => this.editor.chain().focus().toggleBlockquote().run(), () => this.editor.isActive('blockquote'));
    createBtn('📢 Alert', () => {
      this.editor.chain().focus().insertContent('<blockquote><p>[!NOTE]<br>Your message here...</p></blockquote>').run();
    });
    addDivider();

    createBtn('🔗 Link', () => {
      const previousUrl = this.editor.getAttributes('link').href;
      this.showModal('Insert Link', 'URL', previousUrl, (url) => {
        if (url === null) return; 
        if (url === '') this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
        else this.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      });
    }, () => this.editor.isActive('link'));

    createBtn('🖼️ Image', () => {
      const attrs = this.editor.getAttributes('image');
      const previousUrl = attrs.src || '';
      
      this.showModal(previousUrl ? 'Edit Image' : 'Insert Image', 'Image URL', previousUrl, (url) => {
        if (url) {
          this.editor.chain().focus().setImage({ src: url }).run();
        }
      });
    }, () => this.editor.isActive('image'));

    addDivider();
    
    // 4. The Table Controls
    createBtn('📊 Table', () => this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run());
    createBtn('+ Row', () => this.editor.chain().focus().addRowAfter().run(), null, () => !this.editor.can().addRowAfter());
    createBtn('+ Col', () => this.editor.chain().focus().addColumnAfter().run(), null, () => !this.editor.can().addColumnAfter());
    createBtn('- Row', () => this.editor.chain().focus().deleteRow().run(), null, () => !this.editor.can().deleteRow());
    createBtn('- Col', () => this.editor.chain().focus().deleteColumn().run(), null, () => !this.editor.can().deleteColumn());
    createBtn('x Table', () => this.editor.chain().focus().deleteTable().run(), null, () => !this.editor.can().deleteTable());
    
    // THE NEW ADDITION: The Save Button
    addDivider();
    createBtn('💾 Save', () => {
      // You could easily hook up a prompt here to ask for a filename if you wanted!
      this.downloadMarkdown('wen-document.md');
    });
  }

  updateToolbarStates() {
    this.toolbar.querySelectorAll('.wen-toolbar-btn').forEach(btn => {
      if (btn.isActiveCheck) {
        if (btn.isActiveCheck()) btn.classList.add('is-active');
        else btn.classList.remove('is-active');
      }
      // Check if the button should be disabled (e.g. table actions when not in a table)
      if (btn.isDisabledCheck) {
        btn.disabled = btn.isDisabledCheck();
      }
    });
  }

  showModal(title, inputPlaceholder, initialValue, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'wen-modal-overlay';
    overlay.innerHTML = `
      <div class="wen-modal">
        <strong>${escapeHtml(title)}</strong>
        <input type="text" placeholder="${escapeHtml(inputPlaceholder)}" value="${escapeHtml(initialValue || '')}" />
        <div class="wen-modal-actions">
          <button class="wen-modal-cancel">Cancel</button>
          <button class="wen-modal-submit">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('input');
    input.focus();

    const close = (value) => { document.body.removeChild(overlay); callback(value); };
    overlay.querySelector('.wen-modal-cancel').addEventListener('click', () => close(null));
    overlay.querySelector('.wen-modal-submit').addEventListener('click', () => close(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value);
      if (e.key === 'Escape') close(null);
    });
  }
  
  showRichModal(title, initialMarkdown, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'wen-rich-modal-overlay';
    overlay.innerHTML = `
      <div class="wen-rich-modal">
        <div class="wen-rich-modal-header">
          <strong>Editing Content: &lt;${escapeHtml(title)}&gt;</strong>
          <div>
            <button class="wen-modal-cancel">Cancel</button>
            <button class="wen-modal-submit">Save Changes</button>
          </div>
        </div>
        <div class="wen-rich-modal-body" id="modal-editor-container"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Spawn a recursive child WenEditor inside the modal!
    const modalEditor = new WenEditor({
      element: overlay.querySelector('#modal-editor-container'),
      blockViews: this.blockViews, // Inherit all our rich UI blocks
      useFrontmatter: false,       // Sub-components don't need YAML frontmatter
      useNativeComponents: this.useNativeComponents,
      unsafe: this.unsafe,         // Inherit the trust setting into recursive editors
      initialMarkdown: initialMarkdown
    });

    const close = (save) => {
      const finalMd = save ? modalEditor.exportMarkdown() : null;
      modalEditor.editor.destroy(); // Clean up memory
      document.body.removeChild(overlay);
      if (save) callback(finalMd);
    };

    overlay.querySelector('.wen-modal-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('.wen-modal-submit').addEventListener('click', () => close(true));
  }
}