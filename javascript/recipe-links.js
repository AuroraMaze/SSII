document.addEventListener('DOMContentLoaded', () => {
	const cards = document.querySelectorAll('[data-recipe-id]');

	cards.forEach((card) => {
		const recipeId = card.dataset.recipeId;
		if (!recipeId) {
			return;
		}

		card.classList.add('clickable-recipe-card');
		if (!card.hasAttribute('tabindex')) {
			card.tabIndex = 0;
		}
		card.setAttribute('role', 'link');
		card.setAttribute('aria-label', `Open details for ${card.querySelector('h4, h3')?.textContent || 'recipe'}`);

		const navigate = () => {
			window.location.href = `/html/recipe-detail.html?recipe_id=${encodeURIComponent(recipeId)}`;
		};

		card.addEventListener('click', (event) => {
			if (event.target.closest('a, button, input, select, textarea')) {
				return;
			}
			navigate();
		});

		card.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				navigate();
			}
		});
	});

	document.addEventListener('click', (event) => {
		const card = event.target.closest('[data-recipe-id]');
		if (!card || event.target.closest('a, button, input, select, textarea')) {
			return;
		}

		const recipeId = card.dataset.recipeId;
		if (!recipeId) {
			return;
		}

		window.location.href = `/html/recipe-detail.html?recipe_id=${encodeURIComponent(recipeId)}`;
	});
});
