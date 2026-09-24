import {
    clamp_zoom_step,
    get_nearest_view_mode,
    get_tick_step_minutes,
    get_view_preset,
    zoom_step_from_wheel,
} from '../src/time_scale';

test('get_view_preset returns hour preset', () => {
    const preset = get_view_preset('Hour');
    expect(preset.step_minutes).toBe(60);
    expect(preset.column_width).toBe(60);
    expect(preset.calendar_unit).toBe(null);
});

test('get_view_preset returns calendar intervals for week and month', () => {
    expect(get_view_preset('Week').calendar_unit).toBe('week');
    expect(get_view_preset('Month').calendar_unit).toBe('month');
});

test('get_nearest_view_mode maps to day around daily scale', () => {
    const viewMode = get_nearest_view_mode(24 * 60, ['Hour', 'Day', 'Week']);
    expect(viewMode).toBe('Day');
});

test('clamp_zoom_step enforces min and max', () => {
    expect(clamp_zoom_step(5, 15, 100)).toBe(15);
    expect(clamp_zoom_step(1000, 15, 100)).toBe(100);
    expect(clamp_zoom_step(30, 15, 100)).toBe(30);
});

test('zoom_step_from_wheel zooms in and out', () => {
    const current = 24 * 60;
    const zoomIn = zoom_step_from_wheel(current, -120, 15, 365 * 24 * 60);
    const zoomOut = zoom_step_from_wheel(current, 120, 15, 365 * 24 * 60);

    expect(zoomIn).toBeLessThan(current);
    expect(zoomOut).toBeGreaterThan(current);
});

test('get_tick_step_minutes picks readable interval', () => {
    const tickMinutes = get_tick_step_minutes(60, 48, 80);
    expect(tickMinutes).toBeGreaterThanOrEqual(120);
});

test('get_tick_step_minutes preserves half-day subdivisions', () => {
    expect(get_tick_step_minutes(12 * 60, 48)).toBe(12 * 60);
});

test('get_tick_step_minutes preserves quarter-day subdivisions', () => {
    expect(get_tick_step_minutes(6 * 60, 48)).toBe(6 * 60);
});
