document.addEventListener('DOMContentLoaded', () => {
	const dropdownItems = document.querySelectorAll('.has-dropdown');

	dropdownItems.forEach((item) => {
		const trigger = item.querySelector(':scope > a');
		if (!trigger) {
			return;
		}

		trigger.addEventListener('click', (event) => {
			if (window.innerWidth > 1024) {
				return;
			}

			event.preventDefault();
			const isOpen = item.classList.contains('open');
			dropdownItems.forEach((dropdown) => dropdown.classList.remove('open'));
			if (!isOpen) {
				item.classList.add('open');
			}
		});
	});

	document.addEventListener('click', (event) => {
		if (!event.target.closest('.has-dropdown')) {
			dropdownItems.forEach((item) => item.classList.remove('open'));
		}
	});
});
