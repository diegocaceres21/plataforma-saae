Place your application icon assets here.

Required (recommended) files:
- icon.png (at least 512x512)
- icon.ico (Windows, multi-size 256/128/64/48/32/16)
- icon.icns (macOS, if mac target added later)

You can generate .ico from .png using an online converter or ImageMagick.
Example ImageMagick command (PowerShell): magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
