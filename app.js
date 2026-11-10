(() => {
  'use strict';
  const TEAM_MEMBERS = ['Anurag', 'Swathi', 'Shreyaswi', 'Saniya'];
  const STATUSES = ['Not Started', 'In Progress', 'Pushed for Review', 'To Be Checked', 'Review Closed'];
  const STATUS_COLORS = {'Not Started':'#64748b','In Progress':'#0284c7','Pushed for Review':'#f59e0b','To Be Checked':'#a855f7','Review Closed':'#10b981'};
  const cfg = window.SUPABASE_CONFIG || {};
  const authShell = document.getElementById('authShell');
  const appShell = document.getElementById('appShell');
  const dialog = document.getElementById('functionDialog');
  const $ = id => document.getElementById(id);
  let supabase = null;
  let functionsList = [];
  let channel = null;
  let refreshTimer = null;
  let busy = false;

  function setNotice(message, error = false) {
    $('syncStatus').textContent = message;
    $('syncStatus').classList.toggle('error', error);
  }
  function setAuthMessage(message, error = true) {
    $('authMessage').textContent = message;
    $('authMessage').classList.toggle('success', !error);
  }
  function normalizeItem(item) {
    return { id: item.id, functionName: item.function_name ?? item.functionName ?? '', scope: item.scope || 'Code Refac', effortHrs: Number(item.effort_hrs ?? item.effortHrs ?? 4), owner: item.owner || TEAM_MEMBERS[0], reviewer: item.reviewer || TEAM_MEMBERS[1], status: item.status || 'Not Started', observations: item.observations || '', updatedAt: item.updated_at ?? item.updatedAt };
  }
  function toDb(payload) {
    return { function_name: payload.functionName, scope: payload.scope, effort_hrs: payload.effortHrs, owner: payload.owner, reviewer: payload.reviewer, status: payload.status, observations: payload.observations };
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }
  function populatePeople() {
    for (const id of ['formOwner','formReviewer']) {
      $(id).innerHTML = TEAM_MEMBERS.map(name => `<option>${escapeHtml(name)}</option>`).join('');
    }
  }
  async function loadData(showLoading = false) {
    if (showLoading) setNotice('Loading shared records…');
    const { data, error } = await supabase.from('review_functions').select('*').order('created_at', {ascending:false});
    if (error) { setNotice(`Could not load shared data: ${error.message}`, true); return; }
    functionsList = (data || []).map(normalizeItem);
    renderAll();
    setNotice(`Connected · ${functionsList.length} shared records · Last refreshed ${new Date().toLocaleTimeString()}`);
  }
  function renderAll() { updateFilterOptions(); updateMetrics(); renderTable(); }
  function updateFilterOptions() {
    const owners = [...new Set([...TEAM_MEMBERS, ...functionsList.map(x=>x.owner).filter(Boolean)])];
    const reviewers = [...new Set([...TEAM_MEMBERS, ...functionsList.map(x=>x.reviewer).filter(Boolean)])];
    for (const [id, values, label] of [['ownerFilter',owners,'All Owners'],['reviewerFilter',reviewers,'All Reviewers']]) {
      const current = $(id).value || 'ALL';
      $(id).innerHTML = `<option value="ALL">${label}</option>` + values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      $(id).value = values.includes(current) ? current : 'ALL';
    }
  }
  function updateMetrics() {
    const total = functionsList.length;
    const effort = functionsList.reduce((n,x)=>n+(Number(x.effortHrs)||0),0);
    const closed = functionsList.filter(x=>x.status==='Review Closed').reduce((n,x)=>n+(Number(x.effortHrs)||0),0);
    const count = status => functionsList.filter(x=>x.status===status).length;
    $('metricTotal').textContent = total;
    $('metricEffort').textContent = `${effort} hrs`;
    $('metricTest').textContent = functionsList.filter(x=>x.scope==='Unit spec / Test spec').length;
    $('metricRefac').textContent = functionsList.filter(x=>x.scope==='Code Refac').length;
    $('metricReview').textContent = count('Pushed for Review') + count('To Be Checked');
    $('metricClosed').textContent = count('Review Closed');
    $('completionPct').textContent = `${effort ? Math.round(closed/effort*100) : 0}%`;
    $('progressTrack').innerHTML = STATUSES.map(s=>`<div class="progress-segment" title="${s}: ${count(s)}" style="width:${total?count(s)/total*100:0}%;background:${STATUS_COLORS[s]}"></div>`).join('');
    $('progressLegend').innerHTML = STATUSES.map(s=>`<span class="legend-item"><i class="swatch" style="background:${STATUS_COLORS[s]}"></i>${s} (${count(s)})</span>`).join('');
  }
  function renderTable() {
    const query = $('searchInput').value.trim().toLowerCase();
    const scope = $('scopeFilter').value, status = $('statusFilter').value, owner = $('ownerFilter').value, reviewer = $('reviewerFilter').value;
    const filtered = functionsList.filter(item => {
      if (scope !== 'ALL' && item.scope !== scope) return false;
      if (status !== 'ALL' && item.status !== status) return false;
      if (owner !== 'ALL' && item.owner !== owner) return false;
      if (reviewer !== 'ALL' && item.reviewer !== reviewer) return false;
      const haystack = `${item.functionName} ${item.scope} ${item.effortHrs} ${item.owner} ${item.reviewer} ${item.observations}`.toLowerCase();
      return !query || haystack.includes(query);
    });
    $('recordCount').textContent = `${filtered.length} of ${functionsList.length} records`;
    if (!filtered.length) { $('tableBody').innerHTML = '<tr><td colspan="8" class="empty">No matching functions found.</td></tr>'; return; }
    $('tableBody').innerHTML = filtered.map(item => {
      const scopeClass = item.scope === 'Unit spec / Test spec' ? 'scope-test' : 'scope-refac';
      return `<tr>
        <td><code class="signature">${escapeHtml(item.functionName)}</code></td>
        <td><span class="pill ${scopeClass}">${escapeHtml(item.scope)}</span></td>
        <td>${escapeHtml(item.effortHrs)} hrs</td><td>${escapeHtml(item.owner)}</td><td>${escapeHtml(item.reviewer)}</td>
        <td><select class="status-select" data-status-id="${escapeHtml(item.id)}" aria-label="Status for ${escapeHtml(item.functionName)}">${STATUSES.map(s=>`<option ${s===item.status?'selected':''}>${s}</option>`).join('')}</select></td>
        <td><div class="observations">${escapeHtml(item.observations || 'No observations entered yet.')}</div></td>
        <td><div class="row-actions"><button class="small-btn" data-edit-id="${escapeHtml(item.id)}">Edit</button><button class="small-btn delete-btn" data-delete-id="${escapeHtml(item.id)}">Delete</button></div></td>
      </tr>`;
    }).join('');
  }
  function openAdd() {
    $('functionForm').reset(); $('recordId').value=''; $('recordUpdatedAt').value=''; $('dialogTitle').textContent='Add C++ Free Function';
    $('formScope').value='Unit spec / Test spec'; $('formEffort').value='4'; $('formOwner').value='Anurag'; $('formReviewer').value='Swathi'; $('formStatus').value='Not Started'; $('formMessage').textContent='';
    dialog.showModal();
  }
  function openEdit(id) {
    const item = functionsList.find(x=>String(x.id)===String(id)); if (!item) return;
    $('recordId').value=item.id; $('recordUpdatedAt').value=item.updatedAt || ''; $('dialogTitle').textContent='Edit Function & Review Findings';
    $('formFunctionName').value=item.functionName; $('formScope').value=item.scope; $('formEffort').value=item.effortHrs; $('formOwner').value=item.owner; $('formReviewer').value=item.reviewer; $('formStatus').value=item.status; $('formObservations').value=item.observations; $('formMessage').textContent='';
    dialog.showModal();
  }
  function getFormPayload() {
    return {functionName:$('formFunctionName').value.trim(),scope:$('formScope').value,effortHrs:Number($('formEffort').value),owner:$('formOwner').value,reviewer:$('formReviewer').value,status:$('formStatus').value,observations:$('formObservations').value.trim()};
  }
  async function saveRecord(event) {
    event.preventDefault(); if (busy) return; busy=true; $('saveRecordBtn').disabled=true; $('formMessage').textContent='Saving…';
    try {
      const payload=getFormPayload();
      if (!payload.functionName || !Number.isFinite(payload.effortHrs) || payload.effortHrs < .5) throw new Error('Enter a function name and effort of at least 0.5 hours.');
      const id=$('recordId').value;
      if (id) {
        let query=supabase.from('review_functions').update(toDb(payload)).eq('id',id);
        const oldUpdatedAt=$('recordUpdatedAt').value;
        if (oldUpdatedAt) query=query.eq('updated_at',oldUpdatedAt);
        const {data,error}=await query.select().maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('This record was changed or deleted by another user. Close this form, refresh, and review the latest version before editing again.');
      } else {
        const {error}=await supabase.from('review_functions').insert(toDb(payload)); if (error) throw error;
      }
      dialog.close(); await loadData();
    } catch (error) { $('formMessage').textContent=error.message || 'Save failed.'; }
    finally { busy=false; $('saveRecordBtn').disabled=false; }
  }
  async function changeStatus(id,newStatus) {
    const item=functionsList.find(x=>String(x.id)===String(id)); if (!item) return;
    const {data,error}=await supabase.from('review_functions').update({status:newStatus}).eq('id',id).eq('updated_at',item.updatedAt).select().maybeSingle();
    if (error || !data) { setNotice(error?.message || 'Record changed elsewhere. Refreshing latest data.',true); await loadData(); return; }
    await loadData();
  }
  async function deleteRecord(id) {
    const item=functionsList.find(x=>String(x.id)===String(id)); if (!item || !confirm(`Remove "${item.functionName}" from the shared tracker?`)) return;
    const {data,error}=await supabase.from('review_functions').delete().eq('id',id).eq('updated_at',item.updatedAt).select().maybeSingle();
    if (error || !data) { setNotice(error?.message || 'Record changed elsewhere. Refreshing latest data.',true); await loadData(); return; }
    await loadData();
  }
  function download(filename,content,type) {
    const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  }
  function exportJson() { download('cpp-free-functions.json',JSON.stringify(functionsList.map(({id,updatedAt,...x})=>x),null,2),'application/json'); }
  function exportCsv() {
    const headers=['FunctionName','Scope','EstimatedEffortHrs','Owner','Reviewer','Status','Observations'];
    const quote=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    const rows=functionsList.map(x=>[x.functionName,x.scope,x.effortHrs,x.owner,x.reviewer,x.status,x.observations].map(quote).join(','));
    download('cpp-free-functions.csv',[headers.join(','),...rows].join('\r\n'),'text/csv;charset=utf-8');
  }
  function subscribeRealtime() {
    if (channel) supabase.removeChannel(channel);
    channel=supabase.channel('review-functions-live').on('postgres_changes',{event:'*',schema:'public',table:'review_functions'},()=>loadData()).subscribe();
    // Realtime is best-effort; polling provides a fallback if publication isn't enabled.
    clearInterval(refreshTimer); refreshTimer=setInterval(()=>loadData(),15000);
  }
  async function showApp(session) {
    authShell.classList.add('hidden'); appShell.classList.remove('hidden');
    $('signedInAs').textContent=session.user.email;
    await loadData(true); subscribeRealtime();
  }
  async function signOut() {
    if (channel) await supabase.removeChannel(channel); clearInterval(refreshTimer);
    await supabase.auth.signOut(); appShell.classList.add('hidden'); authShell.classList.remove('hidden'); $('loginPassword').value='';
  }
  async function init() {
    if (!window.supabase || !cfg.url || !cfg.publishableKey || cfg.url.includes('YOUR_PROJECT_REF') || cfg.publishableKey.includes('REPLACE_WITH')) {
      setAuthMessage('Setup required: add your Supabase Project URL and publishable key to config.js.'); return;
    }
    supabase=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $('loginForm').addEventListener('submit',async e=>{e.preventDefault();setAuthMessage('Signing in…',false);const {data,error}=await supabase.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});if(error){setAuthMessage(error.message);return;}setAuthMessage('');await showApp(data.session);});
    $('signOutBtn').addEventListener('click',signOut);
    supabase.auth.onAuthStateChange((_event,session)=>{if(session && appShell.classList.contains('hidden')) showApp(session);});
    const {data:{session}}=await supabase.auth.getSession(); if(session) await showApp(session);
  }
  populatePeople();
  $('addBtn').addEventListener('click',openAdd); $('closeDialog').addEventListener('click',()=>dialog.close()); $('cancelDialog').addEventListener('click',()=>dialog.close()); $('functionForm').addEventListener('submit',saveRecord);
  $('tableBody').addEventListener('change',e=>{if(e.target.matches('[data-status-id]')) changeStatus(e.target.dataset.statusId,e.target.value);});
  $('tableBody').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-id]');const del=e.target.closest('[data-delete-id]');if(edit)openEdit(edit.dataset.editId);if(del)deleteRecord(del.dataset.deleteId);});
  ['searchInput','scopeFilter','statusFilter','ownerFilter','reviewerFilter'].forEach(id=>$(id).addEventListener(id==='searchInput'?'input':'change',renderTable));
  $('exportJsonBtn').addEventListener('click',exportJson); $('exportCsvBtn').addEventListener('click',exportCsv);
  window.addEventListener('online',()=>loadData());
  init().catch(err=>setAuthMessage(err.message || 'Initialization failed.'));
})();
