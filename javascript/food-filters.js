document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('[data-recipe-grid]');
  let cards = [];
  let allRecipes = [];
  const categoryButtons = Array.from(document.querySelectorAll('[data-category-group] .category-item'));
  const dietCheckboxes = Array.from(document.querySelectorAll('[data-diet-group] input[type="checkbox"]'));
  const timeButtons = Array.from(document.querySelectorAll('[data-time-group] .mini-pill'));
  const applyButton = document.querySelector('.apply-button');
  const resetButton = document.querySelector('.reset-button');
  const loadMoreButton = document.querySelector('[data-load-more]');
  const resultCount = document.querySelector('[data-result-count]');
  const footerCount = document.querySelector('[data-footer-count]');
  const maxResultsSelect = document.querySelector('#max-results');

  if (!grid) {
    return;
  }

  const state = {
    category: 'all',
    diets: new Set(),
    time: '',
    maxResults: 12,
  };

  const showEmptyState = (message) => {
    grid.innerHTML = '';
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = message;
    grid.appendChild(emptyState);
  };

  const normalizeList = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const setActiveButton = (buttons, activeButton) => {
    buttons.forEach((button) => {
      button.classList.toggle('active', button === activeButton);
    });
  };

  const formatRecipeTime = (minutes) => {
    if (!minutes || Number.isNaN(Number(minutes))) {
      return '45-plus';
    }
    const value = Number(minutes);
    if (value <= 30) return 'under-30';
    if (value <= 45) return '30-45';
    return '45-plus';
  };

  const renderRecipeCard = (recipe) => {
    const detailUrl = `/html/recipe-detail.html?recipe_id=${encodeURIComponent(recipe.id)}`;
    const timeLabel = formatRecipeTime(recipe.time_minutes);
    const diets = recipe.diet_tags?.join(',') || '';
    const tags = recipe.taste_tags?.join(',') || '';
    const category = (recipe.category || 'all').toLowerCase();
    const minutes = recipe.time_minutes || 0;
    const nutrition = recipe.nutrition || {};
    const calories = nutrition.calories || 0;
    const protein = nutrition.protein || 0;
    const carbs = nutrition.carbs || 0;
    const fat = nutrition.fat || 0;

    return `
      <article class="food-card" data-recipe-id="${recipe.id}" data-category="${category}" data-diets="${diets}" data-time="${timeLabel}" data-tags="${tags}" style="cursor: pointer;" data-detail-url="${detailUrl}">
        <div class="card-media">
          <span class="match-badge">Recipe</span>
          <button class="card-favorite" type="button" aria-label="Save ${recipe.name}"><i class="fa-regular fa-heart"></i></button>
          <img src="${recipe.image || '/image/Logo/VegetableDish.png'}" alt="${recipe.name}">
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <h4>${recipe.name}</h4>
            <span class="card-rating"><i class="fa-solid fa-star"></i> 4.6</span>
          </div>
          <div class="card-meta-row">
            <span><i class="fa-regular fa-clock"></i> ${minutes}m</span>
            <span class="difficulty">${category || 'Recipe'}</span>
          </div>
          <div class="card-nutrition">
            <div class="nutrition-item">
              <span class="nutrition-value">${calories}</span>
              <span class="nutrition-label">cal</span>
            </div>
            <div class="nutrition-item">
              <span class="nutrition-value">${protein}g</span>
              <span class="nutrition-label">protein</span>
            </div>
            <div class="nutrition-item">
              <span class="nutrition-value">${carbs}g</span>
              <span class="nutrition-label">carbs</span>
            </div>
            <div class="nutrition-item">
              <span class="nutrition-value">${fat}g</span>
              <span class="nutrition-label">fat</span>
            </div>
          </div>
        </div>
      </article>
    `;
  };

  const loadRecipes = async () => {
    try {
      const selectedDiets = Array.from(state.diets).join(',');
      const queryParams = new URLSearchParams();
      if (state.category && state.category !== 'all') {
        queryParams.set('category', state.category);
      }
      if (selectedDiets) {
        queryParams.set('diet', selectedDiets);
      }
      queryParams.set('limit', state.maxResults.toString());

      const endpoint = `/api/recipes/browse?${queryParams.toString()}`;
      console.log('🔍 Loading recipes from:', endpoint);
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        let message = 'Unable to load recipes right now.';
        try {
          const errorPayload = await response.json();
          if (errorPayload?.detail) {
            message = errorPayload.detail;
          }
        } catch (parseError) {
          const errorText = await response.text().catch(() => '');
          if (errorText) {
            message = errorText;
          }
        }
        throw new Error(message);
      }
      const recipes = await response.json();
      console.log(`✅ Loaded ${recipes.length} recipes from diverse sources`);
      if (!Array.isArray(recipes) || recipes.length === 0) {
        showEmptyState('No recipes are available from Edamam right now. Check the API credentials or try different filters.');
        allRecipes = [];
        cards = [];
        updateResultText(0);
        return;
      }
      allRecipes = recipes;
      renderRecipes();
    } catch (error) {
      console.error('Recipe loading failed:', error);
      showEmptyState(error.message || 'Unable to load recipes right now.');
      allRecipes = [];
      cards = [];
      updateResultText(0);
    }
  };

  const renderRecipes = () => {
    grid.innerHTML = allRecipes.map(renderRecipeCard).join('');
    cards = Array.from(grid.querySelectorAll('.food-card[data-recipe-id]'));
    applyFilters();
  };

  const updateResultText = (visibleCount) => {
    const total = cards.length;
    const label = `Showing ${visibleCount} of ${total} matches`;
    if (resultCount) {
      resultCount.textContent = label;
    }
    if (footerCount) {
      footerCount.textContent = label;
    }
  };

  const applyFilters = () => {
    let visibleCount = 0;

    cards.forEach((card, index) => {
      const cardCategory = (card.dataset.category || 'all').toLowerCase();
      const cardDiets = normalizeList(card.dataset.diets);
      const cardTime = (card.dataset.time || '').toLowerCase();

      const categoryMatch = state.category === 'all' || cardCategory === state.category;
      const dietMatch = state.diets.size === 0 || [...state.diets].some((diet) => cardDiets.includes(diet));
      const timeMatch = !state.time || cardTime === state.time;

      const shouldShow = categoryMatch && dietMatch && timeMatch;
      card.classList.toggle('is-hidden', !shouldShow);

      if (shouldShow) {
        visibleCount += 1;
      }
    });

    updateResultText(visibleCount);
  };

  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.category = button.dataset.category || 'all';
      setActiveButton(categoryButtons, button);
      
      // Reload recipes for new category
      loadRecipes().then(() => applyFilters());
    });
  });

  dietCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const diet = checkbox.value.trim().toLowerCase();
      if (checkbox.checked) {
        state.diets.add(diet);
      } else {
        state.diets.delete(diet);
      }
      // Reload recipes with new diet filters
      loadRecipes().then(() => applyFilters());
    });
  });

  timeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.time = button.dataset.time || 'under-30';
      setActiveButton(timeButtons, button);
      applyFilters();
    });
  });

  if (applyButton) {
    applyButton.addEventListener('click', () => {
      applyFilters();
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      state.category = 'all';
      state.diets = new Set();
      state.time = '';
      state.maxResults = 12;

      setActiveButton(categoryButtons, categoryButtons[0]);
      timeButtons.forEach((button) => button.classList.remove('active'));

      dietCheckboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });

      if (maxResultsSelect) {
        maxResultsSelect.value = '12';
      }

      // Reload all recipes
      loadRecipes().then(() => applyFilters());
    });
  }

  if (loadMoreButton) {
    loadMoreButton.addEventListener('click', () => {
      // Load more recipes with current filters
      loadRecipes();
    });
  }

  if (maxResultsSelect) {
    maxResultsSelect.addEventListener('change', (e) => {
      state.maxResults = parseInt(e.target.value, 10) || 12;
      console.log(`📊 Max results changed to: ${state.maxResults}`);
      loadRecipes();
    });
  }

  grid.addEventListener('click', (event) => {
    const favoriteButton = event.target.closest('.card-favorite');
    if (favoriteButton) {
      // Handle favorite button click
      event.stopPropagation();
      const saved = favoriteButton.classList.toggle('is-saved');
      const icon = favoriteButton.querySelector('i');
      if (icon) {
        icon.className = saved ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      }
      return;
    }

    // Handle card click for navigation
    const card = event.target.closest('.food-card');
    if (card) {
      const detailUrl = card.dataset.detailUrl;
      if (detailUrl) {
        window.location.href = detailUrl;
      }
    }
  });

  // Initial load with diverse recipes
  loadRecipes();
});
