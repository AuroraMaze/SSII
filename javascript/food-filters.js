document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('[data-recipe-grid]');
  let cards = Array.from(document.querySelectorAll('.food-card[data-recipe-id]'));
  const filterChips = Array.from(document.querySelectorAll('.filter-chip'));
  const categoryButtons = Array.from(document.querySelectorAll('[data-category-group] .category-item'));
  const dietCheckboxes = Array.from(document.querySelectorAll('[data-diet-group] input[type="checkbox"]'));
  const timeButtons = Array.from(document.querySelectorAll('[data-time-group] .mini-pill'));
  const applyButton = document.querySelector('.apply-button');
  const resetButton = document.querySelector('.reset-button');
  const loadMoreButton = document.querySelector('[data-load-more]');
  const resultCount = document.querySelector('[data-result-count]');
  const footerCount = document.querySelector('[data-footer-count]');

  if (!grid || !cards.length) {
    return;
  }

  const state = {
    category: 'all',
    diets: new Set(),
    time: '',
    extraVisible: false,
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

  const extraTemplateIds = ['bun-bo-hue', 'com-tam-suon', 'banh-xeo'];
  extraTemplateIds.forEach((recipeId) => {
    const sourceCard = cards.find((card) => card.dataset.recipeId === recipeId);
    if (!sourceCard || !grid) {
      return;
    }

    const clonedCard = sourceCard.cloneNode(true);
    clonedCard.dataset.extraCard = 'true';
    clonedCard.classList.add('is-hidden', 'is-extra-card');

    const matchBadge = clonedCard.querySelector('.match-badge');
    if (matchBadge) {
      matchBadge.textContent = 'More matches';
    }

    grid.appendChild(clonedCard);
    cards = Array.from(document.querySelectorAll('.food-card[data-recipe-id]'));
  });

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

  applyFilters();
});