(function () {
    const rideIntro = document.querySelector('.create-ride-area');
    const createRideButton = document.querySelector('.create-ride-fab');
    if (!rideIntro || !createRideButton) return;

    function setButtonVisibility(isVisible) {
        createRideButton.classList.toggle('is-visible', isVisible);
    }

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(([entry]) => {
            setButtonVisibility(!entry.isIntersecting);
        }, { threshold: 0 });
        observer.observe(rideIntro);
        return;
    }

    function updateButtonVisibility() {
        const bounds = rideIntro.getBoundingClientRect();
        const introIsVisible = bounds.bottom > 0 && bounds.top < window.innerHeight;
        setButtonVisibility(!introIsVisible);
    }

    window.addEventListener('scroll', updateButtonVisibility, { passive: true });
    window.addEventListener('resize', updateButtonVisibility);
    updateButtonVisibility();
})();
