import fs from 'node:fs'
const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8')
const src = read('src/client.src.js')
const whale = read('src/whale.core.js').split('\n').map(l => '  ' + l).join('\n')
const fish = read('src/fish.txt').trim()
const body = src
  .replace('__WHALE__', () => whale)
  .replace('"__FISH__"', () => JSON.stringify(fish))
  .replace('__FONTS__', () => JSON.stringify(read('src/fonts.css')))
  .replace('__ICONS__', () => read('src/icons.json').trim())
  .replace('__SIG__', () => read('src/sig.json').trim())
  .replace('__PARTS__', () => JSON.stringify(read('src/parts.css')))
  .replace('__SKIN__', () => JSON.stringify(read('src/skin.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*/g, '\n')))
const out = `window.__ModuleLoader__.load({
\tid: "dsh-jules-atelier",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
\t\texports.apply = apply;
\t\texports.inject = inject;
\t\texports.name = name;
\t\treturn module.exports;
\t}
});
`
fs.writeFileSync(new URL('lib/client.js', import.meta.url), out)
console.log('client.js', out.length)
