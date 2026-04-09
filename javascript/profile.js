document.addEventListener('DOMContentLoaded', () => {
  const tokenKey = 'cookit_access_token';
  const userKey = 'cookit_current_user';
  const avatarKey = 'cookit_profile_avatar';

  const token = window.localStorage.getItem(tokenKey);
  const cachedUser = window.localStorage.getItem(userKey);

  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const roleEl = document.getElementById('accountRole');
  const avatarPreview = document.getElementById('profileAvatarPreview');
  const avatarInput = document.getElementById('avatarInput');
  const resetAvatarBtn = document.getElementById('resetAvatarBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const favoritesList = document.getElementById('favoritesList');
  const historyList = document.getElementById('historyList');
  const favoritesStat = document.getElementById('favoritesStat');
  const historyStat = document.getElementById('historyStat');
  const latestStat = document.getElementById('latestStat');
  const avatarStat = document.getElementById('avatarStat');

  const setEmpty = (element, text) => {
    if (!element) return;
    element.innerHTML = `<div class="empty-note">${text}</div>`;
  };

  const ensureAuthenticated = () => {
    if (!token) {
      window.location.href = '/html/Login.html';
      return false;
    }
    return true;
  };

  const renderItem = (item, type) => {
    const title = type === 'favorite' ? item.recipe?.name : item.query?.ingredients?.join(', ') || 'Empty session';
    const subtitle = type === 'favorite'
      ? item.recipe?.description || 'Saved recipe'
      : `${item.result_ids?.length || 0} recipe suggestion(s)`;
    const meta = type === 'favorite'
      ? new Date(item.created_at).toLocaleDateString()
      : new Date(item.created_at).toLocaleString();

    return `
      <div class="mini-item">
        <div>
          <strong>${title}</strong>
          <p>${subtitle}</p>
        </div>
        <span class="meta">${meta}</span>
      </div>
    `;
  };

  const loadAvatar = () => {
    const storedAvatar = window.localStorage.getItem(avatarKey);
    if (storedAvatar && avatarPreview) {
      avatarPreview.src = storedAvatar;
      if (avatarStat) avatarStat.textContent = 'Yes';
    } else if (avatarStat) {
      avatarStat.textContent = 'No';
    }
  };

  const saveAvatar = (dataUrl) => {
    window.localStorage.setItem(avatarKey, dataUrl);
    if (avatarPreview) {
      avatarPreview.src = dataUrl;
    }
    if (avatarStat) {
      avatarStat.textContent = 'Yes';
    }
  };

  const resetAvatar = () => {
    window.localStorage.removeItem(avatarKey);
    if (avatarPreview) {
      avatarPreview.src = '/image/Logo/LogoWebsite.png';
    }
    if (avatarStat) {
      avatarStat.textContent = 'No';
    }
  };

  const hydrateUser = async () => {
    if (!ensureAuthenticated()) {
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const user = response.ok
        ? await response.json()
        : cachedUser
          ? JSON.parse(cachedUser)
          : null;

      if (!user) {
        throw new Error('Unable to load profile');
      }

      if (nameEl) nameEl.textContent = user.name || 'Profile';
      if (emailEl) emailEl.textContent = user.email || 'No email';
      if (roleEl) roleEl.textContent = (user.role || 'customer').toUpperCase();
    } catch (error) {
      if (cachedUser) {
        const user = JSON.parse(cachedUser);
        if (nameEl) nameEl.textContent = user.name || 'Profile';
        if (emailEl) emailEl.textContent = user.email || 'No email';
        if (roleEl) roleEl.textContent = (user.role || 'customer').toUpperCase();
      }
    }
  };

  const hydrateLists = async () => {
    if (!ensureAuthenticated()) {
      return;
    }

    try {
      const [favoritesResponse, historyResponse] = await Promise.all([
        fetch('/api/favorites', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/favorites/history', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const favorites = favoritesResponse.ok ? await favoritesResponse.json() : [];
      const history = historyResponse.ok ? await historyResponse.json() : [];

      if (favoritesStat) favoritesStat.textContent = String(favorites.length);
      if (historyStat) historyStat.textContent = String(history.length);
      if (latestStat) latestStat.textContent = String(history[0]?.result_ids?.length || 0);

      if (favoritesList) {
        favoritesList.innerHTML = favorites.length
          ? favorites.slice(0, 5).map((item) => renderItem(item, 'favorite')).join('')
          : '';
        if (!favorites.length) {
          setEmpty(favoritesList, 'No favorites saved yet. Open Recommend or Food and save a recipe to see it here.');
        }
      }

      if (historyList) {
        historyList.innerHTML = history.length
          ? history.slice(0, 5).map((item) => renderItem(item, 'history')).join('')
          : '';
        if (!history.length) {
          setEmpty(historyList, 'No recommendation history yet. Generate a recipe to create your first session.');
        }
      }
    } catch (error) {
      if (favoritesList) {
        setEmpty(favoritesList, 'Unable to load favorites right now.');
      }
      if (historyList) {
        setEmpty(historyList, 'Unable to load recommendation history right now.');
      }
    }
  };

  if (avatarInput) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files?.[0];
      if (!file) {
        return;
      }

      if (!file.type.startsWith('image/')) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        saveAvatar(String(reader.result || ''));
      };
      reader.readAsDataURL(file);
    });
  }

  if (resetAvatarBtn) {
    resetAvatarBtn.addEventListener('click', resetAvatar);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.localStorage.removeItem(tokenKey);
      window.localStorage.removeItem(userKey);
      window.location.href = '/html/Login.html';
    });
  }

  loadAvatar();
  hydrateUser();
  hydrateLists();
});