const VIEW_STEP_MINUTES = {
    Hour: 60,
    'Quarter Day': 24 * 60 / 4,
    'Half Day': 24 * 60 / 2,
    Day: 24 * 60,
    Week: 7 * 24 * 60,
    Month: 30 * 24 * 60,
    Year: 365 * 24 * 60,
};

const VIEW_COLUMN_WIDTH = {
    Hour: 60,
    'Quarter Day': 48,
    'Half Day': 48,
    Day: 48,
    Week: 168,
    Month: 150,
    Year: 120,
};

const VIEW_CALENDAR_UNIT = {
    Week: 'week',
    Month: 'month',
    Year: 'year',
};

const TICK_CANDIDATES_MINUTES = [
    15,
    30,
    60,
    120,
    180,
    360,
    720,
    1440,
    2880,
    10080,
    20160,
    43200,
    129600,
    262800,
    525600,
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function get_view_preset(view_mode) {
    return {
        step_minutes: VIEW_STEP_MINUTES[view_mode] || VIEW_STEP_MINUTES.Day,
        column_width: VIEW_COLUMN_WIDTH[view_mode] || VIEW_COLUMN_WIDTH.Day,
        calendar_unit: VIEW_CALENDAR_UNIT[view_mode] || null,
    };
}

export function get_nearest_view_mode(step_minutes, view_modes) {
    const modes = view_modes && view_modes.length ? view_modes : Object.keys(VIEW_STEP_MINUTES);
    const safe_step = Math.max(step_minutes, 1);
    let nearest = modes[0];
    let min_distance = Number.POSITIVE_INFINITY;

    for (let mode of modes) {
        const preset_step = VIEW_STEP_MINUTES[mode] || VIEW_STEP_MINUTES.Day;
        const distance = Math.abs(Math.log(safe_step / preset_step));
        if (distance < min_distance) {
            min_distance = distance;
            nearest = mode;
        }
    }

    return nearest;
}

export function clamp_zoom_step(step_minutes, min_step = 15, max_step = VIEW_STEP_MINUTES.Year) {
    return clamp(step_minutes, min_step, max_step);
}

export function zoom_step_from_wheel(step_minutes, wheel_delta, min_step = 15, max_step = VIEW_STEP_MINUTES.Year) {
    const factor = Math.exp(wheel_delta * 0.0015);
    return clamp_zoom_step(step_minutes * factor, min_step, max_step);
}

export function get_tick_step_minutes(step_minutes, column_width, minimum_tick_px = 40) {
    for (let candidate of TICK_CANDIDATES_MINUTES) {
        const px = (candidate / step_minutes) * column_width;
        if (px >= minimum_tick_px) {
            return candidate;
        }
    }

    return TICK_CANDIDATES_MINUTES[TICK_CANDIDATES_MINUTES.length - 1];
}

export function get_max_zoom_step_for_width(
    range_minutes,
    column_width,
    minimum_width,
    fallback_max_step = VIEW_STEP_MINUTES.Month
) {
    if (!Number.isFinite(range_minutes) || !Number.isFinite(column_width) || !Number.isFinite(minimum_width)) {
        return fallback_max_step;
    }

    if (range_minutes <= 0 || column_width <= 0 || minimum_width <= 0) {
        return fallback_max_step;
    }

    const derived_max_step = (range_minutes * column_width) / minimum_width;
    if (!Number.isFinite(derived_max_step) || derived_max_step <= 0) {
        return fallback_max_step;
    }

    return Math.min(derived_max_step, fallback_max_step);
}
