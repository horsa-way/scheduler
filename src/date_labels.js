function format_date_part(date, language, options) {
    const formatter = new Intl.DateTimeFormat(language, Object.assign({ timeZone: 'UTC' }, options));
    const parts = formatter.formatToParts(date);

    return parts.map((part) => {
        if (part.type !== 'month') {
            return part.value;
        }

        if (!part.value || !part.value.length) {
            return part.value;
        }

        return part.value.charAt(0).toLocaleUpperCase(language) + part.value.slice(1);
    }).join('');
}

function compact_values(values) {
    return (values || []).map((value) => String(value || '').trim()).filter((value) => value.length > 0);
}

function unique_values(values) {
    const seen = new Set();
    const unique = [];

    compact_values(values).forEach((value) => {
        if (seen.has(value)) {
            return;
        }
        seen.add(value);
        unique.push(value);
    });

    return unique;
}

export function get_coarse_lower_text_candidates(date, tick_unit, language = 'it') {
    if (tick_unit === 'week') {
        return unique_values([
            format_date_part(date, language, { day: 'numeric', month: 'long', year: 'numeric' }),
            format_date_part(date, language, { day: 'numeric', month: 'short', year: '2-digit' }),
            format_date_part(date, language, { day: '2-digit', month: '2-digit' }),
            format_date_part(date, language, { day: 'numeric' }),
        ]);
    }

    if (tick_unit === 'month') {
        return unique_values([
            format_date_part(date, language, { month: 'long' }),
            format_date_part(date, language, { month: 'short' }),
            format_date_part(date, language, { month: '2-digit' }),
        ]);
    }

    if (tick_unit === 'year') {
        return unique_values([
            format_date_part(date, language, { year: 'numeric' }),
        ]);
    }

    return [];
}

export function get_lower_text_candidates(date, tick_info, language = 'it') {
    if (!tick_info) {
        return [];
    }

    if (tick_info.unit === 'year') {
        return compact_values([
            format_date_part(date, language, { year: 'numeric' }),
        ]);
    }

    if (tick_info.unit === 'month') {
        return compact_values([
            format_date_part(date, language, { month: 'long' }),
            format_date_part(date, language, { month: 'short' }),
            format_date_part(date, language, { month: '2-digit' }),
        ]);
    }

    if (tick_info.unit === 'week') {
        return compact_values([
            format_date_part(date, language, { day: 'numeric', month: 'long', year: 'numeric' }),
            format_date_part(date, language, { day: 'numeric', month: 'short', year: '2-digit' }),
            format_date_part(date, language, { day: '2-digit', month: '2-digit' }),
            format_date_part(date, language, { day: 'numeric' }),
        ]);
    }

    if (tick_info.unit !== 'minute') {
        return [];
    }

    if (tick_info.value < 24 * 60) {
        return compact_values([
            format_date_part(date, language, { hour: '2-digit', minute: '2-digit', hour12: false }),
            format_date_part(date, language, { hour: 'numeric', minute: '2-digit', hour12: false }),
            format_date_part(date, language, { hour: '2-digit', hour12: false }),
            format_date_part(date, language, { hour: 'numeric', hour12: false }),
        ]);
    }

    if (tick_info.value < 7 * 24 * 60) {
        return compact_values([
            format_date_part(date, language, { weekday: 'short', day: 'numeric', month: 'short' }),
            format_date_part(date, language, { day: 'numeric', month: 'short' }),
            format_date_part(date, language, { day: 'numeric' }),
        ]);
    }

    if (tick_info.value < 30 * 24 * 60) {
        return compact_values([
            format_date_part(date, language, { day: 'numeric', month: 'long', year: 'numeric' }),
            format_date_part(date, language, { day: 'numeric', month: 'short', year: '2-digit' }),
            format_date_part(date, language, { day: '2-digit', month: '2-digit' }),
            format_date_part(date, language, { day: 'numeric' }),
        ]);
    }

    if (tick_info.value < 365 * 24 * 60) {
        return compact_values([
            format_date_part(date, language, { month: 'long', year: 'numeric' }),
            format_date_part(date, language, { month: 'short', year: '2-digit' }),
            format_date_part(date, language, { month: '2-digit', year: '2-digit' }),
            format_date_part(date, language, { month: '2-digit' }),
        ]);
    }

    return compact_values([
        format_date_part(date, language, { year: 'numeric' }),
    ]);
}

export function get_common_fitting_level(candidate_matrix, available_widths, measure_text_width) {
    const max_levels = Math.max(
        0,
        ...(candidate_matrix || []).map((candidates) => (candidates || []).length)
    );

    if (!max_levels) {
        return 0;
    }

    for (let level = 0; level < max_levels; level++) {
        let fits_all = true;

        for (let index = 0; index < candidate_matrix.length; index++) {
            const candidates = candidate_matrix[index] || [];
            if (!candidates.length) {
                continue;
            }

            const candidate_index = Math.min(level, candidates.length - 1);
            const candidate = candidates[candidate_index];
            const max_width = Math.max(available_widths[index] || 0, 0);
            if (measure_text_width(candidate, index) > max_width) {
                fits_all = false;
                break;
            }
        }

        if (fits_all) {
            return level;
        }
    }

    return max_levels - 1;
}

export function get_upper_grouping(tick_info) {
    if (!tick_info || tick_info.unit === 'year') {
        return null;
    }

    if (tick_info.unit === 'month') {
        return { unit: 'year' };
    }

    if (tick_info.unit === 'week') {
        return { unit: 'month' };
    }

    if (tick_info.unit === 'minute') {
        if (tick_info.value < 24 * 60) {
            return { unit: 'day' };
        }

        return { unit: 'month' };
    }

    return null;
}

export function get_upper_text_candidates(date, period_unit, language = 'it') {
    if (period_unit === 'day') {
        return unique_values([
            format_date_part(date, language, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            }),
            format_date_part(date, language, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: '2-digit',
            }),
            format_date_part(date, language, {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
            }),
            format_date_part(date, language, {
                day: '2-digit',
                month: '2-digit',
            }),
        ]);
    }

    if (period_unit === 'month') {
        return unique_values([
            format_date_part(date, language, { month: 'long', year: 'numeric' }),
            format_date_part(date, language, { month: 'short', year: 'numeric' }),
            format_date_part(date, language, { month: 'short', year: '2-digit' }),
            format_date_part(date, language, { month: '2-digit', year: '2-digit' }),
        ]);
    }

    if (period_unit === 'year') {
        return unique_values([
            format_date_part(date, language, { year: 'numeric' }),
        ]);
    }

    return [];
}

export function pick_fitting_label(candidates, available_width, measure_text_width) {
    const valid_candidates = (candidates || []).filter((candidate) => {
        return typeof candidate === 'string' && candidate.trim().length > 0;
    });

    if (!valid_candidates.length) {
        return '';
    }

    const safe_width = Math.max(available_width || 0, 0);

    for (let candidate of valid_candidates) {
        if (measure_text_width(candidate) <= safe_width) {
            return candidate;
        }
    }

    return valid_candidates[valid_candidates.length - 1];
}
