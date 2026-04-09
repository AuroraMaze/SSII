document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('recommendForm');
	const ingredientsInput = document.getElementById('ingredientsInput');
	const tasteInput = document.getElementById('tasteInput');
	const maxTimeInput = document.getElementById('maxTimeInput');
	const dietGoalInput = document.getElementById('dietGoalInput');
	const nutritionGoalInput = document.getElementById('nutritionGoalInput');
	const message = document.getElementById('recommendMessage');
	const results = document.getElementById('recommendResults');
	const resultCount = document.getElementById('resultCount');
	const clearIngredientsBtn = document.getElementById('clearIngredientsBtn');
	const token = window.localStorage.getItem('cookit_access_token');
	const ingredientChips = document.querySelectorAll('.ingredient-chip[data-ingredients]');
	const API_BASE_URL = window.location.origin;

	const parseList = (value) =>
		value
			.split(/[\n,;|]/)
			.map((item) => item.trim())
			.filter(Boolean);

	const setMessage = (text, type = 'error') => {
		if (!message) {
			return;
		}
		message.textContent = text;
		message.classList.toggle('success', type === 'success');
	};

	const renderBadge = (label) => `<span class="chip">${label}</span>`;

	const renderIngredientGroup = (title, className, items) => `
		<div class="match-group ${className}">
			<div class="match-group-title">${title}</div>
			<div class="chips-row">${items.length ? items.map(renderBadge).join('') : '<span class="chip">None</span>'}</div>
		</div>
	`;

	const renderResults = (items) => {
		if (!results) {
			return;
		}

		if (!items.length) {
			results.innerHTML = '<div class="empty-state">No suitable recipes were found. Try different ingredients or relax your filters.</div>';
			return;
		}

		results.innerHTML = items
			.map(
				(item) => `
					<article class="result-card" data-recipe-id="${item.id}">
						<div class="result-image">
							<img src="${item.image || '/image/Logo/VegetableDish.png'}" alt="${item.name}">
						</div>
						<div class="result-body">
							<div class="result-top">
								<span class="score">${item.match_score} match</span>
								<a class="details-btn" href="/html/recipe-detail.html?recipe_id=${item.id}">View details</a>
								<button type="button" class="save-btn" data-recipe-id="${item.id}">Save favorite</button>
							</div>
							<h3>${item.name}</h3>
							<p class="description">${item.description}</p>
							${renderIngredientGroup('What matched', 'matched', item.matched_ingredients)}
							${renderIngredientGroup('Still needed', 'missing', item.missing_ingredients)}
							<p class="reason">${item.reason}</p>
							<div class="nutrition-grid">
								<div class="nutrition-item"><strong>${item.nutrition.calories}</strong><span>Calories</span></div>
								<div class="nutrition-item"><strong>${item.nutrition.protein}g</strong><span>Protein</span></div>
								<div class="nutrition-item"><strong>${item.nutrition.carbs}g</strong><span>Carbs</span></div>
								<div class="nutrition-item"><strong>${item.nutrition.fat}g</strong><span>Fat</span></div>
							</div>
							<div class="meta-row">
								<span>${item.time_minutes} mins</span>
								<span>${item.taste_tags?.join(', ') || 'No taste tags'}</span>
							</div>
							<div class="detail-footer-row">
								<a class="inline-link" href="/html/recipe-detail.html?recipe_id=${item.id}">Open recipe detail</a>
							</div>
						</div>
					</article>
				`,
			)
			.join('');

		results.querySelectorAll('.save-btn').forEach((button) => {
			button.addEventListener('click', async () => {
				if (!token) {
					setMessage('Please sign in first to save favorites.');
					return;
				}

				const recipeId = button.dataset.recipeId;
				button.disabled = true;
				button.textContent = 'Saving...';

				try {
					const response = await fetch('/api/favorites', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({ recipe_id: recipeId }),
					});

					const data = await response.json().catch(() => ({}));
					if (!response.ok) {
						throw new Error(data.detail || 'Unable to save favorite');
					}

					button.textContent = 'Saved';
					setMessage('Recipe saved to favorites.', 'success');
				} catch (error) {
					button.disabled = false;
					button.textContent = 'Save favorite';
					setMessage(error.message || 'Unable to save favorite');
				}
			});
		});
	};

	if (form) {
			form.addEventListener('submit', async (event) => {
				event.preventDefault();
				setMessage('');

				const ingredients = parseList(ingredientsInput.value);
				const tastePreferences = parseList(tasteInput.value);
				const maxTimeValue = maxTimeInput.value ? Number(maxTimeInput.value) : null;
				const dietGoal = dietGoalInput.value || null;
				const nutritionGoal = nutritionGoalInput.value || null;
			if (!ingredients.length) {
				setMessage('Please add at least one ingredient.');
				return;
			}

			try {
				setMessage('Generating recommendations...', 'success');
				const endpoint = `${API_BASE_URL}/api/recommendations/gemini`;
				console.log('Fetching from:', endpoint);
				console.log('Origin:', window.location.origin);
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(token ? { Authorization: `Bearer ${token}` } : {}),
					},
					body: JSON.stringify({
						ingredients,
						taste_preferences: tastePreferences,
						max_time_minutes: maxTimeValue,
						diet_goal: dietGoal,
						nutrition_goal: nutritionGoal,
					}),
				});

				let responseData = null;
				try {
					responseData = await response.json();
				} catch (jsonError) {
					responseData = null;
				}

				if (!response.ok) {
					let serverMessage = 'Unable to generate recommendations';
					if (responseData) {
						serverMessage = responseData.detail || responseData.message || JSON.stringify(responseData);
					} else {
						const text = await response.text().catch(() => '');
						if (text) serverMessage = text;
					}
					throw new Error(`Error ${response.status} ${response.statusText}: ${serverMessage}`);
				}

				const count = Array.isArray(responseData?.results) ? responseData.results.length : 0;
					setMessage(`Generated ${count} recipe suggestion(s)`, 'success');
				if (resultCount) {
					resultCount.textContent = `${count} recipes found`;
				}
				renderResults(responseData?.results || []);
			} catch (error) {
				setMessage(error.message || 'Recommendation failed');
			}
		});
	}

	ingredientChips.forEach((chip) => {
		chip.addEventListener('click', () => {
			const preset = chip.dataset.ingredients || '';
			const existing = ingredientsInput.value.trim();
			ingredientsInput.value = existing ? `${existing}, ${preset}` : preset;
			ingredientsInput.focus();
		});
	});

	if (clearIngredientsBtn) {
		clearIngredientsBtn.addEventListener('click', () => {
			ingredientsInput.value = '';
			ingredientsInput.focus();
		});
	}

	results?.insertAdjacentHTML('beforeend', '<div class="empty-state">Enter ingredients and filters to generate your first recipe suggestions.</div>');
});
