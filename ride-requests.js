(function () {
    const currentUserEmail = sessionStorage.getItem('pagibigRideUserEmail')?.trim().toLowerCase() || '';
    const isSignedIn = sessionStorage.getItem('pagibigRideSignedIn') === 'true' && Boolean(currentUserEmail);

    const createRideModal = document.querySelector('#create-ride-modal');
    const createRideForm = document.querySelector('#create-ride-form');
    const createRideMap = document.querySelector('#create-ride-map');
    const createRideMapLink = document.querySelector('#create-ride-map-link');
    const createRideHint = document.querySelector('#create-route-hint');
    const pickupLocationInput = document.querySelector('#ride-origin');
    const pickupSuggestions = document.querySelector('#pickup-location-suggestions');
    const rideOfferStorageKey = currentUserEmail ? 'pagibigRideOffers:' + encodeURIComponent(currentUserEmail) : '';
    const legacyRideOfferStorageKey = 'pagibigRideOffers';
    const legacyMigrationStorageKey = 'pagibigRideOffersMigrated';
    const serviceSelect = document.querySelector('#ride-title');
    const batchSelect = document.querySelector('#ride-batch');
    const standardRideBatches = {
        'Wednesday Prayer Meeting': [
            { time: '04:00', label: '4:00 AM' }, { time: '08:00', label: '8:00 AM' },
            { time: '12:30', label: '12:30 PM' }, { time: '15:00', label: '3:00 PM' }, { time: '18:00', label: '6:00 PM' }
        ],
        'Thursday Prayer Meeting': [
            { time: '08:00', label: '8:00 AM' }, { time: '12:30', label: '12:30 PM' },
            { time: '15:00', label: '3:00 PM' }, { time: '18:00', label: '6:00 PM' }
        ],
        'Saturday Worship Service': [
            { time: '04:00', label: '4:00 AM' }, { time: '08:00', label: '8:00 AM' }, { time: '12:30', label: '12:30 PM' }
        ],
        'Saturday Thanksgiving': [{ time: '17:00', label: '5:00 PM' }],
        'Sunday Thanksgiving': [{ time: '06:00', label: '6:00 AM' }]
    };

    const locationSearchEndpoint = 'https://photon.komoot.io/api/';
    const locationSuggestionCache = new Map();
    let locationSearchTimer;
    let locationSearchController;
    let lastLocationSearchAt = 0;
    let activeLocationSuggestion = -1;

    function closePickupSuggestions() {
        pickupSuggestions.hidden = true;
        pickupLocationInput.setAttribute('aria-expanded', 'false');
        pickupLocationInput.removeAttribute('aria-activedescendant');
        activeLocationSuggestion = -1;
    }

    function locationLabel(feature) {
        const place = feature.properties || {};
        const street = [place.housenumber, place.street].filter(Boolean).join(' ');
        const parts = [place.name, street, place.district, place.city || place.town || place.village, place.state, place.country];
        const uniqueParts = [];
        parts.filter(Boolean).forEach((part) => {
            if (!uniqueParts.some((existing) => existing.toLowerCase() === String(part).toLowerCase())) {
                uniqueParts.push(String(part));
            }
        });
        return uniqueParts.join(', ') || place.label || '';
    }

    function showPickupSuggestionMessage(message) {
        pickupSuggestions.replaceChildren();
        const status = document.createElement('div');
        status.className = 'location-suggestion-message';
        status.setAttribute('role', 'status');
        status.textContent = message;
        pickupSuggestions.append(status);
        pickupSuggestions.hidden = false;
        pickupLocationInput.setAttribute('aria-expanded', 'true');
    }

    function selectPickupSuggestion(label) {
        pickupLocationInput.value = label;
        closePickupSuggestions();
        scheduleCreateRideRouteUpdate();
    }

    function renderPickupSuggestions(features) {
        pickupSuggestions.replaceChildren();
        activeLocationSuggestion = -1;
        const options = features.map((feature) => ({ feature, label: locationLabel(feature) })).filter((item) => item.label);
        if (!options.length) {
            showPickupSuggestionMessage('No matching places found. You can still enter the address.');
            return;
        }

        options.forEach(({ feature, label }, index) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'location-suggestion-option';
            option.id = 'pickup-location-option-' + index;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            option.textContent = label;
            option.addEventListener('mousedown', (event) => event.preventDefault());
            option.addEventListener('click', () => selectPickupSuggestion(label));
            pickupSuggestions.append(option);
        });
        pickupSuggestions.hidden = false;
        pickupLocationInput.setAttribute('aria-expanded', 'true');
    }

    function setActivePickupSuggestion(index) {
        const options = Array.from(pickupSuggestions.querySelectorAll('[role="option"]'));
        if (!options.length) return;
        activeLocationSuggestion = (index + options.length) % options.length;
        options.forEach((option, optionIndex) => {
            const isActive = optionIndex === activeLocationSuggestion;
            option.setAttribute('aria-selected', String(isActive));
            if (isActive) option.scrollIntoView({ block: 'nearest' });
        });
        pickupLocationInput.setAttribute('aria-activedescendant', options[activeLocationSuggestion].id);
    }

    async function searchPickupLocations(query) {
        if (pickupLocationInput.value.trim() !== query) return;
        const cached = locationSuggestionCache.get(query.toLowerCase());
        if (cached) {
            renderPickupSuggestions(cached);
            return;
        }

        const waitForRateLimit = Math.max(0, 1000 - (Date.now() - lastLocationSearchAt));
        if (waitForRateLimit) {
            locationSearchTimer = setTimeout(() => searchPickupLocations(query), waitForRateLimit);
            return;
        }

        if (locationSearchController) locationSearchController.abort();
        locationSearchController = new AbortController();
        lastLocationSearchAt = Date.now();
        const url = new URL(locationSearchEndpoint);
        url.searchParams.set('q', query + ', Philippines');
        url.searchParams.set('lat', '14.9536');
        url.searchParams.set('lon', '120.7672');
        url.searchParams.set('limit', '5');
        url.searchParams.set('lang', 'en');

        try {
            const response = await fetch(url, { signal: locationSearchController.signal });
            if (!response.ok) throw new Error('Location search failed');
            const results = await response.json();
            if (pickupLocationInput.value.trim() !== query) return;
            const features = Array.isArray(results.features) ? results.features : [];
            locationSuggestionCache.set(query.toLowerCase(), features);
            renderPickupSuggestions(features);
        } catch (error) {
            if (error.name === 'AbortError' || pickupLocationInput.value.trim() !== query) return;
            showPickupSuggestionMessage('Location suggestions are unavailable. You can still enter the address.');
        }
    }

    function schedulePickupLocationSearch() {
        clearTimeout(locationSearchTimer);
        const query = pickupLocationInput.value.trim();
        if (query.length < 3) {
            closePickupSuggestions();
            return;
        }
        showPickupSuggestionMessage('Searching nearby places…');
        locationSearchTimer = setTimeout(() => searchPickupLocations(query), 350);
    }

    function populateStandardBatches() {
        const batches = standardRideBatches[serviceSelect.value] || [];
        batchSelect.replaceChildren();
        const prompt = document.createElement('option');
        prompt.value = '';
        prompt.disabled = true;
        prompt.selected = true;
        prompt.textContent = batches.length ? 'Choose a batch time' : 'Choose a service first';
        batchSelect.append(prompt);
        batches.forEach((batch) => {
            const option = document.createElement('option');
            option.value = batch.time;
            option.textContent = batch.label;
            batchSelect.append(option);
        });
        batchSelect.disabled = batches.length === 0;
    }

    function getDriverOffers() {
        if (!isSignedIn) return [];
        try {
            const sessionOffers = sessionStorage.getItem(rideOfferStorageKey);
            if (sessionOffers !== null) {
                const offers = JSON.parse(sessionOffers);
                clearPersistedRideOffers();
                return Array.isArray(offers) ? offers : [];
            }

            const storedOffers = JSON.parse(localStorage.getItem(rideOfferStorageKey) || '[]');
            let offers = Array.isArray(storedOffers) ? storedOffers : [];
            if (localStorage.getItem(legacyMigrationStorageKey) !== 'true') {
                const legacyOffers = JSON.parse(localStorage.getItem(legacyRideOfferStorageKey) || '[]');
                if (Array.isArray(legacyOffers)) offers = offers.concat(legacyOffers);
            }
            clearPersistedRideOffers();
            if (offers.length) sessionStorage.setItem(rideOfferStorageKey, JSON.stringify(offers));
            return offers;
        } catch {
            clearPersistedRideOffers();
            return [];
        }
    }

    function clearPersistedRideOffers() {
        Object.keys(localStorage).filter((key) => key.startsWith('pagibigRideOffers')).forEach((key) => localStorage.removeItem(key));
    }

    function renderDriverOffers() {
        const offersSection = document.querySelector('#my-ride-offers');
        const offersList = document.querySelector('#my-ride-offers-list');
        const offers = getDriverOffers();
        offersList.replaceChildren();
        offersSection.hidden = offers.length === 0;

        offers.forEach((offer) => {
            const offerCard = document.createElement('div');
            offerCard.className = 'my-ride-offer-card';
            const details = document.createElement('div');
            details.className = 'my-ride-offer-details';
            const title = document.createElement('h3');
            title.textContent = offer.title;
            const schedule = document.createElement('p');
            schedule.textContent = (offer.day || offer.title.split(' ')[0]) + ' · ' + offer.timeLabel;
            const route = document.createElement('p');
            route.className = 'my-ride-offer-route';
            route.textContent = offer.origin + ' → ' + offer.destination;
            details.append(title, schedule, route);

            const seats = document.createElement('span');
            seats.className = 'my-ride-offer-seats';
            seats.textContent = offer.availableSeats + (offer.availableSeats === 1 ? ' seat available' : ' seats available');

            const vehicle = document.createElement('span');
            vehicle.className = 'my-ride-offer-vehicle';
            vehicle.textContent = offer.vehicle || 'Vehicle not specified';

            const viewDetails = document.createElement('button');
            viewDetails.type = 'button';
            viewDetails.className = 'button my-ride-offer-view';
            viewDetails.textContent = 'View details';
            viewDetails.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('pagibig:show-own-ride-offer', { detail: offer }));
            });
            offerCard.append(details, vehicle, seats, viewDetails);
            offersList.append(offerCard);
        });
    }

    function updateCreateRideRoute() {
        clearTimeout(createRideRouteTimer);
        const origin = document.querySelector('#ride-origin').value.trim();
        const destination = document.querySelector('#ride-destination').value.trim();
        if (!origin || !destination) {
            createRideMap.removeAttribute('src');
            createRideMapLink.href = '#';
            createRideMapLink.setAttribute('aria-disabled', 'true');
            createRideHint.textContent = 'Add a pickup and destination to preview your route.';
            return;
        }
        const encodedOrigin = encodeURIComponent(origin);
        const encodedDestination = encodeURIComponent(destination);
        createRideMap.src = 'https://maps.google.com/maps?output=embed&saddr=' + encodedOrigin + '&daddr=' + encodedDestination + '&z=9&region=PH';
        createRideMapLink.href = 'https://www.google.com/maps/dir/?api=1&origin=' + encodedOrigin + '&destination=' + encodedDestination + '&travelmode=driving';
        createRideMapLink.removeAttribute('aria-disabled');
        createRideHint.textContent = origin + ' to ' + destination;
    }

    let createRideRouteTimer;
    function scheduleCreateRideRouteUpdate() {
        clearTimeout(createRideRouteTimer);
        createRideRouteTimer = setTimeout(updateCreateRideRoute, 500);
    }

    document.querySelectorAll('[data-create-ride]').forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
            if (!isSignedIn) return;
            event.preventDefault();
            createRideForm.reset();
            populateStandardBatches();
            updateCreateRideRoute();
            createRideModal.showModal();
        });
    });

    serviceSelect.addEventListener('change', () => {
        populateStandardBatches();
    });

    ['#ride-origin', '#ride-destination'].forEach((selector) => {
        document.querySelector(selector).addEventListener('input', scheduleCreateRideRouteUpdate);
    });

    pickupLocationInput.addEventListener('input', schedulePickupLocationSearch);
    pickupLocationInput.addEventListener('focus', () => {
        if (pickupLocationInput.value.trim().length >= 3) schedulePickupLocationSearch();
    });
    pickupLocationInput.addEventListener('blur', () => setTimeout(closePickupSuggestions, 140));
    pickupLocationInput.addEventListener('keydown', (event) => {
        const options = pickupSuggestions.querySelectorAll('[role="option"]');
        if (event.key === 'ArrowDown' && options.length) {
            event.preventDefault();
            setActivePickupSuggestion(activeLocationSuggestion + 1);
        } else if (event.key === 'ArrowUp' && options.length) {
            event.preventDefault();
            setActivePickupSuggestion(activeLocationSuggestion - 1);
        } else if (event.key === 'Enter' && activeLocationSuggestion >= 0 && options[activeLocationSuggestion]) {
            event.preventDefault();
            selectPickupSuggestion(options[activeLocationSuggestion].textContent);
        } else if (event.key === 'Escape' && !pickupSuggestions.hidden) {
            event.preventDefault();
            event.stopPropagation();
            closePickupSuggestions();
        }
    });

    createRideMapLink.addEventListener('click', (event) => {
        if (!document.querySelector('#ride-origin').value.trim() || !document.querySelector('#ride-destination').value.trim()) {
            event.preventDefault();
            return;
        }
        updateCreateRideRoute();
    });

    createRideForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!isSignedIn || !createRideForm.reportValidity()) return;
        const values = new FormData(createRideForm);
        const selectedBatch = batchSelect.selectedOptions[0];
        const offer = {
            title: values.get('title').trim(),
            day: values.get('title').trim().split(' ')[0],
            time: selectedBatch.value,
            timeLabel: selectedBatch.textContent,
            batch: selectedBatch.textContent,
            vehicle: values.get('vehicle'),
            origin: values.get('origin').trim(),
            destination: values.get('destination').trim(),
            availableSeats: Number(values.get('availableSeats'))
        };
        const offers = getDriverOffers();
        offers.push(offer);
        sessionStorage.setItem(rideOfferStorageKey, JSON.stringify(offers));
        renderDriverOffers();
        createRideModal.close();
        document.querySelector('#create-ride-message').textContent = 'Your ride offer has been added to the matching Standard Batch.';
    });

    document.querySelector('.create-ride-close').addEventListener('click', () => createRideModal.close());
    createRideModal.addEventListener('click', (event) => {
        if (event.target === createRideModal) createRideModal.close();
    });
    renderDriverOffers();
})();
