document.addEventListener('DOMContentLoaded', () => {
	// Handle navbar search
	const searchInput = document.querySelector('.navbar .search input');
	const searchIcon = document.querySelector('.navbar .search i');

	if (searchInput) {
		const performSearch = () => {
			const searchTerm = searchInput.value.trim();
			if (searchTerm.length > 0) {
				// Redirect to recommend page with search term as query parameter
				window.location.href = `/html/recommend.html?ingredients=${encodeURIComponent(searchTerm)}`;
			}
		};

		// Search when clicking the search icon
		if (searchIcon) {
			searchIcon.addEventListener('click', performSearch);
		}

		// Search when pressing Enter in the input
		searchInput.addEventListener('keypress', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				performSearch();
			}
		});
	}

	// Handle AI Recipe Generator search box in hero section (only on home page)
	const heroSearchInput = document.querySelector('.ai-search .search-box input');
	const generateBtn = document.querySelector('.ai-search .search-box .btn.generate');

	if (generateBtn && heroSearchInput) {
		const performHeroSearch = () => {
			const searchTerm = heroSearchInput.value.trim();
			if (searchTerm.length > 0) {
				// Redirect to recommend page with search term as query parameter
				window.location.href = `/html/recommend.html?ingredients=${encodeURIComponent(searchTerm)}`;
			}
		};

		// Search when clicking the Generate button
		generateBtn.addEventListener('click', performHeroSearch);

		// Search when pressing Enter in the input
		heroSearchInput.addEventListener('keypress', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				performHeroSearch();
			}
		});
	}

	// Handle URL parameters on recommend page
	const urlParams = new URLSearchParams(window.location.search);
	const searchIngredients = urlParams.get('ingredients');
	if (searchIngredients) {
		const ingredientsInput = document.getElementById('ingredientsInput');
		if (ingredientsInput) {
			ingredientsInput.value = decodeURIComponent(searchIngredients);
		}
	}
});


