(() => {
  'use strict';

  const DB_KEY = 'aeronotes_db_v1';

  function defaultDB() {
    return {
      user: { firstName: '', lastName: '', age: '', gender: '', gmail: '' },
      settings: {
        language: 'English',
        startup: 'Home',
        autosave: true,
        autosaveInterval: 'instant',
        path: 'C:\\AeroNotes\\SavedNotes'
      },
      notes: [],
      folders: [],
      loggedIn: false
    };
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return defaultDB();
      const parsed = JSON.parse(raw);

      const d = defaultDB();
      return {
        user: Object.assign(d.user, parsed.user),
        settings: Object.assign(d.settings, parsed.settings),
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        folders: Array.isArray(parsed.folders) ? parsed.folders : [],
        loggedIn: !!parsed.loggedIn
      };
    } catch (e) {
      console.warn('Could not read AeroNotes data, starting fresh.', e);
      return defaultDB();
    }
  }

  let db = loadDB();
  function persist() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch (e) { console.warn('Could not save AeroNotes data', e); }
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1600);
  }

  const pickerEl = document.getElementById('picker');
  const pickerList = document.getElementById('picker-list');
  const pickerOk = document.getElementById('picker-ok');
  let pickerDone = null;
  let pickerSelected = new Set();

  function openPicker({ title, items, multi, okLabel, emptyText, onOk }) {
    document.getElementById('picker-title').textContent = title;
    pickerList.innerHTML = '';
    pickerList.classList.toggle('picker-list--rows', !multi);
    pickerSelected = new Set();
    pickerDone = onOk;
    pickerOk.hidden = !multi;
    pickerOk.textContent = okLabel || 'Add';

    if (items.length === 0) {
      const e = document.createElement('div');
      e.className = 'picker-empty';
      e.textContent = emptyText || 'Nothing to show.';
      pickerList.appendChild(e);
    }
    items.forEach(item => {
      const b = document.createElement('button');
      b.className = 'picker-item';
      if (multi) {
        const img = document.createElement('div');
        img.className = 'pi-img';
        if (item.img) img.style.backgroundImage = `url("${item.img}")`;
        b.appendChild(img);
      }
      const label = document.createElement('div');
      label.className = 'pi-label';
      label.textContent = item.label;
      b.appendChild(label);
      if (item.sub) {
        const sub = document.createElement('div');
        sub.className = 'pi-sub';
        sub.textContent = item.sub;
        b.appendChild(sub);
      }
      b.addEventListener('click', () => {
        if (!multi) { closePicker(); onOk([item.id]); return; }
        if (pickerSelected.has(item.id)) pickerSelected.delete(item.id);
        else pickerSelected.add(item.id);
        b.classList.toggle('selected');
        pickerOk.textContent = `${okLabel || 'Add'} (${pickerSelected.size})`;
      });
      pickerList.appendChild(b);
    });
    pickerEl.hidden = false;
  }
  function closePicker() { pickerEl.hidden = true; pickerDone = null; }
  document.getElementById('picker-cancel').addEventListener('click', closePicker);
  pickerOk.addEventListener('click', () => {
    const done = pickerDone, ids = [...pickerSelected];
    closePicker();
    if (done && ids.length) done(ids);
  });

  function folderName(id) {
    const f = db.folders.find(x => x.id === id);
    return f ? f.name : null;
  }
  function chooseFolderForNote(currentFolderId, onChosen) {
    const items = db.folders.map(f => ({
      id: f.id,
      label: '\u{1F4C1} ' + f.name,
      sub: f.id === currentFolderId ? 'current folder' : ''
    }));
    items.push({ id: '__none__', label: '✖ Not in a folder', sub: currentFolderId ? '' : 'current' });
    items.push({ id: '__new__', label: '➕ New folder…' });
    openPicker({
      title: 'Move this note to…',
      items, multi: false,
      onOk: ([id]) => {
        if (id === '__none__') return onChosen(null);
        if (id === '__new__') {
          const name = prompt('Name this folder:', 'New Folder');
          if (!name || !name.trim()) return;
          const f = { id: uid(), name: name.trim(), createdAt: Date.now() };
          db.folders.push(f);
          persist();
          return onChosen(f.id);
        }
        onChosen(id);
      }
    });
  }

  const screens = {};
  document.querySelectorAll('.screen').forEach(el => {
    screens[el.id] = el;
    const bg = el.getAttribute('data-bg');
    if (bg) el.style.backgroundImage = `url("${bg}")`;
  });

  let current = null;
  function showScreen(id) {
    if (current) screens[current].classList.remove('active');
    screens[id].classList.add('active');
    current = id;
  }

  document.getElementById('btn-start').addEventListener('click', () => {
    showScreen('screen-login');
    document.getElementById('input-login-email').value = db.user.gmail || '';
    document.getElementById('login-hint').textContent = '';
  });

  document.getElementById('btn-login-back').addEventListener('click', () => showScreen('screen-welcome'));

  function afterLogin() {
    db.loggedIn = true;
    persist();
    switch (db.settings.startup) {
      case 'Notes':   openNotesList(null); break;
      case 'Folders': showScreen('screen-folder'); renderFolders(); break;
      default:        showScreen('screen-main');
    }
  }

  document.getElementById('btn-login-submit').addEventListener('click', () => {
    const email = document.getElementById('input-login-email').value.trim();
    const pass = document.getElementById('input-login-password').value;
    const hint = document.getElementById('login-hint');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      hint.textContent = 'Please enter a valid Gmail address.';
      return;
    }
    if (!pass || pass.length < 4) {
      hint.textContent = 'Password must be at least 4 characters.';
      return;
    }
    hint.textContent = '';
    if (!db.user.gmail) db.user.gmail = email;
    afterLogin();
  });

  document.getElementById('btn-main-user').addEventListener('click', () => {
    fillUserForm();
    showScreen('screen-user');
  });
  document.getElementById('btn-main-settings').addEventListener('click', () => {
    fillSettingsForm();
    showScreen('screen-settings');
  });
  document.getElementById('btn-main-notes').addEventListener('click', () => openNotesList(null));
  document.getElementById('btn-main-folders').addEventListener('click', () => {
    showScreen('screen-folder');
    renderFolders();
  });

  let notesReturnTarget = 'screen-main';
  let notesFolderScope = null;

  function openNotesList(folderId, returnTo) {
    notesFolderScope = folderId || null;
    notesReturnTarget = returnTo || 'screen-main';
    const ctx = document.getElementById('notes-folder-context');
    if (folderId) {
      const f = db.folders.find(x => x.id === folderId);
      ctx.textContent = f ? `Folder: ${f.name}` : '';
      ctx.hidden = false;
    } else {
      ctx.hidden = true;
    }

    document.getElementById('btn-notes-import').hidden = !folderId;
    renderNotesList();
    showScreen('screen-notes');
  }

  function notesInScope() {

    const folderIds = new Set(db.folders.map(f => f.id));
    return db.notes
      .filter(n => notesFolderScope
        ? n.folderId === notesFolderScope
        : !(n.folderId && folderIds.has(n.folderId)))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function renderNotesList() {
    const strip = document.getElementById('notes-thumb-strip');
    strip.innerHTML = '';
    const list = notesInScope();
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'thumb-empty-msg';
      empty.textContent = 'No notes yet — tap the + bubble to create one.';
      strip.appendChild(empty);
      return;
    }
    list.forEach((note, idx) => {
      const t = document.createElement('div');
      t.className = 'thumb';
      if (note.dataURL) t.style.backgroundImage = `url("${note.dataURL}")`;
      const del = document.createElement('button');
      del.className = 'thumb-del';
      del.textContent = '\u00d7';
      del.title = 'Delete note';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${note.title || 'Untitled note'}"?`)) {
          db.notes = db.notes.filter(n => n.id !== note.id);
          persist();
          renderNotesList();
        }
      });
      const label = document.createElement('div');
      label.className = 'thumb-label';
      label.textContent = note.title || `Page ${idx + 1}`;

      const move = document.createElement('button');
      move.className = 'thumb-move';
      move.textContent = '\u{1F4C1}';
      move.title = 'Move to folder';
      move.addEventListener('click', (e) => {
        e.stopPropagation();
        chooseFolderForNote(note.folderId, (newFolderId) => {
          note.folderId = newFolderId;
          note.updatedAt = Date.now();
          persist();
          renderNotesList();
          toast(newFolderId ? `Moved to "${folderName(newFolderId)}"` : 'Removed from folder');
        });
      });
      t.appendChild(move);
      t.appendChild(del);
      t.appendChild(label);
      t.addEventListener('click', () => openEditor(note.id));
      strip.appendChild(t);
    });
  }

  document.getElementById('btn-notes-import').addEventListener('click', () => {
    const targetId = notesFolderScope;
    if (!targetId) return;
    const candidates = db.notes
      .filter(n => n.folderId !== targetId)

      .sort((a, b) => (!!folderName(a.folderId)) - (!!folderName(b.folderId)) || a.createdAt - b.createdAt);
    openPicker({
      title: `Add old notes to "${folderName(targetId)}"`,
      items: candidates.map(n => ({
        id: n.id,
        label: n.title || 'Untitled note',
        sub: folderName(n.folderId) ? `in "${folderName(n.folderId)}" (will move)` : 'not in a folder',
        img: n.dataURL
      })),
      multi: true,
      okLabel: 'Add',
      emptyText: 'All your notes are already in this folder.',
      onOk: (ids) => {
        const now = Date.now();
        db.notes.forEach(n => {
          if (ids.includes(n.id)) { n.folderId = targetId; n.updatedAt = now; }
        });
        persist();
        renderNotesList();
        toast(`Added ${ids.length} note${ids.length > 1 ? 's' : ''}`);
      }
    });
  });

  document.getElementById('btn-notes-add').addEventListener('click', () => openEditor(null, notesFolderScope));
  document.getElementById('btn-notes-back').addEventListener('click', () => {
    if (notesReturnTarget === 'screen-folder') renderFolders();
    showScreen(notesReturnTarget);
  });

  let selectedFolderId = null;
  function renderFolders() {
    selectedFolderId = null;
    const strip = document.getElementById('folders-thumb-strip');
    strip.innerHTML = '';
    const preview = document.getElementById('folder-preview');

    if (db.folders.length === 0) {
      preview.innerHTML = '<div class="folder-preview-empty">No folders yet — tap the + bubble below to create one.</div>';
    } else {
      preview.innerHTML = '<div class="folder-preview-empty">Click a folder to preview it, click it again to open it.</div>';
    }

    db.folders.forEach(folder => {
      const t = document.createElement('div');
      t.className = 'thumb';
      const count = db.notes.filter(n => n.folderId === folder.id).length;
      const label = document.createElement('div');
      label.className = 'thumb-label';
      label.textContent = `${folder.name} (${count})`;
      t.appendChild(label);

      const del = document.createElement('button');
      del.className = 'thumb-del';
      del.textContent = '\u00d7';
      del.title = 'Delete folder';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete folder "${folder.name}"? Notes inside will become unfiled, not deleted.`)) {
          db.folders = db.folders.filter(f => f.id !== folder.id);
          db.notes.forEach(n => { if (n.folderId === folder.id) n.folderId = null; });
          persist();
          renderFolders();
        }
      });
      t.appendChild(del);

      t.addEventListener('click', () => {
        if (selectedFolderId === folder.id) {
          openNotesList(folder.id, 'screen-folder');
          return;
        }
        selectedFolderId = folder.id;
        strip.querySelectorAll('.thumb').forEach(x => x.classList.remove('selected'));
        t.classList.add('selected');
        showFolderPreview(folder.id);
      });
      strip.appendChild(t);
    });
  }

  function showFolderPreview(folderId) {
    const preview = document.getElementById('folder-preview');
    const folder = db.folders.find(f => f.id === folderId);
    const notes = db.notes
      .filter(n => n.folderId === folderId)
      .sort((a, b) => a.createdAt - b.createdAt);
    preview.innerHTML = '';
    if (!folder) return;
    if (notes.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'folder-preview-empty';
      msg.textContent = `"${folder.name}" is empty. Click the folder again to open it and add a page.`;
      preview.appendChild(msg);
      return;
    }
    notes.forEach((n, i) => {
      const d = document.createElement('div');
      d.className = 'fp-note';
      if (n.dataURL) d.style.backgroundImage = `url("${n.dataURL}")`;
      d.title = n.title || `Page ${i + 1}`;
      d.addEventListener('click', () => {

        notesFolderScope = folderId;
        notesReturnTarget = 'screen-folder';
        openEditor(n.id);
      });
      preview.appendChild(d);
    });
  }

  document.getElementById('btn-folder-add').addEventListener('click', () => {
    const name = prompt('Name this folder:', 'New Folder');
    if (name && name.trim()) {
      db.folders.push({ id: uid(), name: name.trim(), createdAt: Date.now() });
      persist();
      renderFolders();
    }
  });
  document.getElementById('btn-folder-back').addEventListener('click', () => showScreen('screen-main'));

  function fillSettingsForm() {
    document.getElementById('select-language').value = db.settings.language;
    document.getElementById('select-startup').value = db.settings.startup;
    document.getElementById('select-autosave-interval').value = db.settings.autosaveInterval;
    document.getElementById('path-display').textContent = db.settings.path;
    setToggle(document.getElementById('toggle-autosave'), db.settings.autosave);
  }
  function setToggle(btn, on) {
    btn.dataset.on = on ? '1' : '0';
    btn.style.background = on ? 'rgba(60,170,255,.001)' : 'rgba(255,255,255,0.001)';
  }

  document.getElementById('tab-general').addEventListener('click', () => {
    document.getElementById('pane-general').hidden = false;
    document.getElementById('pane-saving').hidden = true;
  });
  document.getElementById('tab-saving').addEventListener('click', () => {
    document.getElementById('pane-general').hidden = true;
    document.getElementById('pane-saving').hidden = false;
  });
  document.getElementById('select-language').addEventListener('change', e => { db.settings.language = e.target.value; persist(); });
  document.getElementById('select-startup').addEventListener('change', e => { db.settings.startup = e.target.value; persist(); });
  document.getElementById('select-autosave-interval').addEventListener('change', e => { db.settings.autosaveInterval = e.target.value; persist(); });
  document.getElementById('toggle-autosave').addEventListener('click', (e) => {
    const on = e.currentTarget.dataset.on === '1';
    db.settings.autosave = !on;
    setToggle(e.currentTarget, !on);
    persist();
    toast(`Auto Save turned ${!on ? 'on' : 'off'}`);
  });
  document.getElementById('btn-edit-path').addEventListener('click', () => {
    const p = prompt('Save path:', db.settings.path);
    if (p) { db.settings.path = p; document.getElementById('path-display').textContent = p; persist(); }
  });
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (confirm('This will erase your profile, notes, folders and settings from this browser. Continue?')) {
      localStorage.removeItem(DB_KEY);
      db = defaultDB();
      toast('All local data cleared.');
      showScreen('screen-welcome');
    }
  });
  document.getElementById('btn-settings-back').addEventListener('click', () => showScreen('screen-main'));

  function fillUserForm() {
    document.getElementById('input-firstname').value = db.user.firstName;
    document.getElementById('input-lastname').value = db.user.lastName;
    document.getElementById('input-age').value = db.user.age;
    document.getElementById('input-gender').value = db.user.gender;
    document.getElementById('input-gmail').value = db.user.gmail;
    document.getElementById('user-hint').textContent = '';
  }
  function saveUserForm(showToast) {
    db.user.firstName = document.getElementById('input-firstname').value.trim();
    db.user.lastName = document.getElementById('input-lastname').value.trim();
    db.user.age = document.getElementById('input-age').value.trim();
    db.user.gender = document.getElementById('input-gender').value.trim();
    db.user.gmail = document.getElementById('input-gmail').value.trim();
    persist();
    if (showToast) toast('Profile saved');
  }
  ['input-firstname','input-lastname','input-age','input-gender','input-gmail'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => saveUserForm(false));
  });
  document.getElementById('btn-user-back').addEventListener('click', () => {
    saveUserForm(true);
    showScreen('screen-main');
  });
  document.getElementById('btn-logout').addEventListener('click', () => {
    saveUserForm(false);
    db.loggedIn = false;
    persist();
    document.getElementById('input-login-password').value = '';
    showScreen('screen-login');
  });

  const canvas = document.getElementById('note-canvas');
  const ctx2d = canvas.getContext('2d', { willReadFrequently: true });
  const canvasWrap = document.getElementById('canvas-wrap');
  const titleInput = document.getElementById('title-input');

  let currentNoteId = null;
  let currentNoteFolderId = null;
  let drawing = false;
  let currentTool = 'pencil';
  let lastX = 0, lastY = 0;

  const TOOL_DEFAULTS = {
    pencil:      { color: '#333333', size: 3,  alpha: 1,   composite: 'source-over' },
    eraser:      { color: '#ffffff', size: 24, alpha: 1,   composite: 'destination-out' },
    highlighter: { color: '#fff176', size: 26, alpha: 0.35,composite: 'multiply' },
    marker:      { color: '#1e88e5', size: 10, alpha: 1,   composite: 'source-over' },
    pen:         { color: '#111111', size: 2.5,alpha: 1,   composite: 'source-over' }
  };
  const toolState = JSON.parse(JSON.stringify(TOOL_DEFAULTS));

  const PALETTE = ['#111111','#333333','#1e88e5','#e53935','#43a047','#fb8c00','#8e24aa','#00acc1','#fff176','#ffffff'];

  function resizeCanvas(keepDrawing) {
    const rect = canvasWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    let prev = null;
    if (keepDrawing && canvas.width > 0 && canvas.height > 0) {
      prev = document.createElement('canvas');
      prev.width = canvas.width; prev.height = canvas.height;
      prev.getContext('2d').drawImage(canvas, 0, 0);
    }

    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    fillWhite();
    if (prev) {
      ctx2d.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, rect.width, rect.height);
    }
  }
  function fillWhite() {
    ctx2d.save();
    ctx2d.globalCompositeOperation = 'source-over';
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    ctx2d.restore();
  }
  window.addEventListener('resize', () => { if (current === 'screen-editor') resizeCanvas(true); });

  let undoStack = [];
  let redoStack = [];
  const HISTORY_LIMIT = 25;

  function snapshot() {
    return canvas.toDataURL('image/png');
  }
  function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
  }
  function restoreFrom(dataURL) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        ctx2d.save();
        ctx2d.setTransform(1, 0, 0, 1, 0, 0);
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx2d.restore();
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        resolve();
      };
      img.src = dataURL;
    });
  }
  document.getElementById('tool-undo').addEventListener('click', async () => {
    if (undoStack.length === 0) { toast('Nothing to undo'); return; }
    redoStack.push(snapshot());
    const prev = undoStack.pop();
    await restoreFrom(prev);
  });
  document.getElementById('tool-redo').addEventListener('click', async () => {
    if (redoStack.length === 0) { toast('Nothing to redo'); return; }
    undoStack.push(snapshot());
    const next = redoStack.pop();
    await restoreFrom(next);
  });

  let preStrokeImage = null;
  let strokeBuffer = null;
  let strokeBufCtx = null;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function strokeStyleFor(tool) {
    return toolState[tool] || TOOL_DEFAULTS.pencil;
  }
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    pushHistory();
    preStrokeImage = ctx2d.getImageData(0, 0, canvas.width, canvas.height);
    const s = strokeStyleFor(currentTool);
    if (s.alpha < 1) {
      strokeBuffer = document.createElement('canvas');
      strokeBuffer.width = canvas.width;
      strokeBuffer.height = canvas.height;
      strokeBufCtx = strokeBuffer.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      strokeBufCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      strokeBuffer = null;
      strokeBufCtx = null;
    }
    const p = getPos(e);
    lastX = p.x; lastY = p.y;
    drawSegment(p.x, p.y, p.x + 0.01, p.y + 0.01);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = getPos(e);
    drawSegment(lastX, lastY, p.x, p.y);
    lastX = p.x; lastY = p.y;
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => {
    canvas.addEventListener(ev, () => {
      drawing = false;
      strokeBuffer = null;
      strokeBufCtx = null;
      preStrokeImage = null;
    });
  });

  function drawSegment(x0, y0, x1, y1) {
    const s = strokeStyleFor(currentTool);

    if (strokeBuffer) {

      strokeBufCtx.save();
      strokeBufCtx.globalCompositeOperation = 'source-over';
      strokeBufCtx.globalAlpha = 1;
      strokeBufCtx.strokeStyle = s.color;
      strokeBufCtx.lineWidth = s.size;
      strokeBufCtx.lineCap = 'round';
      strokeBufCtx.lineJoin = 'round';
      strokeBufCtx.beginPath();
      strokeBufCtx.moveTo(x0, y0);
      strokeBufCtx.lineTo(x1, y1);
      strokeBufCtx.stroke();
      strokeBufCtx.restore();

      ctx2d.putImageData(preStrokeImage, 0, 0);
      ctx2d.save();
      ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      ctx2d.globalCompositeOperation = s.composite;
      ctx2d.globalAlpha = s.alpha;
      ctx2d.drawImage(strokeBuffer, 0, 0);
      ctx2d.restore();
      const dpr = window.devicePixelRatio || 1;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      ctx2d.save();
      ctx2d.globalCompositeOperation = s.composite;
      ctx2d.globalAlpha = s.alpha;
      ctx2d.strokeStyle = s.color;
      ctx2d.lineWidth = s.size;
      ctx2d.lineCap = 'round';
      ctx2d.lineJoin = 'round';
      ctx2d.beginPath();
      ctx2d.moveTo(x0, y0);
      ctx2d.lineTo(x1, y1);
      ctx2d.stroke();
      ctx2d.restore();
    }
  }

  const popover = document.getElementById('tool-popover');
  const tpColors = document.getElementById('tp-colors');
  const tpSize = document.getElementById('tp-size');
  const tpSizeLabel = document.getElementById('tp-size-label');

  function buildPalette() {
    tpColors.innerHTML = '';
    PALETTE.forEach(color => {
      const sw = document.createElement('div');
      sw.className = 'tp-swatch';
      sw.style.background = color;
      sw.addEventListener('click', () => {
        toolState[currentTool].color = color;
        [...tpColors.children].forEach(c => c.classList.remove('selected'));
        sw.classList.add('selected');
      });
      tpColors.appendChild(sw);
    });
  }
  buildPalette();

  function selectTool(tool, btn) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active-tool'));
    btn.classList.add('active-tool');
    const s = toolState[tool];
    tpSize.value = s.size;
    tpSizeLabel.textContent = Math.round(s.size) + 'px';
    [...tpColors.children].forEach((c, i) => c.classList.toggle('selected', PALETTE[i] === s.color));
    const r = btn.getBoundingClientRect();
    popover.hidden = false;
    popover.style.left = Math.min(window.innerWidth - 220, r.left) + 'px';
    popover.style.top = (r.bottom + 8) + 'px';
  }
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tool = btn.dataset.tool;
      if (currentTool === tool && !popover.hidden) { popover.hidden = true; return; }
      selectTool(tool, btn);
    });
  });
  tpSize.addEventListener('input', () => {
    toolState[currentTool].size = Number(tpSize.value);
    tpSizeLabel.textContent = tpSize.value + 'px';
  });
  document.addEventListener('pointerdown', (e) => {
    if (!popover.hidden && !popover.contains(e.target) && !e.target.classList.contains('tool-btn')) {
      popover.hidden = true;
    }
  });

  const fileInput = document.getElementById('image-file-input');
  document.getElementById('tool-image').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        pushHistory();
        const cw = canvas.width / (window.devicePixelRatio || 1);
        const ch = canvas.height / (window.devicePixelRatio || 1);
        const scale = Math.min(cw / img.width, ch / img.height, 1) * 0.8;
        const w = img.width * scale, h = img.height * scale;
        ctx2d.save();
        ctx2d.globalCompositeOperation = 'source-over';
        ctx2d.globalAlpha = 1;
        ctx2d.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
        ctx2d.restore();
        toast('Image inserted');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });

  document.getElementById('tool-insert').addEventListener('click', () => {
    const text = prompt('Text to insert:');
    if (!text) return;
    pushHistory();
    const s = strokeStyleFor(currentTool === 'eraser' ? 'pen' : currentTool);
    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);
    ctx2d.save();
    ctx2d.globalCompositeOperation = 'source-over';
    ctx2d.globalAlpha = 1;
    ctx2d.fillStyle = s.color === '#ffffff' ? '#333333' : s.color;
    ctx2d.font = `${Math.max(16, s.size * 4)}px 'Trebuchet MS', sans-serif`;
    ctx2d.textAlign = 'center';
    ctx2d.fillText(text, cw / 2, ch / 2);
    ctx2d.restore();
    toast('Text inserted — drag it around isn\u2019t supported yet, but you can undo and retry position');
  });

  document.getElementById('tool-folder').addEventListener('click', () => {
    chooseFolderForNote(currentNoteFolderId, (newFolderId) => {
      currentNoteFolderId = newFolderId;
      pageDirty = true;
      doSave(true);
      toast(newFolderId ? `Moved to "${folderName(newFolderId)}"` : 'Removed from folder');
    });
  });

  let pageDirty = false;
  canvas.addEventListener('pointerdown', () => { pageDirty = true; });
  titleInput.addEventListener('input', () => { pageDirty = true; });
  fileInput.addEventListener('change', () => { pageDirty = true; });
  document.getElementById('tool-insert').addEventListener('click', () => { pageDirty = true; });

  function doSave(silent) {

    if (!currentNoteId && !pageDirty) return false;
    const dataURL = canvas.toDataURL('image/png');
    const title = titleInput.value.trim();
    const now = Date.now();
    if (currentNoteId) {
      const note = db.notes.find(n => n.id === currentNoteId);
      if (note) {
        note.title = title;
        note.dataURL = dataURL;
        note.folderId = currentNoteFolderId;
        note.updatedAt = now;
      }
    } else {
      const note = { id: uid(), title, dataURL, folderId: currentNoteFolderId, createdAt: now, updatedAt: now };
      db.notes.push(note);
      currentNoteId = note.id;
    }
    persist();
    if (!silent) toast('Note saved');
    return true;
  }
  document.getElementById('tool-save').addEventListener('click', () => {
    pageDirty = true;
    doSave(false);
  });

  document.getElementById('tool-print').addEventListener('click', () => {
    const dataURL = canvas.toDataURL('image/png');
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to print'); return; }
    w.document.write(`<html><head><title>${titleInput.value || 'AeroNotes'}</title></head>
      <body style="margin:0;display:flex;align-items:center;justify-content:center;">
      <img src="${dataURL}" style="max-width:100%;" onload="window.print();"></body></html>`);
    w.document.close();
  });

  let editorSession = 0;
  function openEditor(noteId, folderIdForNew) {
    const session = ++editorSession;
    currentNoteId = noteId || null;
    currentNoteFolderId = noteId
      ? (db.notes.find(n => n.id === noteId) || {}).folderId || null
      : (folderIdForNew || null);
    pageDirty = false;
    undoStack = []; redoStack = [];

    const note = noteId ? db.notes.find(n => n.id === noteId) : null;
    titleInput.value = note ? (note.title || '') : '';
    showScreen('screen-editor');
    titleInput.hidden = false;
    requestAnimationFrame(() => {
      if (session !== editorSession) return;
      resizeCanvas(false);
      if (note && note.dataURL) {
        const img = new Image();
        img.onload = () => {
          if (session !== editorSession) return;
          ctx2d.save();
          ctx2d.setTransform(1, 0, 0, 1, 0, 0);
          ctx2d.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx2d.restore();
        };
        img.src = note.dataURL;
      }
    });

    selectTool('pencil', document.getElementById('tool-pencil'));
    popover.hidden = true;
  }

  document.getElementById('btn-editor-back').addEventListener('click', () => {
    if (doSave(true)) toast('Note saved');
    openNotesList(notesFolderScope, notesReturnTarget);
  });
  document.getElementById('btn-editor-newnote').addEventListener('click', () => {
    doSave(true);

    openEditor(null, currentNoteFolderId);
    toast('New page');
  });

  showScreen('screen-welcome');
})();
