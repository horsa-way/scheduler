import date_utils from './date_utils';

const DAILY_ZOOM_STEP_MINUTES = 24 * 60;

export function should_render_weekend_highlights(tick_info) {
    return Boolean(
        tick_info &&
        tick_info.unit === 'minute' &&
        tick_info.value <= DAILY_ZOOM_STEP_MINUTES
    );
}

export function get_weekend_ranges_in_viewport(view_start, view_end, tick_info) {
    if (!should_render_weekend_highlights(tick_info)) {
        return [];
    }

    if (!(view_start instanceof Date) || !(view_end instanceof Date) || view_end <= view_start) {
        return [];
    }

    const ranges = [];
    let day_start = date_utils.start_of(view_start, 'day');

    while (day_start < view_end) {
        const day_end = date_utils.add(day_start, 1, 'day');
        const day = day_start.getUTCDay();
        const overlaps_view = day_end > view_start && day_start < view_end;

        if (overlaps_view && (day === 0 || day === 6)) {
            ranges.push({
                start: day_start,
                end: day_end,
            });
        }

        day_start = day_end;
    }

    return ranges;
}