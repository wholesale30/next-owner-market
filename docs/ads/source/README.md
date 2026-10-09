# "What's it worth?" reel (Oct 9, 2026)

- `ad.html` is the whole 26-second video as one animated page. `render(t)` draws second `t`.
- To change a photo, replace the file in `img/` with the same name. To change words, edit the text in `ad.html`. To change the oscilloscope prices, edit `$80–$200` / `$240–$480` and the numbers in `render()`.
- **Rebuild:**
  1. In a folder with this source, run `npm i playwright-core@1.56 @fontsource/inter`.
  2. Run `CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node shoot.mjs full frames` (780 frames, about 1 minute).
  3. Run `ffmpeg -framerate 30 -i frames/f%04d.jpg -f lavfi -i anullsrc=r=44100:cl=stereo -shortest -c:v libx264 -pix_fmt yuv420p -crf 19 -movflags +faststart -c:a aac out.mp4`.
- `values.json` holds the real AI appraisals used in the video (Hitachi V-212 lot $80–200 as-is, $240–480 tested; lamps $40–100 / $100–225; RC plane $50–120 / $130–250).
- Cost: $0. The AI appraisals cost about 6¢.
