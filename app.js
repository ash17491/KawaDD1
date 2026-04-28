(() => {
  const STORAGE_KEY = 'kawa_esdd_responses_v1';
  const state = { data: window.KAWA_FORM_DATA || { sections: [] }, currentSection: null, editingId: null };
  const $ = id => document.getElementById(id);
  const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const safe = v => (v == null ? '' : String(v));
  const slug = s => safe(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'field';
  const sections = () => state.data.sections || [];
  const current = () => sections().find(s => s.id === state.currentSection) || sections()[0];
  const fieldKey = (q, idx) => q.name || q.id || `${slug(q.label || q.question || q.title || 'question')}_${idx + 1}`;
  const questionLabel = q => q.label || q.question || q.title || q.name || 'Question';
  function toast(msg){ const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1800); }
  function loadResponses(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function saveResponses(rows){ localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); renderSaved(); }
  function init(){
    if (!sections().length) { $('formTitle').textContent = 'No form data found'; return; }
    $('sectionSelect').innerHTML = sections().map(s => `<option value="${s.id}">${s.title || s.id}</option>`).join('');
    state.currentSection = sections()[0].id;
    $('sectionSelect').addEventListener('change', e => { state.currentSection = e.target.value; state.editingId = null; renderForm(); });
    $('saveBtn').addEventListener('click', saveCurrent);
    $('clearBtn').addEventListener('click', e => { e.preventDefault(); state.editingId = null; renderForm(); toast('Form cleared'); });
    $('newBtn').addEventListener('click', () => { state.editingId = null; renderForm(); });
    $('copyCurrentBtn').addEventListener('click', copyCurrent);
    $('exportCsvBtn').addEventListener('click', () => download('kawa_esdd_responses.csv', makeCsv(), 'text/csv'));
    $('exportJsonBtn').addEventListener('click', () => download('kawa_esdd_responses.json', JSON.stringify(loadResponses(), null, 2), 'application/json'));
    $('copyCsvBtn').addEventListener('click', copyCsv);
    $('deleteAllBtn').addEventListener('click', deleteAll);
    $('importFile').addEventListener('change', importJson);
    renderForm(); renderSaved();
  }
  function renderForm(existing){
    const sec = current(); if (!sec) return;
    $('sectionSelect').value = sec.id; $('formTitle').textContent = sec.title || sec.id;
    const form = $('questionForm'); form.innerHTML = '';
    (sec.questions || []).forEach((q, idx) => form.appendChild(renderQuestion(q, idx, existing?.answers?.[fieldKey(q, idx)] || '', existing?.answers?.[`${fieldKey(q, idx)}_notes`] || '')));
  }
  function renderQuestion(q, idx, value, noteValue){
    const key = fieldKey(q, idx), label = questionLabel(q), type = q.type || 'field', lower = label.toLowerCase();
    const wrap = document.createElement('div'); wrap.className = 'field'; wrap.dataset.key = key; wrap.dataset.label = label;
    const title = document.createElement('div'); title.className = 'field-title'; title.textContent = label; wrap.appendChild(title);
    if (type !== 'field') { const meta = document.createElement('div'); meta.className = 'field-meta'; meta.textContent = type.replace(/_/g, ' '); wrap.appendChild(meta); }
    let input;
    if (type === 'risk') {
      input = select(['','Green / no issue','Yellow / monitor','Red / serious concern','Not assessed'], 'Select risk rating'); input.value = value; wrap.appendChild(input); addNotes(wrap, key, noteValue, 'Notes / evidence');
    } else if (type === 'rating_notes' || lower.includes('score') || lower.includes('rate')) {
      input = select(['','1 - Very weak','2 - Weak','3 - Acceptable','4 - Good','5 - Strong','N/A'], 'Select rating'); input.value = value; wrap.appendChild(input); addNotes(wrap, key, noteValue, 'Notes');
    } else if (lower.includes('yes/no') || lower.startsWith('any ') || lower.includes(' received ') || lower.includes('clearing')) {
      input = select(['','Yes','No','Partly','Not sure','N/A'], 'Select'); input.value = value; wrap.appendChild(input);
    } else if (lower.includes('date')) {
      input = document.createElement('input'); input.type = 'date'; input.value = value; wrap.appendChild(input);
    } else if (lower.includes('ha') || lower.includes('kg') || lower.includes('r$') || lower.includes('price') || lower.includes('yield') || lower.includes('number') || lower.includes('size')) {
      input = document.createElement('input'); input.type = 'text'; input.inputMode = 'decimal'; input.value = value; wrap.appendChild(input);
    } else {
      input = document.createElement('textarea'); input.value = value; wrap.appendChild(input);
    }
    input.dataset.input = key;
    return wrap;
  }
  function select(options, placeholder){ const el = document.createElement('select'); options.forEach((v, i) => el.add(new Option(i === 0 ? placeholder : v, v))); return el; }
  function addNotes(wrap, key, value, placeholder){ const notes = document.createElement('textarea'); notes.placeholder = placeholder; notes.dataset.notes = `${key}_notes`; notes.value = value || ''; wrap.appendChild(notes); }
  function collect(){ const sec = current(), answers = {}; document.querySelectorAll('[data-input]').forEach(el => answers[el.dataset.input] = el.value || ''); document.querySelectorAll('[data-notes]').forEach(el => answers[el.dataset.notes] = el.value || ''); return { id: state.editingId || uid(), section_id: sec.id, section_title: sec.title || sec.id, saved_at: new Date().toISOString(), answers }; }
  function saveCurrent(e){ e.preventDefault(); const row = collect(), rows = loadResponses(), i = rows.findIndex(r => r.id === row.id); if (i >= 0) rows[i] = row; else rows.push(row); state.editingId = row.id; saveResponses(rows); toast('Response saved'); }
  function copyCurrent(){ const row = collect(), txt = JSON.stringify(row, null, 2); navigator.clipboard?.writeText(txt).then(() => toast('Copied current response')).catch(() => { $('exportBox').value = txt; toast('Copy blocked — text shown below'); }); }
  function renderSaved(){ const rows = loadResponses(); $('savedCount').textContent = `${rows.length} saved`; const list = $('savedList'); if (!rows.length) { list.innerHTML = '<p class="hint">No saved responses yet.</p>'; return; } list.innerHTML = rows.slice().reverse().map(r => `<div class="saved-item"><strong>${escapeHtml(r.section_title)}</strong><span>${new Date(r.saved_at).toLocaleString()}</span><div class="saved-actions"><button data-load="${r.id}" class="secondary">Open</button><button data-del="${r.id}" class="danger">Delete</button></div></div>`).join(''); list.querySelectorAll('[data-load]').forEach(b => b.onclick = () => openSaved(b.dataset.load)); list.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteSaved(b.dataset.del)); }
  function openSaved(id){ const r = loadResponses().find(x => x.id === id); if (!r) return; state.currentSection = r.section_id; state.editingId = r.id; renderForm(r); toast('Saved response opened'); }
  function deleteSaved(id){ saveResponses(loadResponses().filter(r => r.id !== id)); if (state.editingId === id) { state.editingId = null; renderForm(); } }
  function deleteAll(){ if (confirm('Delete all saved responses from this browser?')) { saveResponses([]); state.editingId = null; renderForm(); toast('All responses deleted'); } }
  function headers(rows){ const set = new Set(['id','section_title','saved_at']); rows.forEach(r => Object.keys(r.answers || {}).forEach(k => set.add(k))); return [...set]; }
  function makeCsv(){ const rows = loadResponses(), h = headers(rows), lines = [h.map(csvCell).join(',')]; rows.forEach(r => lines.push(h.map(k => csvCell(k === 'id' ? r.id : k === 'section_title' ? r.section_title : k === 'saved_at' ? r.saved_at : (r.answers || {})[k])).join(','))); const csv = lines.join('\n'); $('exportBox').value = csv; return csv; }
  function csvCell(v){ v = safe(v).replace(/\r?\n/g, ' '); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
  function download(name, text, type){ $('exportBox').value = text; const blob = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('Export prepared'); }
  function copyCsv(){ const csv = makeCsv(); navigator.clipboard?.writeText(csv).then(() => toast('CSV copied')).catch(() => toast('Copy blocked — select text manually')); }
  function importJson(e){ const f = e.target.files[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { try { const imported = JSON.parse(reader.result); if (!Array.isArray(imported)) throw new Error('Expected array'); saveResponses(imported); toast('JSON imported'); } catch { toast('Import failed: invalid JSON'); } }; reader.readAsText(f); }
  function escapeHtml(s){ return safe(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  init();
})();
