document.addEventListener('DOMContentLoaded', () => {
	const container = document.getElementById('container');
	const signUpButton = document.getElementById('signUp');
	const signInButton = document.getElementById('signIn');
	const signUpForm = document.getElementById('signUpForm');
	const signInForm = document.getElementById('signInForm');
	const signUpMessage = document.getElementById('signUpMessage');
	const signInMessage = document.getElementById('signInMessage');
	const signUpGoogleSlot = document.getElementById('signUpGoogleSlot');
	const signInGoogleSlot = document.getElementById('signInGoogleSlot');
	const facebookButtons = document.querySelectorAll('[data-provider="facebook"]');
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

	const getActiveMessageElement = () => (
		container?.classList.contains('right-panel-active') ? signUpMessage : signInMessage
	);

	const showMessage = (element, message, type = 'error') => {
		if (!element) {
			return;
		}
		element.textContent = message;
		element.classList.toggle('success', type === 'success');
	};

	const clearMessages = () => {
		showMessage(signUpMessage, '');
		showMessage(signInMessage, '');
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

	const submitSocialToken = async (provider, token) => {
		const targetMessage = getActiveMessageElement();
		showMessage(targetMessage, `Signing in with ${provider}...`, 'success');

		try {
			const data = await submitJson(`/api/auth/social/${provider.toLowerCase()}`, { token });
			saveSession(data);
			showMessage(targetMessage, 'Sign in successful. Redirecting...', 'success');
			window.location.href = '/html/home.html';
		} catch (error) {
			showMessage(targetMessage, error.message || `Unable to sign in with ${provider}.`);
		}
	};

	const loadScript = (src, id) => new Promise((resolve, reject) => {
		const existing = id ? document.getElementById(id) : null;
		if (existing) {
			resolve(existing);
			return;
		}

		const script = document.createElement('script');
		script.src = src;
		script.async = true;
		if (id) {
			script.id = id;
		}
		script.onload = () => resolve(script);
		script.onerror = () => reject(new Error(`Failed to load ${src}`));
		document.head.appendChild(script);
	});

	const renderGoogleButtons = async (clientId) => {
		if (!clientId || !signInGoogleSlot || !signUpGoogleSlot) {
			signInGoogleSlot?.classList.add('is-hidden');
			signUpGoogleSlot?.classList.add('is-hidden');
			return;
		}

		try {
			await loadScript('https://accounts.google.com/gsi/client', 'google-identity-services');
			if (!window.google?.accounts?.id) {
				throw new Error('Google Sign-In did not initialize');
			}

			window.google.accounts.id.initialize({
				client_id: clientId,
				ux_mode: 'popup',
				callback: async (response) => {
					if (!response?.credential) {
						showMessage(getActiveMessageElement(), 'Google sign-in did not return a credential.');
						return;
					}
					await submitSocialToken('Google', response.credential);
				},
			});

			const slots = [
				{ element: signInGoogleSlot, text: 'signin_with' },
				{ element: signUpGoogleSlot, text: 'signup_with' },
			];

			slots.forEach(({ element, text }) => {
				element.innerHTML = '';
				window.google.accounts.id.renderButton(element, {
					theme: 'outline',
					size: 'large',
					type: 'standard',
					shape: 'rectangular',
					text,
					width: 250,
					logo_alignment: 'left',
				});
			});
		} catch (error) {
			signInGoogleSlot.classList.add('is-hidden');
			signUpGoogleSlot.classList.add('is-hidden');
			showMessage(getActiveMessageElement(), error.message || 'Google sign-in is unavailable right now.');
		}
	};

	const initializeFacebookSdk = async (appId, sdkVersion) => {
		if (window.FB) {
			window.FB.init({
				appId,
				cookie: true,
				xfbml: false,
				version: sdkVersion || 'v24.0',
			});
			return;
		}

		await new Promise((resolve, reject) => {
			window.fbAsyncInit = () => {
				window.FB.init({
					appId,
					cookie: true,
					xfbml: false,
					version: sdkVersion || 'v24.0',
				});
				resolve();
			};
			loadScript('https://connect.facebook.net/en_US/sdk.js', 'facebook-jssdk').catch(reject);
		});
	};

	const enableFacebookButtons = async (appId, sdkVersion) => {
		if (!appId || !facebookButtons.length) {
			facebookButtons.forEach((button) => button.classList.add('is-hidden'));
			return;
		}

		try {
			await initializeFacebookSdk(appId, sdkVersion);
			facebookButtons.forEach((button) => {
				button.classList.remove('is-hidden');
				button.addEventListener('click', () => {
					clearMessages();
					window.FB.login(async (response) => {
						const accessToken = response?.authResponse?.accessToken;
						if (!accessToken) {
							showMessage(getActiveMessageElement(), 'Facebook sign-in was cancelled.');
							return;
						}
						await submitSocialToken('Facebook', accessToken);
					}, { scope: 'email,public_profile' });
				});
			});
		} catch (error) {
			facebookButtons.forEach((button) => button.classList.add('is-hidden'));
			showMessage(getActiveMessageElement(), error.message || 'Facebook sign-in is unavailable right now.');
		}
	};

	const loadSocialProviders = async () => {
		try {
			const response = await fetch('/api/auth/providers');
			const providerConfig = await response.json().catch(() => null);
			if (!response.ok || !providerConfig) {
				return;
			}

			await renderGoogleButtons(providerConfig.google?.client_id || '');
			await enableFacebookButtons(providerConfig.facebook?.app_id || '', providerConfig.facebook?.sdk_version || 'v24.0');
		} catch (error) {
			signInGoogleSlot?.classList.add('is-hidden');
			signUpGoogleSlot?.classList.add('is-hidden');
			facebookButtons.forEach((button) => button.classList.add('is-hidden'));
		}
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

	loadSocialProviders();

	if (window.localStorage.getItem(authTokenKey) && window.location.pathname.endsWith('/Login.html')) {
		window.location.href = '/html/home.html';
	}
});
