(function () {
    const batchCards = Array.from(document.querySelectorAll('.rides-wrap > .ride-card'));
    const gatheringFilter = document.querySelector('#batch-type-filter');
    const timeFilter = document.querySelector('#batch-time-filter');
    const emptyMessage = document.querySelector('#batch-filter-empty');

    function getBatchTime(card) {
        const label = card.querySelector('.ride-date')?.getAttribute('aria-label') || '';
        return label.match(/\bat\s+(.+)$/i)?.[1]?.trim() || '';
    }

    function getGatheringType(title) {
        if (/Prayer Meeting$/i.test(title)) return 'prayer-meeting';
        if (/Worship Service$/i.test(title)) return 'worship-service';
        if (/Thanksgiving$/i.test(title)) return 'thanksgiving';
        return 'other';
    }

    Array.from(new Set(batchCards.map(getBatchTime).filter(Boolean))).forEach((time) => {
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time;
        timeFilter.append(option);
    });

    function applyFilters() {
        const selectedType = gatheringFilter.value;
        const selectedTime = timeFilter.value;
        let visibleCount = 0;

        batchCards.forEach((card) => {
            const title = card.querySelector('.ride-title-row h3')?.textContent.trim() || '';
            const typeMatches = selectedType === 'all' || getGatheringType(title) === selectedType;
            const timeMatches = selectedTime === 'all' || getBatchTime(card) === selectedTime;
            card.hidden = !(typeMatches && timeMatches);
            if (!card.hidden) visibleCount += 1;
        });

        emptyMessage.hidden = visibleCount > 0;
    }

    gatheringFilter.addEventListener('change', applyFilters);
    timeFilter.addEventListener('change', applyFilters);
})();
