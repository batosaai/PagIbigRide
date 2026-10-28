(function () {
    const batchCards = Array.from(document.querySelectorAll('.rides-wrap > .ride-card'));
    const emptyMessage = document.querySelector('#batch-filter-empty');
    const typeOptions = [
        { value: 'all', label: 'All gathering types' },
        { value: 'prayer-meeting', label: 'Prayer meetings' },
        { value: 'worship-service', label: 'Worship service' },
        { value: 'thanksgiving', label: 'Thanksgiving' }
    ];
    const typeFilter = createFilter('batch-type-filter', 'batch-type-options', typeOptions, 'all');
    const times = Array.from(new Set(batchCards.map(getBatchTime).filter(Boolean)));
    const timeOptions = [{ value: 'all', label: 'Any time' }, ...times.map((time) => ({ value: time, label: time }))];
    const timeFilter = createFilter('batch-time-filter', 'batch-time-options', timeOptions, 'all');
    const filters = [typeFilter, timeFilter];

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

    function createFilter(triggerId, menuId, options, initialValue) {
        const trigger = document.getElementById(triggerId);
        const valueLabel = trigger.querySelector('.batch-filter-value');
        const menu = document.getElementById(menuId);
        const wrapper = trigger.closest('.batch-filter');
        const filter = { trigger, valueLabel, menu, wrapper, value: initialValue };

        options.forEach((option) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'batch-filter-option';
            item.setAttribute('role', 'option');
            item.dataset.value = option.value;
            item.textContent = option.label;
            item.setAttribute('aria-selected', String(option.value === initialValue));
            item.addEventListener('click', () => {
                filter.value = option.value;
                valueLabel.textContent = option.label;
                menu.querySelectorAll('[role="option"]').forEach((choice) => {
                    choice.setAttribute('aria-selected', String(choice === item));
                });
                closeFilter(filter, true);
                applyFilters();
            });
            menu.append(item);
        });

        trigger.addEventListener('click', () => {
            if (trigger.getAttribute('aria-expanded') === 'true') {
                closeFilter(filter);
            } else {
                openFilter(filter);
            }
        });

        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                openFilter(filter, event.key === 'ArrowUp');
            }
        });

        menu.addEventListener('keydown', (event) => {
            const choices = Array.from(menu.querySelectorAll('[role="option"]'));
            const activeIndex = choices.indexOf(document.activeElement);
            let nextIndex = activeIndex;
            if (event.key === 'ArrowDown') nextIndex = Math.min(activeIndex + 1, choices.length - 1);
            else if (event.key === 'ArrowUp') nextIndex = Math.max(activeIndex - 1, 0);
            else if (event.key === 'Home') nextIndex = 0;
            else if (event.key === 'End') nextIndex = choices.length - 1;
            else if (event.key === 'Escape') {
                event.preventDefault();
                closeFilter(filter, true);
                return;
            } else {
                return;
            }
            event.preventDefault();
            choices[nextIndex]?.focus();
        });

        wrapper.addEventListener('focusout', () => {
            window.setTimeout(() => {
                if (!wrapper.contains(document.activeElement)) closeFilter(filter);
            }, 0);
        });

        return filter;
    }

    function openFilter(filter, focusLast = false) {
        filters.forEach((otherFilter) => closeFilter(otherFilter));
        filter.menu.hidden = false;
        filter.trigger.setAttribute('aria-expanded', 'true');
        const choices = Array.from(filter.menu.querySelectorAll('[role="option"]'));
        const selected = choices.find((choice) => choice.dataset.value === filter.value);
        (focusLast ? choices[choices.length - 1] : selected || choices[0])?.focus();
    }

    function closeFilter(filter, returnFocus = false) {
        filter.menu.hidden = true;
        filter.trigger.setAttribute('aria-expanded', 'false');
        if (returnFocus) filter.trigger.focus();
    }

    function applyFilters() {
        let visibleCount = 0;
        batchCards.forEach((card) => {
            const title = card.querySelector('.ride-title-row h3')?.textContent.trim() || '';
            const typeMatches = typeFilter.value === 'all' || getGatheringType(title) === typeFilter.value;
            const timeMatches = timeFilter.value === 'all' || getBatchTime(card) === timeFilter.value;
            card.hidden = !(typeMatches && timeMatches);
            if (!card.hidden) visibleCount += 1;
        });
        emptyMessage.hidden = visibleCount > 0;
    }

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.batch-filter')) filters.forEach((filter) => closeFilter(filter));
    });
})();
