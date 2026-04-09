document.addEventListener('DOMContentLoaded', () => {
	const token = window.localStorage.getItem('cookit_access_token');
	const message = document.getElementById('historyMessage');
	const favoritesGrid = document.getElementById('favoritesGrid');
	const historyGrid = document.getElementById('historyGrid');
	const favoritesCount = document.getElementById('favoritesCount');
	const historyCount = document.getElementById('historyCount');
	const latestCount = document.getElementById('latestCount');
	const tabButtons = document.querySelectorAll('[data-view]');
	const views = {
		favorites: document.getElementById('favoritesView'),
		recent: document.getElementById('recentView'),
		created: document.getElementById('createdView'),
	};

	const setMessage = (text, type = 'error') => {
		if (!message) {
			return;
		}
		message.textContent = text;
		message.classList.toggle('success', type === 'success');
	};

	const renderFavoriteCard = (item) => {
		return `
			<article class="recipe-card" data-recipe-id="${item.id}">
				<div class="card-image card-image-cover">
					${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<i class="fas fa-camera"></i><span>Image placeholder</span>'}
				</div>
				<h3>${item.name}</h3>
				<div class="recipe-meta">${item.time_minutes || 0} mins • <span class="difficulty">${item.diet_tags?.[0] || 'Customer'}</span></div>
				<div class="pinned-badge"><i class="fas fa-thumbtack"></i> PINNED</div>
				<div class="recipe-actions">
					<a href="/html/recipe-detail.html?recipe_id=${item.id}" class="recipe-action-link detail-link">View details</a>
					<a href="/html/recommend.html" class="recipe-action-link">Open recommendation</a>
					<button type="button" class="remove-btn" data-recipe-id="${item.id}">Remove</button>
				</div>
			</article>
		`;
	};

	const renderHistoryCard = (entry, recipe) => {
		const ingredients = entry.query?.ingredients || [];
		const filterText = [entry.query?.diet_goal, entry.query?.nutrition_goal, entry.query?.max_time_minutes ? `${entry.query.max_time_minutes} mins` : null].filter(Boolean).join(' • ');
		return `
			<article class="recipe-card" data-recipe-id="${recipe?.id || entry.id}">
				<div class="card-image card-image-cover">
					${recipe?.image ? `<img src="${recipe.image}" alt="${recipe.name}">` : '<i class="fas fa-camera"></i><span>Image placeholder</span>'}
				</div>
				<h3>${recipe?.name || 'Saved recommendation'}</h3>
				<div class="recipe-meta">${entry.result_ids?.length || 0} recipes • <span class="difficulty">${filterText || 'Recent query'}</span></div>
				<div class="pinned-badge"><i class="fas fa-clock"></i> ${entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'RECENT'}</div>
				<div class="recipe-actions">
					<a href="/html/recipe-detail.html?recipe_id=${recipe?.id || entry.id}" class="recipe-action-link detail-link">View details</a>
					<a href="/html/recommend.html" class="recipe-action-link">Run again</a>
				</div>
				<div class="history-preview">
					${ingredients.length ? ingredients.map((ingredient) => `<span class="chip">${ingredient}</span>`).join('') : '<span class="chip">No ingredients saved</span>'}
				</div>
			</article>
		`;
	};

	const setActiveView = (viewName) => {
		Object.entries(views).forEach(([name, element]) => {
			if (!element) {
				return;
			}
			element.classList.toggle('hidden', name !== viewName);
		});
		tabButtons.forEach((button) => {
			button.classList.toggle('active', button.dataset.view === viewName);
		});
	};

	tabButtons.forEach((button) => {
		button.addEventListener('click', () => setActiveView(button.dataset.view));
	});

	if (!token) {
		setMessage('Please sign in to view your favorites and recommendation history.');
		if (favoritesGrid) {
			favoritesGrid.innerHTML = '<div class="empty-state">No session detected. Sign in to see pinned recipes.</div>';
		}
		if (historyGrid) {
			historyGrid.innerHTML = '<div class="empty-state">No session detected. Sign in to see recent recommendations.</div>';
		}
		return;
	}

	const loadData = async () => {
		try {
			const [favoritesResponse, historyResponse] = await Promise.all([
				fetch('/api/favorites', { headers: { Authorization: `Bearer ${token}` } }),
				fetch('/api/favorites/history', { headers: { Authorization: `Bearer ${token}` } }),
			]);

			const favorites = await favoritesResponse.json().catch(() => []);
			const history = (await historyResponse.json().catch(() => [])).sort((left, right) => {
				const leftDate = new Date(left.created_at || 0).getTime();
				const rightDate = new Date(right.created_at || 0).getTime();
				return rightDate - leftDate;
			});
			const recipesResponse = await fetch('/api/recipes');
			const recipes = await recipesResponse.json().catch(() => []);
			const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));

			if (favoritesGrid) {
				favoritesGrid.innerHTML = favorites.length
					? favorites.map((entry) => renderFavoriteCard(entry.recipe)).join('')
					: '<div class="empty-state">No favorites yet. Save recipes from the recommendation page.</div>';
				favoritesGrid.querySelectorAll('.remove-btn').forEach((button) => {
					button.addEventListener('click', async () => {
						const recipeId = button.dataset.recipeId;
						button.disabled = true;
						button.textContent = 'Removing...';
						try {
							const response = await fetch(`/api/favorites/${recipeId}`, {
								method: 'DELETE',
								headers: { Authorization: `Bearer ${token}` },
							});

							const data = await response.json().catch(() => ({}));
							if (!response.ok) {
								throw new Error(data.detail || 'Unable to remove favorite');
							}

							await loadData();
							setMessage('Favorite removed.', 'success');
						} catch (error) {
							button.disabled = false;
							button.textContent = 'Remove';
							setMessage(error.message || 'Unable to remove favorite');
						}
					});
				});
			}

			if (historyGrid) {
				historyGrid.innerHTML = history.length
					? history
						.map((entry) => {
							const topRecipeId = entry.result_ids?.[0];
							const recipe = recipeMap.get(topRecipeId) || {
								id: topRecipeId || entry.id,
								name: 'Saved recommendation',
								time_minutes: entry.query?.max_time_minutes || 0,
								image: '/image/Logo/VegetableDish.png',
								diet_tags: [entry.query?.diet_goal || 'customer'],
							};
							return renderHistoryCard(entry, recipe);
						})
						.join('')
					: '<div class="empty-state">Your latest recommendation queries will appear here.</div>';
			}

			if (favoritesCount) {
				favoritesCount.textContent = String(favorites.length);
			}
			if (historyCount) {
				historyCount.textContent = String(history.length);
			}
			if (latestCount) {
				latestCount.textContent = history[0]?.result_ids?.length ? String(history[0].result_ids.length) : '0';
			}

			setMessage('Your saved recipes are ready.', 'success');
		} catch (error) {
			setMessage(error.message || 'Unable to load history');
		}
	};

	loadData();
});
