(function () {
    const userEmail = sessionStorage.getItem('pagibigRideUserEmail')?.trim().toLowerCase();
    const isSignedIn = sessionStorage.getItem('pagibigRideSignedIn') === 'true' && Boolean(userEmail);
    const clearRideOffers = () => {
        Object.keys(sessionStorage).filter((key) => key.startsWith('pagibigRideOffers')).forEach((key) => sessionStorage.removeItem(key));
        Object.keys(localStorage).filter((key) => key.startsWith('pagibigRideOffers')).forEach((key) => localStorage.removeItem(key));
    };
    const signOut = (event) => {
        event.preventDefault();
        clearRideOffers();
        sessionStorage.removeItem('pagibigRideSignedIn');
        sessionStorage.removeItem('pagibigRideUserEmail');
        window.location.href = 'auth/login.html';
    };

    if (!isSignedIn) {
        clearRideOffers();
        sessionStorage.removeItem('pagibigRideSignedIn');
        sessionStorage.removeItem('pagibigRideUserEmail');
        return;
    }

    document.querySelectorAll('[data-guest-only]').forEach((link) => link.remove());

    const accountMenu = document.querySelector('[data-account-menu]');
    const accountAvatar = document.querySelector('[data-account-avatar]');
    const accountInitial = document.querySelector('[data-account-initial]');
    const accountEmail = document.querySelector('[data-account-email]');
    const accountDropdown = document.querySelector('#account-dropdown');
    const accountLogout = document.querySelector('[data-account-logout]');

    if (accountMenu && accountAvatar && accountInitial && accountEmail && accountDropdown && accountLogout) {
        accountInitial.textContent = userEmail.charAt(0).toUpperCase();
        accountEmail.textContent = userEmail;
        accountAvatar.setAttribute('aria-label', `Account: ${userEmail}`);
        accountMenu.hidden = false;

        accountAvatar.addEventListener('click', () => {
            const isOpen = !accountDropdown.hidden;
            accountDropdown.hidden = isOpen;
            accountAvatar.setAttribute('aria-expanded', String(!isOpen));
        });
        accountLogout.addEventListener('click', signOut);
        document.addEventListener('click', (event) => {
            if (!accountMenu.contains(event.target)) {
                accountDropdown.hidden = true;
                accountAvatar.setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !accountDropdown.hidden) {
                accountDropdown.hidden = true;
                accountAvatar.setAttribute('aria-expanded', 'false');
                accountAvatar.focus();
            }
        });
    }
})();
