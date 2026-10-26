// Mock authentication for the static prototype: valid form input opens the rides dashboard.
(function () {
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

    const markInvalid = (form) => {
        form.querySelectorAll('input').forEach((input) => {
            input.setAttribute('aria-invalid', String(!input.validity.valid));
        });
    };

    const redirectToDashboard = (form, message) => {
        markInvalid(form);
        if (!form.checkValidity()) {
            message.textContent = 'Please complete the required fields correctly.';
            form.querySelector(':invalid').focus();
            return;
        }

        const email = form.elements.namedItem('email').value.trim().toLowerCase();
        sessionStorage.setItem('pagibigRideUserEmail', email);
        sessionStorage.setItem('pagibigRideSignedIn', 'true');
        window.location.href = '../index.html';
    };

    const signUpForm = document.querySelector('#signup-form');
    if (signUpForm) {
        signUpForm.addEventListener('submit', (event) => {
            event.preventDefault();
            redirectToDashboard(signUpForm, document.querySelector('#signup-message'));
        });
    }

    const loginForm = document.querySelector('#login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            redirectToDashboard(loginForm, document.querySelector('#login-message'));
        });
    }
})();
