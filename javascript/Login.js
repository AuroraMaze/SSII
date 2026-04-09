document.addEventListener('DOMContentLoaded', () => {
	const container = document.getElementById('container');
	const signUpButton = document.getElementById('signUp');
	const signInButton = document.getElementById('signIn');
	const signUpForm = document.getElementById('signUpForm');
	const signInForm = document.getElementById('signInForm');
	const signUpMessage = document.getElementById('signUpMessage');
	const signInMessage = document.getElementById('signInMessage');
	const authTokenKey = 'cookit_access_token';
	const authUserKey = 'cookit_current_user';
	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	if (signUpButton && container) {
		signUpButton.addEventListener('click', () => {
			container.classList.add('right-panel-active');
		});
	}

	if (signInButton && container) {
		signInButton.addEventListener('click', () => {
			container.classList.remove('right-panel-active');
		});
	}

	const showMessage = (element, message, type = 'error') => {
		if (!element) {
			return;
		}
		element.textContent = message;
		element.classList.toggle('success', type === 'success');
	};

	const formatApiError = (detail, fallback) => {
		if (typeof detail === 'string') {
			return detail;
		}

		if (Array.isArray(detail)) {
			const messages = detail
				.map((item) => {
					if (typeof item === 'string') {
						return item;
					}

					if (item && typeof item === 'object') {
						if (item.msg) {
							return item.msg;
						}

						if (item.message) {
							return item.message;
						}

						if (Array.isArray(item.loc)) {
							const field = item.loc[item.loc.length - 1];
							return field ? `${field}: ${item.msg || 'Invalid value'}` : item.msg || 'Invalid value';
						}
					}

					return null;
				})
				.filter(Boolean);

			if (messages.length) {
				return messages.join(', ');
			}
		}

		if (detail && typeof detail === 'object') {
			return detail.message || detail.error || fallback;
		}

		return fallback;
	};

	const validateSignIn = (email, password) => {
		if (!email) {
			return 'Please enter your email.';
		}
		if (!emailPattern.test(email)) {
			return 'Please enter a valid email address.';
		}
		if (!password) {
			return 'Please enter your password.';
		}
		return '';
	};

	const validateSignUp = (name, email, password) => {
		if (!name) {
			return 'Please enter your name.';
		}
		if (name.length < 2) {
			return 'Name must be at least 2 characters.';
		}
		if (!email) {
			return 'Please enter your email.';
		}
		if (!emailPattern.test(email)) {
			return 'Please enter a valid email address.';
		}
		if (!password) {
			return 'Please enter a password.';
		}
		if (password.length < 6) {
			return 'Password must be at least 6 characters.';
		}
		return '';
	};

	const saveSession = (payload) => {
		window.localStorage.setItem(authTokenKey, payload.access_token);
		window.localStorage.setItem(authUserKey, JSON.stringify(payload.user));
	};

	const submitJson = async (url, body) => {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			throw new Error(formatApiError(data.detail, 'Something went wrong'));
		}

		return data;
	};

	if (signUpForm) {
		signUpForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			showMessage(signUpMessage, '');

			const name = document.getElementById('signUpName').value.trim();
			const email = document.getElementById('signUpEmail').value.trim();
			const password = document.getElementById('signUpPassword').value;
			const validationError = validateSignUp(name, email, password);

			if (validationError) {
				showMessage(signUpMessage, validationError);
				return;
			}

			try {
				const data = await submitJson('/api/auth/register', { name, email, password });
				saveSession(data);
				showMessage(signUpMessage, 'Sign up successful. Redirecting...', 'success');
				window.location.href = '/html/home.html';
			} catch (error) {
				showMessage(signUpMessage, error.message || 'Sign up failed. Please try again.');
			}
		});
	}

	if (signInForm) {
		signInForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			showMessage(signInMessage, '');

			const email = document.getElementById('signInEmail').value.trim();
			const password = document.getElementById('signInPassword').value;
			const validationError = validateSignIn(email, password);

			if (validationError) {
				showMessage(signInMessage, validationError);
				return;
			}

			try {
				const data = await submitJson('/api/auth/login', { email, password });
				saveSession(data);
				window.location.href = '/html/home.html';
			} catch (error) {
				showMessage(signInMessage, error.message || 'Sign in failed. Please check your email and password.');
			}
		});
	}

	if (window.localStorage.getItem(authTokenKey) && window.location.pathname.endsWith('/Login.html')) {
		window.location.href = '/html/home.html';
	}
});
