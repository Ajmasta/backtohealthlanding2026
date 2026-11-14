#!/bin/sh
# Makes the movement-test pictures and demo video of the home page from the app's own media
# (assets/movement/flexion: 0.png … 9.png and demo.mp4), drawn as flat illustrations in the brand's colours.
# Needs ffmpeg, cwebp and Python with numpy and Pillow.
# Run: npm run evaluation -- /path/to/app/assets/movement/flexion
set -e
src="$1"; here="$(cd "$(dirname "$0")" && pwd)"; out="$here/../src/assets/evaluation"; tmp="$(mktemp -d)"
[ -f "$src/demo.mp4" ] || { echo "Not found: $src/demo.mp4. Pass the app's assets/movement/flexion folder."; exit 1; }
mkdir -p "$out" "$tmp/in" "$tmp/out"
for i in 0 1 2 3 4 5 6 7 8 9; do
  python3 -I "$here/stylize-evaluation.py" "$src/$i.png" "$tmp/$i.png"
  cwebp -quiet -q 82 "$tmp/$i.png" -o "$out/flexion-$i.webp"
done
ffmpeg -loglevel error -y -i "$src/demo.mp4" -vf fps=12 "$tmp/in/%04d.png"
args=""; for f in "$tmp"/in/*.png; do args="$args $f $tmp/out/$(basename "$f")"; done
python3 -I "$here/stylize-evaluation.py" $args
ffmpeg -loglevel error -y -framerate 12 -i "$tmp/out/%04d.png" -an -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart "$out/flexion-demo.mp4"
rm -rf "$tmp"
echo "Made the movement test media in $out"
