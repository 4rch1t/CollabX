/* Profile page */
(function () {
  if (!requireAuth()) return;

  let userData = null;
  const skillsInput = setupTagInput('edit-skills-wrapper', 'edit-skills-hidden');
  const interestsInput = setupTagInput('edit-interests-wrapper', 'edit-interests-hidden');

  async function load() {
    try {
      userData = await api('/users/me');
      render();
    } catch (err) {
      showToast('Failed to load profile', 'error');
    }
  }

  function render() {
    document.getElementById('profile-avatar').textContent = avatarInitial(userData.name);
    document.getElementById('profile-name').textContent = userData.name;
    document.getElementById('profile-email').textContent = userData.email;
    document.getElementById('profile-bio').textContent = userData.bio || 'No bio yet.';
    document.getElementById('profile-skills').innerHTML = (userData.skills || []).map(skillTag).join('') || '<span style="color:var(--gray)">No skills added</span>';
    document.getElementById('profile-interests').innerHTML = (userData.interests || []).map(s => '<span class="skill-tag-outline">' + escHtml(s) + '</span>').join('') || '<span style="color:var(--gray)">No interests added</span>';
    document.getElementById('profile-github').textContent = userData.github || '—';
    document.getElementById('profile-linkedin').textContent = userData.linkedin || '—';
  }

  document.getElementById('edit-btn').addEventListener('click', () => {
    document.getElementById('view-mode').style.display = 'none';
    document.getElementById('edit-mode').style.display = 'block';
    document.getElementById('edit-name').value = userData.name;
    document.getElementById('edit-bio').value = userData.bio || '';
    document.getElementById('edit-github').value = userData.github || '';
    document.getElementById('edit-linkedin').value = userData.linkedin || '';
    skillsInput.setTags(userData.skills || []);
    interestsInput.setTags(userData.interests || []);
  });

  document.getElementById('cancel-edit').addEventListener('click', () => {
    document.getElementById('view-mode').style.display = 'block';
    document.getElementById('edit-mode').style.display = 'none';
  });

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      userData = await api('/users/me', {
        method: 'PUT',
        body: {
          name: document.getElementById('edit-name').value,
          bio: document.getElementById('edit-bio').value,
          skills: skillsInput.getTags(),
          interests: interestsInput.getTags(),
          github: document.getElementById('edit-github').value,
          linkedin: document.getElementById('edit-linkedin').value
        }
      });
      // Update stored user
      const stored = getUser();
      stored.name = userData.name;
      stored.skills = userData.skills;
      setAuth(getToken(), stored);
      updateNav();

      document.getElementById('view-mode').style.display = 'block';
      document.getElementById('edit-mode').style.display = 'none';
      render();
      showToast('Profile updated!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Save Changes';
  });

  load();
})();
