#!/bin/bash

echo "Building ƿen editor..."

# 1. Prepare the output directory
rm -rf dist
mkdir dist

# 2. Combine and Minify CSS
echo "Stitching CSS..."
cat src/wen-core.css src/wen-yaml.css src/wen-component.css src/wen-mermaid.css src/wen-chart.css > dist/wen-full.css
npx clean-css-cli -o dist/wen-full.min.css dist/wen-full.css

# 3. Create a temporary JS entry point
echo "export { WenEditor } from './src/wen-core.js';" > wen-entry.js
echo "export { WenYamlView } from './src/wen-yaml.js';" >> wen-entry.js
echo "export { WenComponentView } from './src/wen-component.js';" >> wen-entry.js
echo "export { WenMermaidView } from './src/wen-mermaid.js';" >> wen-entry.js
echo "export { WenChartView } from './src/wen-chart.js';" >> wen-entry.js

# 4. Bundle and Minify JS (keeping the esm.sh CDN imports external)
echo "Bundling and Minifying JS..."
npx esbuild wen-entry.js --bundle --format=esm --external:https://* --outfile=dist/wen-full.js
npx esbuild wen-entry.js --bundle --format=esm --external:https://* --minify --outfile=dist/wen-full.min.js

# 5. Cleanup the temporary entry file
rm wen-entry.js

echo "✨ Build complete! Output saved to /dist."
