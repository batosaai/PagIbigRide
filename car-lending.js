(function () {
    const storageKey = 'pagibigRideCarLendingListings';
    const requestStorageKey = 'pagibigRideCarLendingRequests';
    const modal = document.querySelector('#car-lending-modal');
    const form = document.querySelector('#car-lending-form');
    const list = document.querySelector('#car-lendings-list');
    const emptyState = document.querySelector('#car-lendings-empty');
    const status = document.querySelector('#car-lendings-status');
    const pickupInput = document.querySelector('#car-area');
    const pickupSuggestions = document.querySelector('#car-pickup-suggestions');
    const pickupMap = document.querySelector('#car-pickup-map');
    const pickupMapLink = document.querySelector('#car-pickup-map-link');
    const pickupMapHint = document.querySelector('#car-pickup-map-hint');
    const locationSearchEndpoint = 'https://photon.komoot.io/api/';
    const locationSuggestionCache = new Map();
    let selectedPickup = null;
    let locationSearchTimer;
    let locationSearchController;
    let lastLocationSearchAt = 0;
    let activePickupSuggestion = -1;

    function readStorage(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || 'null');
            return value === null ? fallback : value;
        } catch {
            return fallback;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    }

    function closePickupSuggestions() {
        pickupSuggestions.hidden = true;
        pickupInput.setAttribute('aria-expanded', 'false');
        pickupInput.removeAttribute('aria-activedescendant');
        activePickupSuggestion = -1;
    }

    function resetPickupMap() {
        pickupMap.removeAttribute('src');
        pickupMap.hidden = true;
        pickupMapLink.href = '#';
        pickupMapLink.setAttribute('aria-disabled', 'true');
        pickupMapHint.textContent = 'Choose a suggested pickup place to preview it on the map.';
    }

    function resetPickupLocation() {
        clearTimeout(locationSearchTimer);
        if (locationSearchController) locationSearchController.abort();
        selectedPickup = null;
        closePickupSuggestions();
        resetPickupMap();
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
        const suggestionMessage = document.createElement('div');
        suggestionMessage.className = 'location-suggestion-message';
        suggestionMessage.setAttribute('role', 'status');
        suggestionMessage.textContent = message;
        pickupSuggestions.append(suggestionMessage);
        pickupSuggestions.hidden = false;
        pickupInput.setAttribute('aria-expanded', 'true');
    }

    function selectPickupSuggestion(feature, label) {
        const coordinates = feature.geometry?.coordinates;
        const longitude = Number(coordinates?.[0]);
        const latitude = Number(coordinates?.[1]);
        pickupInput.value = label;
        closePickupSuggestions();

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            selectedPickup = null;
            resetPickupMap();
            pickupMapHint.textContent = 'This place has no map coordinates. You can still use the pickup address.';
            return;
        }

        selectedPickup = { label, latitude, longitude };
        const point = `${latitude},${longitude}`;
        pickupMap.src = `https://maps.google.com/maps?output=embed&q=${encodeURIComponent(point)}&z=15&region=PH`;
        pickupMap.hidden = false;
        pickupMapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point)}`;
        pickupMapLink.removeAttribute('aria-disabled');
        pickupMapHint.textContent = label;
    }

    function renderPickupSuggestions(features) {
        pickupSuggestions.replaceChildren();
        activePickupSuggestion = -1;
        const options = features.map((feature) => ({ feature, label: locationLabel(feature) })).filter((item) => item.label);
        if (!options.length) {
            showPickupSuggestionMessage('No matching places found. You can still enter the pickup address.');
            return;
        }

        options.forEach(({ feature, label }, index) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'location-suggestion-option';
            option.id = `car-pickup-option-${index}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            option.textContent = label;
            option.addEventListener('mousedown', (event) => event.preventDefault());
            option.addEventListener('click', () => selectPickupSuggestion(feature, label));
            pickupSuggestions.append(option);
        });
        pickupSuggestions.hidden = false;
        pickupInput.setAttribute('aria-expanded', 'true');
    }

    function setActivePickupSuggestion(index) {
        const options = Array.from(pickupSuggestions.querySelectorAll('[role="option"]'));
        if (!options.length) return;
        activePickupSuggestion = (index + options.length) % options.length;
        options.forEach((option, optionIndex) => {
            const isActive = optionIndex === activePickupSuggestion;
            option.setAttribute('aria-selected', String(isActive));
            if (isActive) option.scrollIntoView({ block: 'nearest' });
        });
        pickupInput.setAttribute('aria-activedescendant', options[activePickupSuggestion].id);
    }

    async function searchPickupLocations(query) {
        if (pickupInput.value.trim() !== query) return;
        const cacheKey = query.toLowerCase();
        if (locationSuggestionCache.has(cacheKey)) {
            renderPickupSuggestions(locationSuggestionCache.get(cacheKey));
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
        url.searchParams.set('q', `${query}, Philippines`);
        url.searchParams.set('lat', '14.9536');
        url.searchParams.set('lon', '120.7672');
        url.searchParams.set('limit', '5');
        url.searchParams.set('lang', 'en');

        try {
            const response = await fetch(url, { signal: locationSearchController.signal });
            if (!response.ok) throw new Error('Location search failed');
            const results = await response.json();
            if (pickupInput.value.trim() !== query) return;
            const features = Array.isArray(results.features) ? results.features : [];
            locationSuggestionCache.set(cacheKey, features);
            renderPickupSuggestions(features);
        } catch (error) {
            if (error.name === 'AbortError' || pickupInput.value.trim() !== query) return;
            showPickupSuggestionMessage('Location suggestions are unavailable. You can still enter the address.');
        }
    }

    function schedulePickupLocationSearch() {
        clearTimeout(locationSearchTimer);
        const query = pickupInput.value.trim();
        if (query.length < 3) {
            closePickupSuggestions();
            return;
        }
        showPickupSuggestionMessage('Searching nearby places…');
        locationSearchTimer = setTimeout(() => searchPickupLocations(query), 350);
    }

    let listings = readStorage(storageKey, []);
    if (!Array.isArray(listings)) listings = [];
    let requestedListings = readStorage(requestStorageKey, []);
    if (!Array.isArray(requestedListings)) requestedListings = [];
    const requestedIds = new Set(requestedListings);
    function addText(parent, tagName, className, text) {
        const element = document.createElement(tagName);
        element.className = className;
        element.textContent = text;
        parent.append(element);
        return element;
    }

    function renderListings() {
        list.replaceChildren();
        emptyState.hidden = listings.length > 0;

        listings.forEach((listing) => {
            const card = document.createElement('article');
            card.className = 'car-lending-listing';
            card.setAttribute('role', 'listitem');
            const heading = addText(card, 'h3', 'car-lending-listing-title', `${listing.make} ${listing.model}`);
            heading.id = `car-listing-${listing.id}`;

            addText(card, 'p', 'car-lending-listing-area', `Pickup area: ${listing.area}`);
            if (Number.isFinite(listing.latitude) && Number.isFinite(listing.longitude)) {
                const locationLink = document.createElement('a');
                locationLink.className = 'car-lending-location-link';
                locationLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${listing.latitude},${listing.longitude}`)}`;
                locationLink.target = '_blank';
                locationLink.rel = 'noopener noreferrer';
                locationLink.textContent = 'View pickup map ↗';
                locationLink.setAttribute('aria-label', `View map for pickup area ${listing.area}`);
                card.append(locationLink);
            }
            addText(card, 'p', 'car-lending-listing-availability', `Available: ${listing.availability}`);

            const requestButton = document.createElement('button');
            requestButton.type = 'button';
            requestButton.className = 'button car-lending-request';
            requestButton.setAttribute('aria-labelledby', `${heading.id} car-request-label-${listing.id}`);
            requestButton.id = `car-request-label-${listing.id}`;
            requestButton.disabled = requestedIds.has(listing.id);
            requestButton.textContent = requestButton.disabled ? 'Request sent' : 'Request to borrow';
            requestButton.addEventListener('click', () => {
                requestedIds.add(listing.id);
                requestedListings = Array.from(requestedIds);
                writeStorage(requestStorageKey, requestedListings);
                requestButton.disabled = true;
                requestButton.textContent = 'Request sent';
                status.textContent = `Mock request sent for ${listing.make} ${listing.model}. No one was contacted.`;
            });
            card.append(requestButton);
            list.append(card);
        });
    }

    document.querySelectorAll('[data-car-lending-open]').forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            form.reset();
            resetPickupLocation();
            modal.showModal();
        });
    });

    pickupInput.addEventListener('input', () => {
        selectedPickup = null;
        resetPickupMap();
        schedulePickupLocationSearch();
    });
    pickupInput.addEventListener('focus', () => {
        if (pickupInput.value.trim().length >= 3) schedulePickupLocationSearch();
    });
    pickupInput.addEventListener('blur', () => setTimeout(closePickupSuggestions, 140));
    pickupInput.addEventListener('keydown', (event) => {
        const options = Array.from(pickupSuggestions.querySelectorAll('[role="option"]'));
        if (event.key === 'ArrowDown' && options.length) {
            event.preventDefault();
            setActivePickupSuggestion(activePickupSuggestion + 1);
        } else if (event.key === 'ArrowUp' && options.length) {
            event.preventDefault();
            setActivePickupSuggestion(activePickupSuggestion - 1);
        } else if (event.key === 'Enter' && activePickupSuggestion >= 0 && options[activePickupSuggestion]) {
            event.preventDefault();
            options[activePickupSuggestion].click();
        } else if (event.key === 'Escape' && !pickupSuggestions.hidden) {
            event.preventDefault();
            event.stopPropagation();
            closePickupSuggestions();
        }
    });
    pickupMapLink.addEventListener('click', (event) => {
        if (pickupMapLink.getAttribute('aria-disabled') === 'true') event.preventDefault();
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const values = new FormData(form);
        const listing = {
            id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            make: String(values.get('make')).trim(),
            model: String(values.get('model')).trim(),
            area: String(values.get('area')).trim(),
            latitude: selectedPickup?.latitude ?? null,
            longitude: selectedPickup?.longitude ?? null,
            availability: String(values.get('availability'))
        };
        listings = [listing, ...listings];
        const saved = writeStorage(storageKey, listings);
        modal.close();
        renderListings();
        status.textContent = saved
            ? `${listing.make} ${listing.model} is now in the demo listings.`
            : 'The listing was added for this visit, but this browser could not save it.';
        document.querySelector('#car-lendings').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.querySelector('.car-lending-close').addEventListener('click', () => modal.close());
    modal.addEventListener('close', resetPickupLocation);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.close();
    });
    renderListings();
})();
