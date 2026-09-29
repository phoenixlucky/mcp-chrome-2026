# Desktop assets

All desktop client images and icons belong under this directory so Vite and Tauri package them together.

- `backgrounds/`: large page and panel backgrounds.
- `brand/`: product marks and logos.
- `icons/`: cropped transparent PNG icons used by `src/components/AssetIcon.vue`.
- `icons/source/`: original generated icon sheets retained as editable source.
- `illustrations/`: banners, empty-state art, and other illustrations.

Add raster icons to `icons/` and register their names in `AssetIcon.vue`. Keep icons and illustrations out of source-code drawings and inline SVG.

The overview uses `backgrounds/desktop-blossom-room-v2.webp` as its full-window and banner background, `illustrations/dashboard-catgirl-foreground-v2.webp` as the transparent foreground character, and the cropped files in `illustrations/dashboard-motifs/` for card and empty-state decoration.
