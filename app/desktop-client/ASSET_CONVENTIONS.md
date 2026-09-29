# Desktop asset conventions

- Keep all user-facing desktop illustrations, backgrounds, logos, and icon images under `public/assets/`, sorted into matching subfolders.
- UI icons are raster files from the local icon library in `public/assets/icons/`; do not add SVG icon components or CSS/HTML icon drawings.
- Register new icon names in `src/components/AssetIcon.vue`. Generate and crop each icon to an individual transparent PNG; optimize large background illustrations to WebP when practical.
- For layered scenes, keep the wallpaper in `backgrounds/`, the banner art in `illustrations/`, and each transparent foreground subject as its own file in `illustrations/`. Position layers in the interface so the foreground can cross panel boundaries without covering interactive controls.
- Preserve existing Vue controls and service behavior when restyling screens.
