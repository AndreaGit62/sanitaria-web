// Run after changing public/brand/visilab.svg. Uses the Sharp bundled with Next.js.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const sharp = nextRequire('sharp');
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/brand/visilab.svg', root));
await mkdir(new URL('public/icons/', root), { recursive: true });
for (const [path, size] of [['app/apple-icon.png',180], ['public/icons/visilab-192.png',192], ['public/icons/visilab-512.png',512]]) {
  await sharp(source).resize(size,size).removeAlpha().png().toFile(fileURLToPath(new URL(path,root)));
}

// ICO directory with PNG images: small browser tabs and higher-density displays.
const sizes=[16,32,48,64];
const images=await Promise.all(sizes.map(size=>sharp(source).resize(size,size).ensureAlpha(1).png().toBuffer()));
const directory=Buffer.alloc(6+16*sizes.length);
directory.writeUInt16LE(1,2);
directory.writeUInt16LE(sizes.length,4);
let offset=directory.length;
for(let i=0;i<sizes.length;i++){
  const entry=6+16*i;
  directory[entry]=sizes[i];directory[entry+1]=sizes[i];
  directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);
  directory.writeUInt32LE(images[i].length,entry+8);directory.writeUInt32LE(offset,entry+12);
  offset+=images[i].length;
}
await writeFile(new URL('app/favicon.ico',root),Buffer.concat([directory,...images]));
console.log('VisiLab: favicon ICO, icona iPhone 180 px, icone app 192 e 512 px generate.');
