# AeroNotes — Frontend Implementation

A pixel-faithful, fully functional recreation of the AeroNotes Figma design
(Frutiger Aero style note-taking app), built with plain HTML, CSS and
JavaScript — no build step, no dependencies.

## How to run

Just open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
Everything — navigation, drawing, saving — works entirely client-side.

If your browser restricts local canvas/localStorage access under the
`file://` protocol, run a tiny static server instead, e.g.:

```bash
cd aeronotes
python3 -m http.server 8080
# then open http://localhost:8080
```

## How it's built

Each of the 8 screens (Welcome, Login, Main, Notes, Folder, Settings, User,
Note editor) uses the **original exported design screenshot as its exact
background image**, guaranteeing pixel-perfect visual fidelity to the
Figma file. On top of each screenshot, real, fully interactive HTML
controls (`<button>`, `<input>`, `<select>`, `<canvas>`) are positioned
with absolute CSS percentages so they sit exactly on top of the design's
buttons, fields and placeholders. Most controls are visually transparent
so the original artwork always shows through; a few (dropdowns, the path
display) have a light opaque fill so their live value doesn't visually
double up with the baked-in placeholder text from the screenshot.

```
aeronotes/
├── index.html          all 8 screens, markup only
├── css/style.css        stage/letterboxing, per-screen hotspot positions
├── js/app.js             navigation state machine, localStorage model,
│                         canvas drawing engine
└── assets/screens/*.jpg  the 8 original design screenshots (backgrounds)
```

### Navigation

A single-page app: every screen is a `<section class="screen">` absolutely
stacked in `#stage`; `showScreen(id)` toggles which one is visible. Flow
matches the design exactly:

```
Welcome --Let's Start--> Login --Log in--> Main
Main --Notes--> Notes list --+--> Note editor --Back(saves)--> Notes list
Main --Folders--> Folder page --double-click a folder--> Notes list (scoped)
Main --Settings--> Settings (General / Saving tabs)
Main --User--> User profile (--Log out--> Login)
```

### Data model (`localStorage`, key `aeronotes_db_v1`)

```js
{
  user:     { firstName, lastName, age, gender, gmail },
  settings: { language, startup, autosave, autosaveInterval, path },
  notes:    [{ id, title, folderId, dataURL, createdAt, updatedAt }],
  folders:  [{ id, name, createdAt }],
  loggedIn: boolean
}
```

A note's `dataURL` is a PNG snapshot of its canvas — it doubles as both
the thumbnail shown in the notes list and the full editable drawing
(reloaded onto the canvas when the note is reopened).

### Note editor / drawing engine

Real `<canvas>` with pointer-event drawing. Five tools, each with its own
default color/size/opacity, selectable via a small color+size popover:

- **Pencil** — thin, opaque
- **Pen** — medium, opaque
- **Marker** — bold, opaque
- **Highlighter** — broad, translucent, `multiply` blend. Painted onto an
  offscreen buffer canvas and composited once per stroke so overlapping
  translucent segments never produce dark double-blended seams.
- **Eraser** — `destination-out` composite

Undo/redo keeps a capped stack of full-canvas PNG snapshots taken before
each stroke. Image insert reads a local file and draws it centered and
scaled to fit; text insert prompts for a string and stamps it at the
canvas center; Print opens the canvas as an image in a new tab and calls
`window.print()`.

### Known simplification

The Folder page's own background art has "Notes page" baked into its
label in the original design — folders are implemented as a lightweight
hub (create/delete/preview) that opens into the same Notes-list screen,
scoped to that folder, which matches the design's reused visual language.
