#!/bin/sh
# Makes the movement-test pictures and demo video of the home page from the app's own media
# (assets/movement/flexion: 0.png … 9.png and demo.mp4): the real person, cut out and set on a clean
# studio backdrop in the brand's colours, with a contact shadow.
# The demo is sped up 2.5 times in the file itself (16 s become 6), with a keyframe every half second.
# Needs a Mac (the cut-out uses the system's subject lifting, through swiftc), ffmpeg, cwebp,
# and Python with numpy and Pillow. About a minute.
# Run: npm run evaluation -- /path/to/app/assets/movement/flexion
set -e
src="$1"; here="$(cd "$(dirname "$0")" && pwd)"; out="$here/../src/assets/evaluation"; tmp="$(mktemp -d)"
[ -f "$src/demo.mp4" ] || { echo "Not found: $src/demo.mp4. Pass the app's assets/movement/flexion folder."; exit 1; }
mkdir -p "$out" "$tmp/in" "$tmp/mask" "$tmp/out"
swiftc -O "$here/cutout-person.swift" -o "$tmp/cutout"
for i in 0 1 2 3 4 5 6 7 8 9; do cp "$src/$i.png" "$tmp/in/s$i.png"; done
ffmpeg -loglevel error -y -i "$src/demo.mp4" -vf "setpts=PTS/2.5,fps=30" "$tmp/in/v%04d.png"
cut=""; mix=""
for f in "$tmp"/in/*.png; do
  n="$(basename "$f")"; cut="$cut $f $tmp/mask/$n"; mix="$mix $f $tmp/mask/$n $tmp/out/$n"
done
"$tmp/cutout" $cut
python3 -I "$here/studio-evaluation.py" $mix
for i in 0 1 2 3 4 5 6 7 8 9; do cwebp -quiet -q 86 "$tmp/out/s$i.png" -o "$out/flexion-$i.webp"; done
ffmpeg -loglevel error -y -framerate 30 -i "$tmp/out/v%04d.png" -an -c:v libx264 -crf 21 -preset slow -profile:v main -bf 0 -g 15 -pix_fmt yuv420p -movflags +faststart "$out/flexion-demo.mp4"
rm -rf "$tmp"
echo "Made the movement test media in $out"
