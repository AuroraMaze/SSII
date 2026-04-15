document.addEventListener('DOMContentLoaded', () => {
  const featuredCard = document.querySelector('[data-featured-recipe]');
  const featuredImage = document.querySelector('[data-featured-image]');
  const featuredTag = document.querySelector('[data-featured-tag]');
  const featuredName = document.querySelector('[data-featured-name]');
  const featuredMeta = document.querySelector('[data-featured-meta]');
  const featuredLink = document.querySelector('[data-featured-link]');
  const trendingGrid = document.querySelector('.trending .food-grid');

  if (!featuredCard || !trendingGrid) {
    return;
  }

  const detailUrl = (recipeId) => `/html/recipe-detail.html?recipe_id=${encodeURIComponent(recipeId)}`;

  const shuffle = (items) => {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  };

  const recipeTag = (recipe) => recipe.taste_tags?.[0] || recipe.category || 'Recipe';

  const recipeMeta = (recipe) => {
    const calories = recipe.nutrition?.calories || 0;
    return `${recipe.time_minutes || 0} mins • ${calories} kcal`;
  };

  const applyCardNavigation = (element, recipeId, label) => {
    if (!element || !recipeId) {
      return;
    }

    element.dataset.recipeId = recipeId;
    element.classList.add('clickable-recipe-card');
    element.tabIndex = 0;
    element.setAttribute('role', 'link');
    element.setAttribute('aria-label', `Open details for ${label}`);

    const navigate = () => {
      window.location.href = detailUrl(recipeId);
    };

    element.addEventListener('click', (event) => {
      if (event.target.closest('a, button, input, select, textarea')) {
        return;
      }
      navigate();
    });

    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigate();
      }
    });
  };

  const renderFeaturedRecipe = (recipe) => {
    if (featuredImage) {
      featuredImage.src = recipe.image || '/image/Logo/VegetableDish.png';
      featuredImage.alt = recipe.name;
    }
    if (featuredTag) {
      featuredTag.textContent = recipeTag(recipe);
    }
    if (featuredName) {
      featuredName.textContent = recipe.name;
    }
    if (featuredMeta) {
      featuredMeta.textContent = recipeMeta(recipe);
    }
    if (featuredLink) {
      featuredLink.href = detailUrl(recipe.id);
    }

    applyCardNavigation(featuredCard, recipe.id, recipe.name);
  };

  const renderTrendingRecipes = (recipes) => {
    trendingGrid.innerHTML = recipes.map((recipe) => `
      <article class="food-card" data-recipe-id="${recipe.id}">
        <img src="${recipe.image || '/image/Logo/VegetableDish.png'}" alt="${recipe.name}">
        <div class="trend-info">
          <span class="badge small">${recipeTag(recipe)}</span>
          <h4>${recipe.name}</h4>
          <div class="meta">${recipeMeta(recipe)}</div>
        </div>
      </article>
    `).join('');

    trendingGrid.querySelectorAll('.food-card[data-recipe-id]').forEach((card) => {
      const recipeId = card.dataset.recipeId;
      const label = card.querySelector('h4')?.textContent || 'recipe';
      applyCardNavigation(card, recipeId, label);
    });
  };

  const renderErrorState = () => {
    if (featuredName) {
      featuredName.textContent = 'Recipe preview unavailable';
    }
    if (featuredMeta) {
      featuredMeta.textContent = 'Open the food library while the live feed recovers.';
    }
    if (featuredLink) {
      featuredLink.href = '/html/food.html';
    }
  };

  const loadHomeRecipes = async () => {
    try {
      const response = await fetch('/api/recipes');
      if (!response.ok) {
        throw new Error('Unable to load home recipes');
      }

      const recipes = await response.json();
      if (!Array.isArray(recipes) || recipes.length === 0) {
        throw new Error('No home recipes available');
      }

      const randomized = shuffle(recipes);
      renderFeaturedRecipe(randomized[0]);
      renderTrendingRecipes(randomized.slice(1, 4).length ? randomized.slice(1, 4) : randomized.slice(0, 3));
    } catch (error) {
      console.error('Home recipe load failed:', error);
      renderErrorState();
    }
  };

  loadHomeRecipes();
});
