# 🤖 Agentic & LLM Contributor Guidelines for Wen (ƿen) Editor

Hello, fellow LLM or AI Assistant! If you have been asked to help extend, debug, or refactor the Wen Editor, please read this document first. It outlines the strict architectural philosophy and boundaries of this project.

## 1. The Core Philosophy
Wen is a vanilla JavaScript, dependency-light, ESM-native rich text editor built on top of TipTap and ProseMirror. 
* **Zero Build Tools:** We do not use Node.js, Webpack, Vite, or npm. We use a simple bash script (`build.sh`) that concatenates files using `cat`.
* **ESM Only:** All third-party libraries must be imported directly from CDNs (like `https://esm.sh/`).
* **Joyful Minimalism:** The editor is named after the Anglo-Saxon rune ƿ (wynn), meaning "joy". Keep the UI polished, the codebase tiny, and the dependencies strictly limited.

## 2. The "Dumb Router" Architecture
Wen bridges the gap between raw Markdown and rich visual interfaces without destroying the underlying Markdown AST. **Do not create custom TipTap nodes for everything.** Instead, we use a "Dumb Router" pattern:
1. All complex data (YAML, Components, Mermaid, Charts) is stored in the Markdown as standard fenced code blocks (e.g., ````yaml`).
2. The core extension (`WenSmartBlocks` in `wen-core.js`) intercepts these standard code blocks based on their language tag.
3. It routes the rendering to independent `NodeView` classes (e.g., `WenYamlView`, `WenMermaidView`).

**If the user asks you to add a new block type (like a Kanban board or a Math renderer):**
* Do NOT rewrite the TipTap schema.
* DO create a new class that intercepts a specific code block language.
* DO ensure the raw text remains pure and standard Markdown.

## 3. The View Class Pattern
Every custom block view MUST implement the following structure:
* **Visual vs. Raw Toggle:** The UI must provide a way to flip between the beautiful visual rendering and the raw text/JSON/XML code.
* **State Synchronization:** You must implement a `updateTipTapState(newContent)` function that safely updates the ProseMirror transaction without crashing the editor cursor.
* **The `update()` Hook:** You must implement TipTap's `update(updatedNode)` method to listen for external changes (e.g., if the user edits the code via a split-pane Monaco editor) and re-render the visual state dynamically.

## 4. Modal and Recursion Rules
Wen supports deep UI recursion (e.g., a component containing markdown, which contains another component).
* Do not attempt to render inline WYSIWYG editors inside of custom NodeViews; the DOM cannot handle the event-bubbling and horizontal space constraints.
* Instead, use the `editor.wenEditorInstance.showRichModal()` method. This spawns a full-screen overlay containing a fresh, recursive instance of Wen Editor to handle inner content.
* Always assign high `z-index` values (`99999`) to utility modals (like Link/Image prompts) so they don't get trapped beneath the recursive rich modals.

## 5. CSS and Styling Strictness
* **Encapsulation:** Prefix all classes with `.wen-`. Do not pollute the global CSS namespace.
* **Box-Sizing:** Always apply `box-sizing: border-box` to custom block wrappers to prevent horizontal blowout when paddings are applied to 100% width textareas.
* **Variables:** Use the provided CSS variables (e.g., `var(--wen-bg)`, `var(--wen-border)`) to ensure dark-mode/light-mode portability.

## 6. Security: Safe by Default
ƿen renders untrusted document content, so it is **safe by default** with a deliberate opt-out (`unsafe: true` in the editor config). Preserve this contract:
* **Never** interpolate document data straight into `innerHTML` or into an HTML attribute. Use `escapeHtml()` from `src/wen-utils.js` for values and attributes — this is baseline correctness and applies in both modes.
* For rich HTML you must inject (e.g. `marked` output), pass it through `sanitizeHtml()` from `src/wen-utils.js`, gated on `this.editor.wenEditorInstance?.unsafe`.
* Third-party renderers must run in their safe mode by default (e.g. Mermaid `securityLevel: 'strict'`), loosening only when `unsafe` is set.
* `WenEditor` propagates `unsafe` into recursive modal editors — keep that wiring intact when touching `showRichModal`.

## 7. Development Workflow
If you are instructed to create a new module (e.g., `src/wen-math.js`):
1. Write the JS file and its accompanying `src/wen-math.css` file.
2. Instruct the user to add the CSS file to the concatenation list in `build.sh`.
3. Instruct the user to add the JS export to the temporary entry point in `build.sh`.
4. Instruct the user to map the language tag to the new class in the `blockViews` configuration inside `index.html`.

Stick to these patterns, avoid unnecessary abstractions, and help us keep the editor a joy to use and maintain.
