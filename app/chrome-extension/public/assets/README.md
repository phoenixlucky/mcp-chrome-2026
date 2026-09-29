# Extension assets

Popup illustrations, backgrounds, and hand-drawn raster icons belong here, grouped by use:

- `backgrounds/` — popup wallpapers and page backgrounds.
- `icons/` — transparent PNG glyphs used through `entrypoints/popup/components/PopupIcon.vue`.
- `illustrations/` — standalone decorative artwork.
- `brand/` — product marks and other brand imagery.

For new popup UI icons, draw them with image generation as a transparent raster sprite sheet, crop each glyph into `icons/`, then expose its typed name through `PopupIcon.vue`. Check the alpha channel before shipping so transparency patterns are not baked into the artwork. Do not replace these assets with SVGs or generic icon packages. Keep assets local to the extension package so WXT includes them in the extension build.
