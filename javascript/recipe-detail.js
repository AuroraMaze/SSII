document.addEventListener('DOMContentLoaded', () => {
	const shell = document.getElementById('detailShell');
	const params = new URLSearchParams(window.location.search);
	const recipeId = params.get('recipe_id');
	const token = window.localStorage.getItem('cookit_access_token');

	const renderChipRow = (items) => {
		if (!items?.length) {
			return '<div class="chip-row"><span class="chip">None</span></div>';
		}
		return `<div class="chip-row">${items.map((item) => `<span class="chip">${item}</span>`).join('')}</div>`;
	};

	const renderPage = (recipe) => {
		shell.innerHTML = `
			<article class="detail-card">
				<div class="detail-hero">
					<div class="detail-media">
						<img src="${recipe.image || '/image/Logo/VegetableDish.png'}" alt="${recipe.name}">
					</div>
					<div class="detail-badges">
						<span class="detail-kicker">Recipe detail</span>
						${recipe.taste_tags?.slice(0, 2).map((tag) => `<span class="detail-kicker">${tag}</span>`).join('') || ''}
					</div>
					<h1>${recipe.name}</h1>
					<p class="detail-description">${recipe.description}</p>
					<div class="detail-meta">
						<span class="meta-pill"><i class="fa-solid fa-clock"></i> ${recipe.time_minutes} mins</span>
						<span class="meta-pill"><i class="fa-solid fa-fire"></i> ${recipe.nutrition.calories} kcal</span>
						<span class="meta-pill"><i class="fa-solid fa-utensils"></i> ${recipe.nutrition.protein}g protein</span>
						<span class="meta-pill"><i class="fa-solid fa-pepper-hot"></i> ${recipe.taste_tags?.join(', ') || 'Customer recipe'}</span>
					</div>
					<div class="detail-actions">
						<button class="primary-btn" id="saveFavoriteBtn" type="button">Save favorite</button>
						${recipe.source_url ? `<a class="ghost-btn" href="${recipe.source_url}" target="_blank" rel="noopener noreferrer">Open source recipe</a>` : ''}
						<a class="ghost-btn" href="/html/recommend.html">Generate similar</a>
						<a class="ghost-btn" href="/html/history.html">Back to history</a>
					</div>
				</div>
			</article>
			<aside class="side-card">
				<section class="panel-block">
					<h2>Nutrition</h2>
					<div class="nutrition-grid">
						<div class="nutrition-item"><strong>${recipe.nutrition.calories}</strong><span>Calories</span></div>
						<div class="nutrition-item"><strong>${recipe.nutrition.protein}g</strong><span>Protein</span></div>
						<div class="nutrition-item"><strong>${recipe.nutrition.carbs}g</strong><span>Carbs</span></div>
						<div class="nutrition-item"><strong>${recipe.nutrition.fat}g</strong><span>Fat</span></div>
					</div>
				</section>

				<section class="panel-block">
					<h3>Ingredients</h3>
					${renderChipRow(recipe.ingredients)}
				</section>

				<section class="panel-block">
					<h3>Instructions</h3>
					<div class="list-stack">
						${recipe.steps.map((step, index) => `<div class="stack-item"><span class="stack-index">${index + 1}</span><div class="stack-text">${step}</div></div>`).join('')}
					</div>
				</section>

				<section class="panel-block">
					<h3>Why this recipe?</h3>
					<p class="detail-footer-note">This recipe comes from the live Edamam catalog. Nutrition is estimated by Edamam, while full instructions stay on the original publisher page.</p>
				</section>
			</aside>
		`;

		const saveButton = document.getElementById('saveFavoriteBtn');
		if (saveButton) {
			saveButton.addEventListener('click', async () => {
				if (!token) {
					window.location.href = '/html/Login.html';
					return;
				}

				saveButton.disabled = true;
				saveButton.textContent = 'Saving...';
				try {
					const response = await fetch('/api/favorites', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({ recipe_id: recipe.id }),
					});

					const data = await response.json().catch(() => ({}));
					if (!response.ok) {
						throw new Error(data.detail || 'Unable to save favorite');
					}

					saveButton.textContent = 'Saved';
				} catch (error) {
					saveButton.disabled = false;
					saveButton.textContent = 'Save favorite';
					saveButton.title = error.message || 'Unable to save favorite';
				}
			});
		}
	};

	const renderError = (text) => {
		shell.innerHTML = `<div class="detail-error">${text}</div>`;
	};

	const loadRecipe = async () => {
		if (!recipeId) {
			renderError('Missing recipe id. Go back and select a dish first.');
			return;
		}

		try {
			const response = await fetch(`/api/recipes/${encodeURIComponent(recipeId)}`);
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data.detail || 'Recipe not found');
			}
			renderPage(data);
		} catch (error) {
			renderError(error.message || 'Unable to load recipe details');
		}
	};

	loadRecipe();
});
