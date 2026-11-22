#!/usr/bin/env bash
# Turns the About section's life video into a fast, adaptive web stream.
#
#   scripts/prepare-life-video.sh path/to/life.mov [poster-second] [--mp4]
#
# Writes public/media/life/:
#   master.m3u8 + 360p / 540p / 720p streams (4 s segments; the player picks
#   the one the visitor's connection and screen can handle, and only fetches
#   what's actually watched), poster.jpg (frame at poster-second, default 3),
#   and with --mp4 a single 540p life.mp4 fallback.
# Then set lifeVideo.status to "ready" in content/media.ts (and `mp4` /
# `captions` if you made them). Captions: save as public/media/life/captions.vtt.
set -euo pipefail

src=${1:?usage: prepare-life-video.sh <video> [poster-second] [--mp4]}
at=3
mp4=0
for a in "${@:2}"; do
  case $a in
    --mp4) mp4=1 ;;
    *) at=$a ;;
  esac
done
out="$(cd "$(dirname "$0")/.." && pwd)/public/media/life"
rm -rf "$out"
mkdir -p "$out"

# keyframes exactly every 4 s, so every rendition can switch at any segment
kf='expr:gte(t,n_forced*4)'
x264=(-c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -sc_threshold 0 -force_key_frames "$kf")

ffmpeg -hide_banner -loglevel warning -stats -y -i "$src" \
  -filter_complex "[0:v]fps=30,split=3[a][b][c];[a]scale=-2:360[v0];[b]scale=-2:540[v1];[c]scale=-2:720[v2]" \
  -map "[v0]" -map 0:a:0? -map "[v1]" -map 0:a:0? -map "[v2]" -map 0:a:0? \
  "${x264[@]}" \
  -b:v:0 600k  -maxrate:v:0 700k  -bufsize:v:0 1200k \
  -b:v:1 1200k -maxrate:v:1 1400k -bufsize:v:1 2400k \
  -b:v:2 2200k -maxrate:v:2 2600k -bufsize:v:2 4400k \
  -c:a aac -b:a 96k -ac 2 \
  -f hls -hls_time 4 -hls_playlist_type vod -hls_flags independent_segments \
  -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename "$out/%v/seg-%03d.m4s" \
  -master_pl_name master.m3u8 \
  -var_stream_map "$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$src" | grep -q . \
      && echo 'v:0,a:0,name:360 v:1,a:1,name:540 v:2,a:2,name:720' \
      || echo 'v:0,name:360 v:1,name:540 v:2,name:720')" \
  "$out/%v/index.m3u8"

ffmpeg -hide_banner -loglevel error -y -ss "$at" -i "$src" -frames:v 1 \
  -vf "scale=1280:-2" -q:v 4 "$out/poster.jpg"

if [ "$mp4" = 1 ]; then
  ffmpeg -hide_banner -loglevel warning -stats -y -i "$src" \
    -vf "fps=30,scale=-2:540" "${x264[@]}" -crf 26 -maxrate 1400k -bufsize 2800k \
    -c:a aac -b:a 96k -ac 2 -movflags +faststart "$out/life.mp4"
fi

du -sh "$out"
echo "Done. Now set lifeVideo.status = \"ready\" in content/media.ts."
