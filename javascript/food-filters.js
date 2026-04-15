document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('[data-recipe-grid]');
  let cards = [];
  const filterChips = Array.from(document.querySelectorAll('.filter-chip'));
  const categoryButtons = Array.from(document.querySelectorAll('[data-category-group] .category-item'));
  const dietCheckboxes = Array.from(document.querySelectorAll('[data-diet-group] input[type="checkbox"]'));
  const timeButtons = Array.from(document.querySelectorAll('[data-time-group] .mini-pill'));
  const applyButton = document.querySelector('.apply-button');
  const resetButton = document.querySelector('.reset-button');
  const loadMoreButton = document.querySelector('[data-load-more]');
  const resultCount = document.querySelector('[data-result-count]');
  const footerCount = document.querySelector('[data-footer-count]');

  if (!grid) {
    return;
  }

  const state = {
    category: 'all',
    diets: new Set(),
    time: '',
    extraVisible: false,
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
      <article class="food-card" data-recipe-id="${recipe.id}" data-category="${category}" data-diets="${diets}" data-time="${timeLabel}" data-tags="${tags}">
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
          <div class="detail-footer-row">
            <a class="inline-link" href="${detailUrl}">View details</a>
          </div>
        </div>
      </article>
    `;
  };

  const loadRecipes = async () => {
    try {
      const response = await fetch('/api/recipes');
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
      if (!Array.isArray(recipes) || recipes.length === 0) {
        showEmptyState('No recipes are available from Edamam right now. Check the API credentials or upstream response.');
        cards = [];
        updateResultText(0);
        return;
      }
      grid.innerHTML = recipes.map(renderRecipeCard).join('');
      cards = Array.from(grid.querySelectorAll('.food-card[data-recipe-id]'));
      updateResultText(cards.length);
    } catch (error) {
      console.error('Recipe loading failed:', error);
      showEmptyState(error.message || 'Unable to load recipes right now.');
      cards = [];
      updateResultText(0);
    }
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
      const isExtraCard = card.dataset.extraCard === 'true';
      const cardCategory = (card.dataset.category || 'all').toLowerCase();
      const cardDiets = normalizeList(card.dataset.diets);
      const cardTime = (card.dataset.time || '').toLowerCase();

      const categoryMatch = state.category === 'all' || cardCategory === state.category;
      const dietMatch = state.diets.size === 0 || [...state.diets].every((diet) => cardDiets.includes(diet));
      const timeMatch = !state.time || cardTime === state.time;
      const extraMatch = !isExtraCard || state.extraVisible;

      const shouldShow = categoryMatch && dietMatch && timeMatch && extraMatch;
      card.classList.toggle('is-hidden', !shouldShow);

      if (shouldShow) {
        visibleCount += 1;
      }
    });

    updateResultText(visibleCount);

    if (loadMoreButton) {
      loadMoreButton.textContent = state.extraVisible ? 'Show Fewer Recommendations' : 'Load More Recommendations';
    }
  };

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const label = chip.textContent.trim().toLowerCase();

      filterChips.forEach((item) => item.classList.remove('active'));
      chip.classList.add('active');

      const categoryMap = {
        'all recipes': 'all',
        breakfast: 'breakfast',
        lunch: 'lunch',
        dinner: 'dinner',
        desserts: 'dessert',
        'quick meals': 'quick',
      };

      state.category = categoryMap[label] || 'all';
      const matchingCategoryButton = categoryButtons.find((button) => button.dataset.category === state.category) || categoryButtons[0];
      setActiveButton(categoryButtons, matchingCategoryButton);
      applyFilters();
    });
  });

  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.category = button.dataset.category || 'all';
      setActiveButton(categoryButtons, button);

      const matchingChip = filterChips.find((chip) => {
        const text = chip.textContent.trim().toLowerCase();
        const chipMap = {
          'all recipes': 'all',
          breakfast: 'breakfast',
          lunch: 'lunch',
          dinner: 'dinner',
          desserts: 'dessert',
          'quick meals': 'quick',
        };
        return chipMap[text] === state.category;
      }) || filterChips[0];

      setActiveButton(filterChips, matchingChip);
      applyFilters();
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
      applyFilters();
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
      state.extraVisible = true;

      setActiveButton(filterChips, filterChips[0]);
      setActiveButton(categoryButtons, categoryButtons[0]);
      timeButtons.forEach((button) => button.classList.remove('active'));

      dietCheckboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });

      applyFilters();
    });
  }

  if (loadMoreButton) {
    loadMoreButton.addEventListener('click', () => {
      state.extraVisible = !state.extraVisible;
      applyFilters();
    });
  }

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('.card-favorite');
    if (!button) {
      return;
    }

    event.stopPropagation();
    const saved = button.classList.toggle('is-saved');
    const icon = button.querySelector('i');
    if (icon) {
      icon.className = saved ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    }
  });

  loadRecipes().then(() => {
    applyFilters();
  });
});
