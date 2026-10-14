import {
    get_weekend_ranges_in_viewport,
    should_render_weekend_highlights,
} from '../src/calendar_highlights';
import { get_tick_step_minutes } from '../src/time_scale';

test('weekend highlights are enabled for minute ticks up to daily and disabled above', () => {
    expect(should_render_weekend_highlights({ unit: 'minute', value: 24 * 60 })).toBe(true);
    expect(should_render_weekend_highlights({ unit: 'minute', value: 12 * 60 })).toBe(true);
    expect(should_render_weekend_highlights({ unit: 'minute', value: (24 * 60) + 1 })).toBe(false);
});

test('weekend highlights are disabled for non-minute units', () => {
    expect(should_render_weekend_highlights({ unit: 'week', value: 1 })).toBe(false);
    expect(should_render_weekend_highlights({ unit: 'month', value: 1 })).toBe(false);
    expect(should_render_weekend_highlights({ unit: 'year', value: 1 })).toBe(false);
});

test('collects saturday and sunday ranges in viewport', () => {
    const start = new Date(Date.UTC(2026, 9, 16, 10, 0, 0, 0)); // Friday
    const end = new Date(Date.UTC(2026, 9, 20, 10, 0, 0, 0)); // Tuesday

    const ranges = get_weekend_ranges_in_viewport(start, end, { unit: 'minute', value: 24 * 60 });

    expect(ranges.length).toBe(2);
    expect(ranges[0].start.toISOString()).toBe('2026-10-17T00:00:00.000Z');
    expect(ranges[0].end.toISOString()).toBe('2026-10-18T00:00:00.000Z');
    expect(ranges[1].start.toISOString()).toBe('2026-10-18T00:00:00.000Z');
    expect(ranges[1].end.toISOString()).toBe('2026-10-19T00:00:00.000Z');
});

test('returns empty ranges when zoom is above daily threshold', () => {
    const start = new Date(Date.UTC(2026, 9, 16, 0, 0, 0, 0));
    const end = new Date(Date.UTC(2026, 9, 20, 0, 0, 0, 0));

    const ranges = get_weekend_ranges_in_viewport(start, end, { unit: 'minute', value: (24 * 60) + 1 });

    expect(ranges).toEqual([]);
});

test('weekend highlight availability follows rendered tick size, not raw zoom_step', () => {
    const tick_from_hour_like_width = get_tick_step_minutes(2000, 60);
    const tick_from_day_like_width = get_tick_step_minutes(2000, 48);

    expect(tick_from_hour_like_width).toBe(24 * 60);
    expect(tick_from_day_like_width).toBe(48 * 60);
    expect(should_render_weekend_highlights({ unit: 'minute', value: tick_from_hour_like_width })).toBe(true);
    expect(should_render_weekend_highlights({ unit: 'minute', value: tick_from_day_like_width })).toBe(false);

    const start = new Date(Date.UTC(2026, 9, 16, 0, 0, 0, 0));
    const end = new Date(Date.UTC(2026, 9, 20, 0, 0, 0, 0));
    const ranges = get_weekend_ranges_in_viewport(start, end, {
        unit: 'minute',
        value: tick_from_hour_like_width,
    });

    expect(ranges.length).toBe(2);
});