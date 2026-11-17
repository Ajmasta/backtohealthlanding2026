#!/bin/sh
# Makes the movement-test pictures and demo video of the home page from the app's own media
# (assets/movement/flexion: 0.png … 9.png and demo.mp4): the same photos as in the app, only resized.
# The demo is sped up 2.5 times in the file itself (16 s become 6), with a keyframe every half second.
# Needs ffmpeg and cwebp.
# Run: npm run evaluation -- /path/to/app/assets/movement/flexion
set -e
src="$1"; here="$(cd "$(dirname "$0")" && pwd)"; out="$here/../src/assets/evaluation"
[ -f "$src/demo.mp4" ] || { echo "Not found: $src/demo.mp4. Pass the app's assets/movement/flexion folder."; exit 1; }
mkdir -p "$out"
for i in 0 1 2 3 4 5 6 7 8 9; do
  cwebp -quiet -q 84 -resize 640 0 "$src/$i.png" -o "$out/flexion-$i.webp"
done
ffmpeg -loglevel error -y -i "$src/demo.mp4" -an -vf "setpts=PTS/2.5,fps=30,scale=640:576:flags=lanczos" -c:v libx264 -crf 23 -preset slow -profile:v main -bf 0 -g 15 -pix_fmt yuv420p -movflags +faststart "$out/flexion-demo.mp4"
echo "Made the movement test media in $out"
