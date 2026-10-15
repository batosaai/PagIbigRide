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

document.querySelectorAll('.ride-details-button').forEach((button) => {
    button.addEventListener('click', () => {
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
        const mapOrigin = button.dataset.rideMapOrigin;
        const mapDestination = button.dataset.rideMapDestination;
        const encodedDestination = encodeURIComponent(mapDestination);
        const encodedOrigin = encodeURIComponent(mapOrigin);
        document.querySelector('#ride-modal-map').src = 'https://www.google.com/maps?output=embed&saddr=' + encodedOrigin + '&daddr=' + encodedDestination;
        document.querySelector('#ride-modal-map-link').href = 'https://www.google.com/maps/dir/?api=1&origin=' + encodedOrigin + '&destination=' + encodedDestination + '&travelmode=driving';
        rideModal.showModal();
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

document.querySelector('.ride-modal-close').addEventListener('click', () => rideModal.close());
rideModal.addEventListener('click', (event) => {
    if (event.target === rideModal) rideModal.close();
});
