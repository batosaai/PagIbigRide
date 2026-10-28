(function () {
    const currentUserEmail = sessionStorage.getItem('pagibigRideUserEmail')?.trim().toLowerCase() || '';
    const isSignedIn = sessionStorage.getItem('pagibigRideSignedIn') === 'true'
        && Boolean(currentUserEmail);
    const currentUserRideOffersKey = currentUserEmail
        ? 'pagibigRideOffers:' + encodeURIComponent(currentUserEmail)
        : '';
    const acceptedRidesStorageKey = currentUserEmail
        ? 'pagibigRideAccepted:' + encodeURIComponent(currentUserEmail)
        : '';
    const sampleDriversByService = {
        'Wednesday Prayer Meeting': [
            { name: 'Sister Rachel', vehicle: 'Car', origin: 'Commonwealth Market', seats: 2 },
            { name: 'Brother Daniel', vehicle: 'Van', origin: 'SM City Cubao', seats: 3 }
        ],
        'Thursday Prayer Meeting': [
            { name: 'Brother Joseph', vehicle: 'Van', origin: 'Pasig Palengke', seats: 3 },
            { name: 'Sister Miriam', vehicle: 'SUV', origin: 'UP Town Center', seats: 2 }
        ],
        'Saturday Worship Service': [
            { name: 'Sister Rachel', vehicle: 'Car', origin: 'Commonwealth Market', seats: 2 },
            { name: 'Jonathan', vehicle: 'Motorcycle', origin: 'Ayala MRT Station', seats: 1 }
        ],
        'Saturday Thanksgiving': [
            { name: 'Brother Joseph', vehicle: 'Van', origin: 'Pasig Palengke', seats: 3 },
            { name: 'Sister Miriam', vehicle: 'Car', origin: 'SM City North EDSA', seats: 2 }
        ],
        'Sunday Thanksgiving': [
            { name: 'Brother Daniel', vehicle: 'Van', origin: 'SM City Cubao', seats: 3 },
            { name: 'Sister Rachel', vehicle: 'Car', origin: 'Commonwealth Market', seats: 2 }
        ]
    };

    const rideModal = document.querySelector('#ride-modal');
    const acceptRideButton = document.querySelector('.ride-modal-request');
    const acceptedRidesSection = document.querySelector('#my-accepted-rides');
    const acceptedRidesList = document.querySelector('#my-accepted-rides-list');
    const chatForm = document.querySelector('#chat-form');
    const chatInput = document.querySelector('#chat-input');
    const chatContent = document.querySelector('#driver-chat-content');
    const chatLocked = document.querySelector('#driver-chat-locked');
    const chatMessages = document.querySelector('#chat-messages');
    const messageThreads = new Map();
    let activeDriver = '';
    let activeThread = '';
    let activeRide = null;

    function getAcceptedRides() {
        if (!isSignedIn) return [];
        try {
            const rides = JSON.parse(sessionStorage.getItem(acceptedRidesStorageKey) || '[]');
            return Array.isArray(rides) ? rides : [];
        } catch {
            return [];
        }
    }

    function renderAcceptedRides() {
        const rides = getAcceptedRides();
        acceptedRidesList.replaceChildren();
        acceptedRidesSection.hidden = rides.length === 0;

        rides.forEach((ride) => {
            const card = document.createElement('article');
            card.className = 'my-ride-offer-card my-accepted-ride-card';

            const details = document.createElement('div');
            details.className = 'my-ride-offer-details';
            const title = document.createElement('h3');
            title.textContent = ride.title;
            const schedule = document.createElement('p');
            schedule.textContent = ride.day + ' · ' + ride.timeLabel;
            const route = document.createElement('p');
            route.className = 'my-ride-offer-route';
            route.textContent = ride.origin + ' → ' + ride.destination;
            const driver = document.createElement('p');
            driver.className = 'my-accepted-ride-driver';
            driver.textContent = 'Driver: ' + ride.driver;
            details.append(title, schedule, route, driver);

            const vehicle = document.createElement('span');
            vehicle.className = 'my-ride-offer-vehicle';
            vehicle.textContent = ride.vehicle;

            const status = document.createElement('span');
            status.className = 'my-ride-offer-seats my-accepted-ride-status';
            status.textContent = 'Accepted';

            const viewDetails = document.createElement('button');
            viewDetails.type = 'button';
            viewDetails.className = 'button my-ride-offer-view';
            viewDetails.textContent = 'View details';
            viewDetails.addEventListener('click', () => {
                showRideDetails(null, null, resolveAcceptedRideRoute(ride), 'accepted');
            });

            card.append(details, vehicle, status, viewDetails);
            acceptedRidesList.append(card);
        });
    }

    function rideDetailsFromButton(button) {
        const rideTime = button.closest('.ride-card').querySelector('.ride-date').getAttribute('aria-label');
        const [day, timeLabel] = rideTime.split(/\s+at\s+/i);
        const ride = {
            title: button.dataset.rideTitle,
            day,
            timeLabel,
            driver: button.dataset.rideDriver,
            origin: button.dataset.rideOrigin,
            destination: button.dataset.rideDestination,
            vehicle: button.dataset.rideVehicle,
            mapOrigin: button.dataset.rideMapOrigin,
            mapDestination: button.dataset.rideMapDestination
        };
        ride.id = JSON.stringify([ride.title, ride.day, ride.timeLabel, ride.driver, ride.origin]);
        return ride;
    }

    function normalizeSchedulePart(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function formatBatchTime(time) {
        if (!/^\d{2}:\d{2}$/.test(String(time || ''))) return '';
        const [rawHours, minutes] = time.split(':');
        const hours = Number(rawHours);
        const period = hours >= 12 ? 'PM' : 'AM';
        return (hours % 12 || 12) + ':' + minutes + ' ' + period;
    }

    function rideDetailsFromOffer(offer, ownerKey, button) {
        const day = offer.day || offer.title.split(' ')[0];
        const timeLabel = offer.timeLabel || formatBatchTime(offer.time);
        const isOwnOffer = ownerKey === currentUserRideOffersKey;
        return {
            ...offer,
            day,
            timeLabel,
            driver: isOwnOffer ? 'You' : (offer.driverName || 'Community driver'),
            availableSeats: Number(offer.availableSeats),
            mapOrigin: offer.mapOrigin || (offer.origin + ', Philippines'),
            mapDestination: offer.mapDestination || button.dataset.rideMapDestination || (offer.destination + ', Philippines'),
            id: JSON.stringify(['offer', ownerKey, offer.title, day, timeLabel, offer.origin]),
            isOwnOffer
        };
    }

    function getCreatedOffersForBatch(button) {
        if (!isSignedIn) return [];
        const batch = rideDetailsFromButton(button);
        const matchingOffers = [];
        const offerKeys = Object.keys(sessionStorage).filter((key) => key.startsWith('pagibigRideOffers:'));

        offerKeys.forEach((key) => {
            try {
                const offers = JSON.parse(sessionStorage.getItem(key) || '[]');
                if (!Array.isArray(offers)) return;
                offers.forEach((offer) => {
                    const ride = rideDetailsFromOffer(offer, key, button);
                    if (ride.title === batch.title
                        && normalizeSchedulePart(ride.day) === normalizeSchedulePart(batch.day)
                        && normalizeSchedulePart(ride.timeLabel) === normalizeSchedulePart(batch.timeLabel)) {
                        matchingOffers.push(ride);
                    }
                });
            } catch {
                // Ignore malformed offer data and keep showing the other drivers.
            }
        });
        return matchingOffers;
    }

    function createAvailableDriverCard(driver, onViewDetails) {
        const driverCard = document.createElement('article');
        driverCard.className = 'available-driver-card';
        const initials = driver.name === 'You' ? 'Y' : driver.name.trim().split(/\s+/).pop()[0];
        const avatar = document.createElement('span');
        avatar.className = 'driver-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = initials;

        const info = document.createElement('div');
        info.className = 'available-driver-info';
        const name = document.createElement('h3');
        name.textContent = driver.name;
        const details = document.createElement('p');
        const seatCount = Number(driver.availableSeats ?? driver.seats);
        const seatLabel = seatCount + (seatCount === 1 ? ' seat available' : ' seats available');
        details.textContent = driver.vehicle + ' · Pickup: ' + driver.origin + ' · To: ' + driver.destination + ' · ' + seatLabel;
        info.append(name, details);

        const viewRide = document.createElement('button');
        viewRide.type = 'button';
        viewRide.className = 'button available-driver-view';
        viewRide.textContent = 'View Details';
        viewRide.addEventListener('click', onViewDetails);

        driverCard.append(avatar, info, viewRide);
        return driverCard;
    }

    function resolveAcceptedRideRoute(ride) {
        if (ride.mapOrigin && ride.mapDestination) return ride;
        const matchingBatch = Array.from(document.querySelectorAll('.batch-drivers-button')).find((button) => {
            return rideDetailsFromButton(button).id === ride.id;
        });
        return {
            ...ride,
            mapOrigin: ride.mapOrigin || matchingBatch?.dataset.rideMapOrigin || (ride.origin + ', Philippines'),
            mapDestination: ride.mapDestination || matchingBatch?.dataset.rideMapDestination || (ride.destination + ', Philippines')
        };
    }

    function updateAcceptButton() {
        if (!activeRide) return;
        const alreadyAccepted = getAcceptedRides().some((ride) => ride.id === activeRide.id);
        acceptRideButton.disabled = alreadyAccepted;
        acceptRideButton.textContent = alreadyAccepted
            ? 'Ride accepted'
            : (isSignedIn ? 'Accept ride' : 'Sign in to accept');
    }

    function renderChat() {
        chatMessages.replaceChildren();
        const messages = messageThreads.get(activeThread) || [];
        messages.forEach((message) => {
            const bubble = document.createElement('p');
            bubble.className = 'chat-bubble ' + message.sender;
            bubble.textContent = message.text;
            chatMessages.append(bubble);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    const driversModal = document.querySelector('#drivers-modal');
    const availableDriverList = document.querySelector('#available-driver-list');
    const driversModalSubtitle = document.querySelector('#drivers-modal-subtitle');

    function showRideDetails(button, ownOffer = null, rideRecord = null, rideRecordType = 'batch') {
        const title = ownOffer ? ownOffer.title : (rideRecord ? rideRecord.title : button.dataset.rideTitle);
        activeRide = ownOffer ? null : (rideRecord || rideDetailsFromButton(button));
        document.querySelector('#ride-modal-title').textContent = ownOffer ? title + ' · Your offer' : title;
        activeDriver = ownOffer ? 'You' : (rideRecord ? rideRecord.driver : button.dataset.rideDriver);
        const rideTime = ownOffer || rideRecord
            ? (ownOffer || rideRecord).day + ' at ' + (ownOffer || rideRecord).timeLabel
            : button.closest('.ride-card').querySelector('.ride-date').getAttribute('aria-label');
        activeThread = title + '|' + rideTime + '|' + activeDriver;
        document.querySelector('#ride-modal-driver').textContent = activeDriver;
        const isOwnOffer = Boolean(ownOffer);
        rideModal.classList.toggle('ride-modal-own-offer', isOwnOffer);
        chatContent.hidden = isOwnOffer || !isSignedIn;
        chatLocked.hidden = isOwnOffer || isSignedIn;
        document.querySelector('.driver-chat').hidden = isOwnOffer;
        acceptRideButton.hidden = isOwnOffer || rideRecordType === 'accepted';
        acceptRideButton.disabled = false;
        updateAcceptButton();
        if (!messageThreads.has(activeThread)) {
            messageThreads.set(activeThread, [{ sender: 'driver', text: 'Hi, I’m ' + activeDriver + '. Feel free to ask me about this ride.' }]);
        }
        renderChat();
        const rideDetails = ownOffer || rideRecord;
        const origin = rideDetails ? rideDetails.origin : button.dataset.rideOrigin;
        const destination = rideDetails ? rideDetails.destination : button.dataset.rideDestination;
        const mapOrigin = rideDetails ? (rideDetails.mapOrigin || origin) : button.dataset.rideMapOrigin;
        const mapDestination = rideDetails ? (rideDetails.mapDestination || destination) : button.dataset.rideMapDestination;
        document.querySelector('#ride-modal-origin').textContent = origin;
        document.querySelector('#ride-modal-destination').textContent = destination;
        document.querySelector('#ride-modal-vehicle').textContent = rideDetails ? (rideDetails.vehicle || 'Not specified') : button.dataset.rideVehicle;
        document.querySelector('#ride-modal-seats').textContent = ownOffer
            ? ownOffer.availableSeats + (ownOffer.availableSeats === 1 ? ' seat' : ' seats')
            : (rideRecord
                ? (rideRecordType === 'accepted'
                    ? 'Accepted'
                    : rideRecord.availableSeats + (rideRecord.availableSeats === 1 ? ' seat' : ' seats'))
                : (button.dataset.rideSeats || '—'));
        document.querySelector('#ride-modal-schedule').textContent = rideDetails ? rideDetails.day + ' · ' + rideDetails.timeLabel : rideTime.replace(/^\w+\s+at\s+/i, '');
        const encodedOrigin = encodeURIComponent(mapOrigin);
        const encodedDestination = encodeURIComponent(mapDestination);
        document.querySelector('#ride-modal-map').src = 'https://www.google.com/maps?output=embed&saddr=' + encodedOrigin + '&daddr=' + encodedDestination + '&z=9&region=PH';
        document.querySelector('#ride-modal-map-link').href = 'https://www.google.com/maps/dir/?api=1&origin=' + encodedOrigin + '&destination=' + encodedDestination + '&travelmode=driving';
        rideModal.showModal();
    }

    window.addEventListener('pagibig:show-own-ride-offer', (event) => {
        showRideDetails(null, event.detail);
    });

    acceptRideButton.addEventListener('click', () => {
        if (!isSignedIn) {
            window.location.href = 'auth/login.html';
            return;
        }
        if (!activeRide) return;

        const rides = getAcceptedRides();
        if (!rides.some((ride) => ride.id === activeRide.id)) {
            rides.push(activeRide);
            sessionStorage.setItem(acceptedRidesStorageKey, JSON.stringify(rides));
        }
        renderAcceptedRides();
        rideModal.close();
        if (driversModal.open) driversModal.close();
        acceptedRidesSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    document.querySelectorAll('.batch-drivers-button').forEach((button) => {
        button.addEventListener('click', () => {
            const batch = rideDetailsFromButton(button);
            driversModalSubtitle.textContent = batch.title + ' · ' + batch.day + ' · ' + batch.timeLabel;
            availableDriverList.replaceChildren();

            const originalDriver = {
                name: button.dataset.rideDriver,
                vehicle: button.dataset.rideVehicle,
                origin: button.dataset.rideOrigin,
                destination: button.dataset.rideDestination,
                availableSeats: Number.parseInt(button.dataset.rideSeats, 10) || 1
            };
            availableDriverList.append(createAvailableDriverCard(originalDriver, () => showRideDetails(button)));

            (sampleDriversByService[batch.title] || []).forEach((driver) => {
                const sampleRide = {
                    ...batch,
                    ...driver,
                    destination: button.dataset.rideDestination,
                    availableSeats: driver.seats,
                    driver: driver.name,
                    mapOrigin: driver.origin + ', Philippines',
                    mapDestination: button.dataset.rideMapDestination,
                    id: JSON.stringify(['sample', batch.title, batch.day, batch.timeLabel, driver.name, driver.origin])
                };
                availableDriverList.append(createAvailableDriverCard(sampleRide, () => {
                    showRideDetails(null, null, sampleRide, 'batch');
                }));
            });

            getCreatedOffersForBatch(button).forEach((offer) => {
                const driver = {
                    name: offer.driver,
                    vehicle: offer.vehicle,
                    origin: offer.origin,
                    destination: offer.destination,
                    availableSeats: offer.availableSeats
                };
                const viewOffer = offer.isOwnOffer
                    ? () => showRideDetails(null, offer)
                    : () => showRideDetails(null, null, offer, 'offer');
                availableDriverList.append(createAvailableDriverCard(driver, viewOffer));
            });

            driversModal.showModal();
        });
    });

    chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = chatInput.value.trim();
        if (!text || !activeDriver) return;
        const messages = messageThreads.get(activeThread) || [];
        messages.push({ sender: 'rider', text });
        messageThreads.set(activeThread, messages);
        renderChat();
        chatInput.value = '';
        chatInput.focus();
    });

    document.querySelector('#ride-modal .ride-modal-close').addEventListener('click', () => rideModal.close());
    document.querySelector('.drivers-modal-close').addEventListener('click', () => driversModal.close());
    rideModal.addEventListener('click', (event) => {
        if (event.target === rideModal) rideModal.close();
    });
    driversModal.addEventListener('click', (event) => {
        if (event.target === driversModal) driversModal.close();
    });

    renderAcceptedRides();
})();
