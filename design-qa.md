# Design QA — Chrome MCP Bridge Desktop

**Findings**

- The first desktop pass missed the reference composition: its shell filled the viewport, the sidebar sat flush to the edge, and the banner and runtime panel landed too high. The layout now has a 24 px outer inset, a separate 238 px sidebar, an inset glass workspace, and reference-aligned topbar/banner spacing.
- The supplied side-by-side comparison showed the previous foreground was too small and too far right, the cards lacked their reference illustrations, and the 1739 × 803 preview viewport clipped the runtime panel. The latest iteration uses a larger left-shifted character cutout, generated card/empty-state illustrations, a more detailed cherry-blossom room wallpaper, and a short-window runtime layout.
- [Blocked] A fresh rendered capture could not be obtained. The in-app browser explicitly denied access under an admin-enforced policy, so visual validation cannot be confirmed from a screenshot.

**Source visual**

- User reference: `C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-c5523cf3-326b-4898-b8f8-d3efaeb7dba3.png`
- Source dimensions: 1680 × 940 px.
- Latest supplied implementation capture: `C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-3075f95e-b770-4392-b9ae-cfe5c89134e6.png` at 1739 × 803 px.

**Implementation**

- Preview: `http://127.0.0.1:1420/`
- Intended viewport: 1680 × 940 CSS px at device scale factor 1.
- Latest post-fix screenshot: unavailable; the user-provided implementation capture predates the current changes and the browser capture remains denied by policy.
- State: default desktop overview; live service state could not be visually confirmed.

**Comparison**

- Full-view comparison: the supplied side-by-side capture was reviewed. Its preview is 1739 × 803 px versus the 1680 × 940 px reference, so the lower runtime area is also affected by the shorter viewport.
- Focused regions: the latest code corrects the person scale/position, card decoration, background richness, and short-window runtime height; these corrections have not yet been confirmed in a fresh capture.
- Typography, final image crop, and live status state: pending post-fix visual comparison.
- Comparison history: structural layout and visual-layer iterations were made from the supplied comparison; another screenshot-based iteration is blocked.

**Implementation checklist**

- [x] Add generated wallpaper, transparent foreground art, cropped dashboard motifs, and PNG icon assets under `app/desktop-client/public/assets/`.
- [x] Replace Lucide icons with the local raster icon component.
- [x] Run Vue type checking and the desktop Vite production build.
- [ ] Capture the rendered UI at 1680 × 940 and compare it with the reference once browser preview access is available.
- [ ] Verify final image crop and fix remaining differences after that comparison.

**Open blocker**

- CUA returned an admin-enforced security policy denial for the in-app browser. Do not bypass the block with another browser-control route.

final result: blocked
