/*
 * Prototype-only account flow: data stays in this browser's local storage.
 * Replace this with server-side authentication before using it in production.
 */
(function () {
    const storageKey = 'pagibigRideAccounts';

    const getAccounts = () => JSON.parse(localStorage.getItem(storageKey) || '[]');
    const saveAccounts = (accounts) => localStorage.setItem(storageKey, JSON.stringify(accounts));

    document.querySelectorAll('.password-toggle').forEach((button) => {
        button.addEventListener('click', () => {
            const input = button.previousElementSibling;
            const reveal = input.type === 'password';
            input.type = reveal ? 'text' : 'password';
            button.textContent = reveal ? 'Hide' : 'Show';
            button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
            button.setAttribute('aria-pressed', String(reveal));
        });
    });

    const setMessage = (element, message, isSuccess = false) => {
        element.textContent = message;
        element.classList.toggle('success', isSuccess);
    };

    const markInvalid = (form) => {
        form.querySelectorAll('input').forEach((input) => {
            input.setAttribute('aria-invalid', String(!input.validity.valid));
        });
    };

    const signUpForm = document.querySelector('#signup-form');
    if (signUpForm) {
        signUpForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const message = document.querySelector('#signup-message');
            markInvalid(signUpForm);

            if (!signUpForm.checkValidity()) {
                setMessage(message, 'Please complete every required field correctly.');
                signUpForm.querySelector(':invalid').focus();
                return;
            }

            const data = Object.fromEntries(new FormData(signUpForm));
            const accounts = getAccounts();
            const normalizedEmail = data.email.trim().toLowerCase();

            if (accounts.some((account) => account.email === normalizedEmail)) {
                setMessage(message, 'An account with this email already exists. Please sign in instead.');
                return;
            }

            accounts.push({
                fullName: data.fullName.trim(),
                email: normalizedEmail,
                password: data.password,
                churchId: data.churchId.trim(),
                municipality: data.municipality.trim(),
                locale: data.locale.trim()
            });
            saveAccounts(accounts);
            setMessage(message, 'Account created. Taking you to sign in…', true);
            signUpForm.querySelector('button[type="submit"]').disabled = true;
            window.setTimeout(() => {
                window.location.href = `login.html?email=${encodeURIComponent(normalizedEmail)}&created=1`;
            }, 650);
        });
    }

    const loginForm = document.querySelector('#login-form');
    if (loginForm) {
        const message = document.querySelector('#login-message');
        const params = new URLSearchParams(window.location.search);
        const emailInput = loginForm.querySelector('[name="email"]');
        if (params.get('email')) emailInput.value = params.get('email');
        if (params.get('created')) setMessage(message, 'Your account is ready. Sign in to continue.', true);

        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            markInvalid(loginForm);
            if (!loginForm.checkValidity()) {
                setMessage(message, 'Enter your email address and password to continue.');
                loginForm.querySelector(':invalid').focus();
                return;
            }

            const data = Object.fromEntries(new FormData(loginForm));
            const account = getAccounts().find((item) => item.email === data.email.trim().toLowerCase() && item.password === data.password);
            if (!account) {
                setMessage(message, 'We could not find an account with those details. Create an account first if you are new here.');
                return;
            }

            setMessage(message, `Welcome back, ${account.fullName}! You are signed in.`, true);
            loginForm.querySelector('button[type="submit"]').disabled = true;
        });
    }
})();
