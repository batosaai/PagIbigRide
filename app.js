const isSignedIn = sessionStorage.getItem('pagibigRideSignedIn') === 'true';

if (isSignedIn) {
    document.querySelector('.navlinks')?.remove();
    document.querySelectorAll('[data-guest-only]').forEach((link) => link.remove());
}

const rideModal = document.querySelector('#ride-modal');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#chat-input');
const chatContent = document.querySelector('#driver-chat-content');
const chatLocked = document.querySelector('#driver-chat-locked');
const chatMessages = document.querySelector('#chat-messages');
const messageThreads = new Map();
let activeDriver = '';
let activeThread = '';

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

function showRideDetails(button) {
    document.querySelector('#ride-modal-title').textContent = button.dataset.rideTitle;
    activeDriver = button.dataset.rideDriver;
    const rideTime = button.closest('.ride-card').querySelector('.ride-date').getAttribute('aria-label');
    activeThread = button.dataset.rideTitle + '|' + rideTime;
    document.querySelector('#ride-modal-driver').textContent = activeDriver;
    chatContent.hidden = !isSignedIn;
    chatLocked.hidden = isSignedIn;
    if (!messageThreads.has(activeThread)) {
        messageThreads.set(activeThread, [{ sender: 'driver', text: 'Hi, I’m ' + activeDriver + '. Feel free to ask me about this ride.' }]);
    }
    renderChat();
    document.querySelector('#ride-modal-origin').textContent = button.dataset.rideOrigin;
    document.querySelector('#ride-modal-destination').textContent = button.dataset.rideDestination;
    document.querySelector('#ride-modal-vehicle').textContent = button.dataset.rideVehicle;
    const encodedOrigin = encodeURIComponent(button.dataset.rideMapOrigin);
    const encodedDestination = encodeURIComponent(button.dataset.rideMapDestination);
    document.querySelector('#ride-modal-map').src = 'https://www.google.com/maps?output=embed&saddr=' + encodedOrigin + '&daddr=' + encodedDestination;
    document.querySelector('#ride-modal-map-link').href = 'https://www.google.com/maps/dir/?api=1&origin=' + encodedOrigin + '&destination=' + encodedDestination + '&travelmode=driving';
    rideModal.showModal();
}

document.querySelectorAll('.batch-drivers-button').forEach((button) => {
    button.addEventListener('click', () => {
        const rideCard = button.closest('.ride-card');
        const rideTime = rideCard.querySelector('.ride-date').getAttribute('aria-label');
        const seats = button.dataset.rideSeats;
        const rideTimeLabel = rideTime.replace(/^\w+\s+at\s+/i, '');
        driversModalSubtitle.textContent = button.dataset.rideTitle + ' · ' + rideTimeLabel;
        availableDriverList.replaceChildren();

        const driverCard = document.createElement('article');
        driverCard.className = 'available-driver-card';
        const initials = button.dataset.rideDriver.trim().split(/\s+/).pop()[0];
        const avatar = document.createElement('span');
        avatar.className = 'driver-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = initials;

        const info = document.createElement('div');
        info.className = 'available-driver-info';
        const name = document.createElement('h3');
        name.textContent = button.dataset.rideDriver;
        const details = document.createElement('p');
        details.textContent = button.dataset.rideVehicle + ' · Pickup: ' + button.dataset.rideOrigin + ' · To: ' + button.dataset.rideDestination + (seats ? ' · ' + seats : '');
        info.append(name, details);

        const viewRide = document.createElement('button');
        viewRide.type = 'button';
        viewRide.className = 'button available-driver-view';
        viewRide.textContent = 'View Details';
        viewRide.addEventListener('click', () => showRideDetails(button));

        driverCard.append(avatar, info, viewRide);
        availableDriverList.append(driverCard);
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
