// Makes the 3D exercise videos and stills of the home page from the 3D delivery (animations-completes/).
// The renders are square wide shots; each is cropped to 4:3 around the figure so it fills its card.
// Needs ffmpeg and cwebp. Run: npm run exercises -- /path/to/livraison-exercices-3d

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOWCASE } from '../site.config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const delivery = resolve(process.argv[2] ?? '');
const out = join(root, 'src/assets/exercises');
mkdirSync(out, { recursive: true });

// Crop windows in the 640 × 640 render (width:height:x:y), measured on the figures:
// lying, the figure sits between 34% and 73% of the height; standing, between 12% and 85%.
const CROP = { floor: '548:411:46:140', standing: '640:480:0:64' };

for (const { code, shot } of SHOWCASE) {
  const source = join(delivery, 'animations-completes', code, 'realistic');
  if (!existsSync(join(source, 'animation.mp4'))) throw new Error(`Not found: ${source}/animation.mp4. Pass the 3D delivery folder.`);
  const filter = `crop=${CROP[shot]},scale=480:360`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(source, 'animation.mp4'), '-an', '-vf', filter, '-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(out, `${code}.mp4`)]);
  // The still is the video's first frame, so the picture does not jump when the video starts.
  const still = join(out, `${code}.png`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(out, `${code}.mp4`), '-frames:v', '1', still]);
  execFileSync('cwebp', ['-quiet', '-q', '80', still, '-o', join(out, `${code}.webp`)]);
  execFileSync('rm', [still]);
}
console.log(`Made ${SHOWCASE.length} exercises in ${out}`);
