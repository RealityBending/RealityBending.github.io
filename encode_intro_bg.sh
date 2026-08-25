#!/usr/bin/env bash
# encode_intro_bg.sh
#
# Turns img/Intro.mp4 (1920x1080, ~54 MB, ~54 Mbps — a near-lossless editor
# export) into a web-weight background loop for the People section.
#
# The output is only ever shown heavily dimmed and masked, so it can be encoded
# far more aggressively than a foreground video: compression artefacts are not
# visible at that opacity.
#
# Requires ffmpeg:  winget install Gyan.FFmpeg   (or: choco install ffmpeg)
#
# Usage:  ./encode_intro_bg.sh [source]

set -euo pipefail

SRC="${1:-img/Intro.mp4}"
OUT_BASE="img/intro-bg"

# 1280 is plenty for a backdrop — it is scaled to the section width and then
# dimmed to ~13%. -2 keeps the height even, which H.264 requires.
WIDTH=1280

# Higher CRF = smaller file. 30/36 are deliberately past what you would accept
# for a foreground video.
H264_CRF=30
# VP9's CRF scale is not x264's — 36 here is *higher* quality than x264 at 30
# and produced a larger file, which defeats the point of offering WebM at all.
# 48 lands it below the mp4. Keep them compared whenever these are retuned.
VP9_CRF=48

# Frame the poster comes from. Also what shows under prefers-reduced-motion,
# so pick something representative.
POSTER_AT=1

# ffmpeg on PATH if it is there, otherwise the binary that ships inside the
# Python imageio-ffmpeg package — which is already installed on this machine,
# so nothing extra is needed.
if command -v ffmpeg >/dev/null 2>&1; then
    FFMPEG=ffmpeg
else
    FFMPEG="$(python -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || true)"
fi

if [ -z "${FFMPEG:-}" ] || { [ "$FFMPEG" != "ffmpeg" ] && [ ! -f "$FFMPEG" ]; }; then
    echo "No ffmpeg found." >&2
    echo "Either:  winget install Gyan.FFmpeg" >&2
    echo "    or:  pip install imageio-ffmpeg" >&2
    exit 1
fi

if [ ! -f "$SRC" ]; then
    echo "Source not found: $SRC" >&2
    exit 1
fi

echo "ffmpeg: $FFMPEG"
echo "Source: $SRC"
echo

# A silent audio track, NOT the source's. Chrome power-saves media it considers
# "video-only" and pauses it mid-playback — the console says so in as many
# words. Carrying a near-empty track sidesteps that classification for a few KB.
# The source audio is still discarded: only -map 1:a is kept.
SILENCE=(-f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=48000")

# ── H.264 baseline for every browser ──────────────────────────────────────
# +faststart moves the index ahead of the frames so playback can begin on the
#            first chunk instead of the last — the original has it at the end,
#            which is why it stalls for the whole download.
echo "→ ${OUT_BASE}.mp4"
"$FFMPEG" -y -loglevel error -stats -i "$SRC" "${SILENCE[@]}" \
    -map 0:v -map 1:a -shortest \
    -vf "scale=${WIDTH}:-2" \
    -c:v libx264 -crf "$H264_CRF" -preset slow \
    -profile:v high -pix_fmt yuv420p \
    -c:a aac -b:a 8k \
    -movflags +faststart \
    "${OUT_BASE}.mp4"

# ── VP9 for browsers that take it (typically 25-35% smaller) ──────────────
echo "→ ${OUT_BASE}.webm"
"$FFMPEG" -y -loglevel error -stats -i "$SRC" "${SILENCE[@]}" \
    -map 0:v -map 1:a -shortest \
    -vf "scale=${WIDTH}:-2" \
    -c:v libvpx-vp9 -crf "$VP9_CRF" -b:v 0 -row-mt 1 -deadline good -cpu-used 2 \
    -c:a libopus -b:a 8k \
    "${OUT_BASE}.webm"

# ── Poster: first paint, and the still shown under reduced motion ─────────
echo "→ ${OUT_BASE}.jpg"
"$FFMPEG" -y -loglevel error -ss "$POSTER_AT" -i "$SRC" \
    -vf "scale=${WIDTH}:-2" -frames:v 1 -q:v 6 \
    "${OUT_BASE}.jpg"

echo
echo "Done:"
ls -lh "$SRC" "${OUT_BASE}.mp4" "${OUT_BASE}.webm" "${OUT_BASE}.jpg" | awk '{print "  " $5 "\t" $9}'
echo
echo "Expect ~1-3 MB for the mp4. If it is much larger, raise H264_CRF."
