/* Dashboard page logic */
(function () {
  if (!requireAuth()) return;
  const user = getUser();
  document.getElementById('greeting').textContent = 'Welcome back, ' + (user ? user.name.split(' ')[0] : '') + '!';

  let myProjects = { owned: [], memberOf: [] };
  let myApps = [];
  let pendingRequests = [];
  let activeTab = 'owned';

  async function load() {
    try {
      const [projData, appsData] = await Promise.all([
        api('/projects/mine'),
        api('/projects/my-applications')
      ]);
      myProjects = projData;
      myApps = appsData;

      document.getElementById('stat-owned').textContent = myProjects.owned.length;
      document.getElementById('stat-member').textContent = myProjects.memberOf.length;
      document.getElementById('stat-apps').textContent = myApps.filter(a => a.status === 'pending').length;

      renderTab();
      loadPendingRequests();
    } catch (err) {
      document.getElementById('tab-content').innerHTML = '<p style="color:var(--gray)">Failed to load data.</p>';
    }
  }

  async function loadPendingRequests() {
    pendingRequests = [];
    for (const p of myProjects.owned) {
      try {
        const apps = await api('/projects/' + p._id + '/applications');
        const pending = apps.filter(a => a.status === 'pending');
        pending.forEach(a => { a._projectTitle = p.title; a._projectId = p._id; });
        pendingRequests.push(...pending);
      } catch (e) { /* skip */ }
    }
    document.getElementById('stat-pending').textContent = pendingRequests.length;
    const section = document.getElementById('pending-requests');
    const list = document.getElementById('pending-list');
    const countEl = document.getElementById('pending-count');
    if (pendingRequests.length) {
      section.style.display = 'block';
      countEl.textContent = pendingRequests.length + ' pending';
      list.innerHTML = pendingRequests.map(a => {
        const skills = (a.applicant.skills || []).slice(0, 3).map(skillTag).join('');
        return '<div class="pending-card">'
          + '<div class="avatar-md" style="width:40px;height:40px;border-radius:50%;background:var(--yellow);border:2px solid var(--black);display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">' + avatarInitial(a.applicant.name) + '</div>'
          + '<div class="pending-info">'
          + '<strong>' + escHtml(a.applicant.name) + '</strong> wants to join <a href="/project-detail.html?id=' + a._projectId + '" style="color:var(--red);font-weight:700">' + escHtml(a._projectTitle) + '</a>'
          + (a.message ? '<p style="color:var(--gray);font-size:0.85rem;margin-top:2px">"' + escHtml(a.message) + '"</p>' : '')
          + '<div class="tags-container" style="margin-top:4px">' + skills + '</div>'
          + '</div>'
          + '<div class="pending-actions">'
          + '<button class="btn btn-sm btn-dark" onclick="handlePending(\'' + a._id + '\',\'accepted\',this)">Accept</button>'
          + '<button class="btn btn-sm btn-outline" onclick="handlePending(\'' + a._id + '\',\'rejected\',this)">Reject</button>'
          + '</div>'
          + '</div>';
      }).join('');
    } else {
      section.style.display = 'none';
    }
  }

  window.handlePending = async function (appId, status, btn) {
    try {
      await api('/projects/applications/' + appId, { method: 'PUT', body: { status } });
      showToast(status === 'accepted' ? 'Application accepted!' : 'Application rejected', status === 'accepted' ? 'success' : '');
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  function renderTab() {
    const container = document.getElementById('tab-content');
    if (activeTab === 'owned') {
      if (!myProjects.owned.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><h3>No projects yet</h3><p>Create your first project and start building your team!</p><div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><a href="/create-project.html" class="btn btn-red">Create Project</a><a href="/projects.html" class="btn btn-outline">Explore Projects</a></div></div>';
        return;
      }
      container.innerHTML = '<div class="projects-grid">' + myProjects.owned.map(projectCard).join('') + '</div>';
    } else if (activeTab === 'joined') {
      if (!myProjects.memberOf.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">👥</div><h3>No teams joined yet</h3><p>Browse open projects and apply to join a team!</p><a href="/projects.html" class="btn btn-yellow">🔍 Explore Projects</a></div>';
        return;
      }
      container.innerHTML = '<div class="projects-grid">' + myProjects.memberOf.map(projectCard).join('') + '</div>';
    } else {
      if (!myApps.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📩</div><h3>No applications yet</h3><p>Browse projects and apply to start collaborating!</p><a href="/projects.html" class="btn btn-yellow">🔍 Explore Projects</a></div>';
        return;
      }
      container.innerHTML = '<div class="app-list">' + myApps.map(appItem).join('') + '</div>';
    }
  }

  function projectCard(p) {
    const skills = (p.requiredSkills || []).map(skillTag).join('');
    return '<a href="/project-detail.html?id=' + p._id + '" class="project-card" style="text-decoration:none">'
      + '<div class="project-card-header"><span class="project-category ' + p.category + '">' + escHtml(p.category) + '</span><span style="color:var(--gray);font-size:0.85rem">' + formatDate(p.createdAt) + '</span></div>'
      + '<h3>' + escHtml(p.title) + '</h3>'
      + '<p>' + escHtml(p.description).substring(0, 120) + (p.description.length > 120 ? '...' : '') + '</p>'
      + '<div class="tags-container" style="margin-bottom:12px">' + skills + '</div>'
      + '<div class="project-meta"><span>👥 ' + (p.members ? p.members.length : 1) + '/' + p.teamSize + '</span><span>📂 ' + p.status + '</span></div>'
      + '</a>';
  }

  function appItem(a) {
    const statusColors = { pending: 'var(--yellow)', accepted: '#4CAF50', rejected: 'var(--red)' };
    const statusIcons = { pending: '⏳', accepted: '✅', rejected: '❌' };
    const projectTitle = a.project ? a.project.title : 'Unknown';
    const projectId = a.project ? a.project._id : '';
    return '<a href="' + (projectId ? '/project-detail.html?id=' + projectId : '#') + '" class="app-card" style="text-decoration:none;color:inherit">'
      + '<div style="font-size:1.5rem;flex-shrink:0">' + (statusIcons[a.status] || '📩') + '</div>'
      + '<div class="app-info"><h4>' + escHtml(projectTitle) + '</h4><p style="color:var(--gray);font-size:0.85rem">' + (a.message ? escHtml(a.message) : 'Applied ' + formatDate(a.createdAt)) + '</p></div>'
      + '<span class="skill-tag" style="background:' + statusColors[a.status] + '">' + a.status + '</span>'
      + '</a>';
  }

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      renderTab();
    });
  });

  // Join with invite code
  const joinBtn = document.getElementById('join-invite-btn');
  const inviteInput = document.getElementById('invite-input');
  if (joinBtn) {
    joinBtn.addEventListener('click', async () => {
      const code = inviteInput.value.trim();
      if (!code) return showToast('Enter an invite code', 'error');
      joinBtn.disabled = true; joinBtn.textContent = 'Joining...';
      try {
        const project = await api('/projects/join/' + encodeURIComponent(code), { method: 'POST' });
        showToast('Joined "' + project.title + '"!', 'success');
        inviteInput.value = '';
        load();
      } catch (err) { showToast(err.message, 'error'); }
      joinBtn.disabled = false; joinBtn.textContent = 'Join Team';
    });
    inviteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinBtn.click(); });
  }

  load();
})();
