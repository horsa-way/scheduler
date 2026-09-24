import {
    get_common_fitting_level,
    get_lower_text_candidates,
    get_upper_grouping,
    get_upper_text_candidates,
    pick_fitting_label,
} from '../src/date_labels';

function format_it(date, options) {
    return new Intl.DateTimeFormat('it', Object.assign({ timeZone: 'UTC' }, options)).format(date);
}

test('get_lower_text_candidates returns progressive week candidates in it locale', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    const candidates = get_lower_text_candidates(date, { unit: 'week', value: 1 }, 'it');

    expect(candidates[0]).toContain('2026');
    expect(candidates[0]).toMatch(/[A-Z]/);
    expect(candidates[candidates.length - 1]).toBe(format_it(date, { day: 'numeric' }));
    expect(candidates.length).toBeGreaterThanOrEqual(3);
});

test('get_lower_text_candidates returns month variants and removes duplicates', () => {
    const date = new Date(Date.UTC(2026, 0, 1));
    const candidates = get_lower_text_candidates(date, { unit: 'month', value: 1 }, 'it');
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    expect(candidates[0]).toMatch(/^[A-Z]/);
});

test('get_lower_text_candidates returns year label for yearly tick', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    const candidates = get_lower_text_candidates(date, { unit: 'year', value: 1 }, 'it');

    expect(candidates).toEqual(['2026']);
});

test('get_lower_text_candidates returns intraday time hierarchy', () => {
    const date = new Date(Date.UTC(2026, 8, 14, 9, 5));
    const candidates = get_lower_text_candidates(date, { unit: 'minute', value: 60 }, 'it');

    expect(candidates.length).toBeGreaterThanOrEqual(3);
});

test('get_lower_text_candidates returns daily hierarchy for minute ticks >= one day', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    const candidates = get_lower_text_candidates(date, { unit: 'minute', value: 24 * 60 }, 'it');

    expect(candidates[candidates.length - 1]).toBe(format_it(date, { day: 'numeric' }));
});

test('get_upper_grouping maps intraday to day and daily to month', () => {
    expect(get_upper_grouping({ unit: 'minute', value: 60 })).toEqual({ unit: 'day' });
    expect(get_upper_grouping({ unit: 'minute', value: 24 * 60 })).toEqual({ unit: 'month' });
});

test('get_upper_grouping maps month to year and year to null', () => {
    expect(get_upper_grouping({ unit: 'month', value: 1 })).toEqual({ unit: 'year' });
    expect(get_upper_grouping({ unit: 'year', value: 1 })).toBe(null);
});

test('get_upper_text_candidates returns day period variants with month and year', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    const candidates = get_upper_text_candidates(date, 'day', 'it');

    expect(candidates.length).toBeGreaterThanOrEqual(3);
    expect(candidates[0]).toContain('2026');
    expect(candidates[0]).toMatch(/[A-Z]/);
});

test('get_upper_text_candidates returns month and year variants', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    const candidates = get_upper_text_candidates(date, 'month', 'it');

    expect(candidates[0]).toContain('2026');
    expect(candidates.length).toBeGreaterThanOrEqual(3);
});

test('get_upper_text_candidates returns year label', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    const candidates = get_upper_text_candidates(date, 'year', 'it');

    expect(candidates).toEqual(['2026']);
});

test('italian month names are capitalized in lower labels', () => {
    const date = new Date(Date.UTC(2027, 2, 1));
    const candidates = get_lower_text_candidates(date, { unit: 'month', value: 1 }, 'it');

    expect(candidates[0]).toContain('Marzo');
});

test('italian month names are capitalized inside upper day labels', () => {
    const date = new Date(Date.UTC(2027, 2, 1));
    const candidates = get_upper_text_candidates(date, 'day', 'it');

    expect(candidates[0]).toContain('Marzo');
});

test('pick_fitting_label keeps full label when width is enough', () => {
    const chosen = pick_fitting_label(
        ['14 settembre 2026', '14 set 26', '14/09', '14'],
        140,
        (text) => text.length * 7
    );

    expect(chosen).toBe('14 settembre 2026');
});

test('pick_fitting_label falls back to compact label on tight width', () => {
    const chosen = pick_fitting_label(
        ['14 settembre 2026', '14 set 26', '14/09', '14'],
        40,
        (text) => text.length * 7
    );

    expect(chosen).toBe('14/09');
});

test('pick_fitting_label always returns a label even in extreme constraints', () => {
    const chosen = pick_fitting_label(
        ['14 settembre 2026', '14 set 26', '14/09', '14'],
        0,
        (text) => text.length * 7
    );

    expect(chosen).toBe('14');
});

test('get_common_fitting_level chooses the same compact level for all columns when one is narrow', () => {
    const candidate_matrix = [
        ['1 Mar', '1'],
        ['3 Mar', '3'],
        ['5 Mar', '5'],
    ];
    const available_widths = [50, 10, 50];

    const chosen_level = get_common_fitting_level(candidate_matrix, available_widths, (label) => {
        return label.length * 7;
    });

    expect(chosen_level).toBe(1);
});

test('get_common_fitting_level keeps informative level when every column fits', () => {
    const candidate_matrix = [
        ['1 Mar', '1'],
        ['3 Mar', '3'],
    ];
    const available_widths = [60, 60];

    const chosen_level = get_common_fitting_level(candidate_matrix, available_widths, (label) => {
        return label.length * 7;
    });

    expect(chosen_level).toBe(0);
});
