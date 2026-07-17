import { readdirSync, statSync, cpSync } from 'fs';
import { join } from 'path';

const dir = join('.output');
const zips = readdirSync(dir)
  .filter(x => x.endsWith('.zip'))
  .map(f => ({ name: f, time: statSync(join(dir, f)).mtime }))
  .sort((a, b) => b.time - a.time);

if (zips[0]) {
  cpSync(join(dir, zips[0].name), join('..', '..', 'releases', zips[0].name), { force: true });
  console.log('📦 Released: releases/' + zips[0].name);
}
