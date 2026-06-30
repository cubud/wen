# ƿen (AKA wen / wynn / "joy") editor

**Sponsored by [Cubud](https://cubud.com)**

**ƿen** (pronounced *wen*) takes its name from the Anglo-Saxon runic alphabet. The rune **ƿ** (wynn) translates directly to "joy." Because it was historically transliterated as "w" (wen) but visually masquerades as the letter "p" (pen), it felt like the perfect namesake for a text editor: a tool designed to bring a little more joy to the act of writing.

### 🤝 The Philosophy: A Shared Language

ƿen was built to bridge a historical divide. 

For years, developers have loved the clean, portable predictability of formats like Markdown, YAML, and XML components. Meanwhile, content editors and real humans have understandably preferred the immediate visual feedback of WYSIWYG (What You See Is What You Get) interfaces. 

We didn't build ƿen to wage war on modern, heavy web frameworks. Instead, it is offered as a lightweight, unifying *alternative*. We've chosen to avoid a complex toolchain (no Node.js, no Webpack, no `npm install`) to build incredibly rich, extensible browser experiences _but_ acknowledge that we're only able to do this by leveraging robust and mature open source libraries like TipTap, Frappe, Lowlight, Mermaid and others.

By taking abstract technical formats and wrapping them in friendly, interactive user interfaces, ƿen helps demystify developer tools for everyday writers. The ultimate goal is to encourage the wider adoption of these brilliant, plain-text concepts. When a content team gets comfortable editing YAML configurations and Markdown tables visually in ƿen, it becomes second nature to start using those same Markdown shortcuts to format a WhatsApp message, or structure a quick note on their phone. 

It is about bringing developers and editors together into the same workflow, speaking the exact same language.

### ✨ Core Features

ƿen is an ESM-native, vanilla JavaScript editor built on top of TipTap and ProseMirror. It introduces a unique "Dumb Router" architecture that keeps your underlying data perfectly pure while providing a massively upgraded Writer Experience (WX).

* **Zero-Build Extensibility:** No build step required. Just import the ESM modules directly from CDNs and stitch them together with a simple bash script.
* **Visual YAML Frontmatter:** Writers can edit complex, nested page metadata through a clean, interactive form UI, which seamlessly serializes back to strict YAML.
* **Recursive Component IDE:** Drop XML/React-style components right into the editor. ƿen renders them as visual wireframes with editable attribute pills. Need to edit the Markdown *inside* a component? Click "Edit in WYSIWYG" to spawn a recursive, infinite-depth rich modal.
* **Smart Block Routing:** Type a code block, and ƿen instantly routes it to a custom UI.
    * ```` ```mermaid ```` renders live, scalable state diagrams.
    * ```` ```chart ```` turns simple CSV data into beautiful, on-brand Frappe Charts.
    * ```` ```javascript ```` gracefully falls back to GitHub-dark syntax highlighting.
* **Native Markdown Superpowers:** Full visual support for Markdown Tables, interactive Checklists, and dynamic GitHub-flavored Alerts (`[!WARNING]`), all perfectly translating back to standard text.

### 📄 Optional Frontmatter
ƿen natively supports YAML frontmatter, treating it as a highly structured interactive form. 

By default, the editor intercepts blocks at the top of the file bracketed by `---`. It temporarily translates this into a standard ````yaml` code block so TipTap can safely route it to the visual `WenYamlView` UI without destroying the key/value pairs. When you export the document, ƿen seamlessly translates it back into strict `---` frontmatter.

*(To disable this translation if you are using the editor for fragments rather than full pages, simply pass `useFrontmatter: false` in the configuration object).*

### 🧩 Inline Component Support
You can author custom HTML or React/JSX-style components directly in the Markdown stream:

```xml
<Hero banner="/img/bg.jpg" align="center">
  # Hello World
</Hero>
```

When useNativeComponents is enabled, ƿen uses a lightweight AST translation layer. It temporarily wraps these XML nodes in ````component` code blocks, allowing the "Dumb Router" to intercept them. They are rendered as interactive wireframes where attributes become editable text inputs.

Because of this encapsulation, writers can safely edit the Markdown inside the component via a spawned modal without accidentally deleting the XML tags. On export, the wrapper is stripped away, leaving your pristine <Hero> tags exactly where they belong.

## Installation & Usage

No `npm install`. ƿen is published to npm as [`@cubud/wen`](https://www.npmjs.com/package/@cubud/wen) and served for free over the jsDelivr CDN. Just load the styles and import the modules:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@cubud/wen@1/dist/wen-full.min.css">
<script type="module">
  import {
    WenEditor, WenYamlView, WenComponentView, WenMermaidView, WenChartView
  } from 'https://cdn.jsdelivr.net/npm/@cubud/wen@1/dist/wen-full.min.js';

  const editor = new WenEditor({
    element: document.getElementById('my-editor'),
    // Dependency Injection: Route the code blocks to the visual engines
    blockViews: {
      'yaml': WenYamlView,
      'component': WenComponentView,
      'mermaid': WenMermaidView,
      'chart': WenChartView
    },
    initialMarkdown: '# Welcome to ƿen.'
  });
</script>
```

> Prefer ESM-native imports with automatic dependency resolution? `https://esm.sh/@cubud/wen@1` works too.

## API

`editor.exportMarkdown()`

Serializes the current state of the editor back into a clean, strictly formatted Markdown string (including perfectly indented YAML data blocks and XML components).

## Security

ƿen turns Markdown, YAML, components and Mermaid diagrams into live HTML. By default it is **safe**: interpolated values are escaped, component previews are sanitized with [DOMPurify](https://github.com/cure53/DOMPurify), and Mermaid runs in `strict` mode (no inline HTML or click handlers).

If you fully trust your content and want raw HTML and interactive diagrams rendered verbatim, opt in explicitly:

```js
const editor = new WenEditor({ /* ... */, unsafe: true });
```

ƿen is open source and dependency-light by design, so you're free to adapt this behaviour — but the default keeps an untrusted document from executing script in your page.

## License

MIT License. Build great things.