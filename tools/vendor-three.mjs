// DOORBUSTER tool — vendor-three.mjs
// Builds lib/three.min.js: the official three@0.185.1 CommonJS build (MIT, from the npm registry)
// wrapped so that, like the Mindblown-hosted bundle, it defines the global THREE from a classic script.
// Run: node tools/vendor-three.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('node_modules/three/build/three.cjs', 'utf8');
const banner = '/* three.js r185 (three@0.185.1, MIT license, https://threejs.org) — official CommonJS build,\n' +
  '   wrapped to define the global THREE for offline work. On Mindblown the platform-hosted\n' +
  '   https://mindblown.ai/lib/three-0.185.1/three.min.js is loaded instead (see index.html). */\n';
const out = banner + '(function () {\nvar exports = {};\n' + src +
  '\n(typeof window !== "undefined" ? window : globalThis).THREE = exports;\n})();\n';
mkdirSync('lib', { recursive: true });
writeFileSync('lib/three.min.js', out);

const box = { console };
box.globalThis = box;
vm.runInNewContext(out, box);
if (!box.THREE || box.THREE.REVISION !== '185' || typeof box.THREE.WebGLRenderer !== 'function') {
  throw new Error('vendored three.js failed its self-check');
}
console.log('lib/three.min.js written:', (out.length / 1024 | 0) + ' KB, REVISION ' + box.THREE.REVISION);
