import {
    find_row_id_at_svg_y,
    get_pointer_x_in_container,
    get_timeline_x_from_client,
    snap_date_to_minutes,
} from '../src/interaction_utils';

test('get_pointer_x_in_container clamps inside container bounds', () => {
    expect(get_pointer_x_in_container(80, 100, 300)).toBe(0);
    expect(get_pointer_x_in_container(100, 100, 300)).toBe(0);
    expect(get_pointer_x_in_container(250, 100, 300)).toBe(150);
    expect(get_pointer_x_in_container(450, 100, 300)).toBe(300);
    expect(get_pointer_x_in_container(520, 100, 300)).toBe(300);
});

test('get_timeline_x_from_client accounts for scroll offset', () => {
    expect(get_timeline_x_from_client(250, 100, 300, 0)).toBe(150);
    expect(get_timeline_x_from_client(250, 100, 300, 500)).toBe(650);
    expect(get_timeline_x_from_client(80, 100, 300, 500)).toBe(500);
    expect(get_timeline_x_from_client(520, 100, 300, 500)).toBe(800);
});

test('snap_date_to_minutes snaps to nearest configured bucket', () => {
    const base = new Date(Date.UTC(2026, 0, 1, 10, 0, 0, 0));

    const plus_29 = new Date(base.getTime() + 29 * 60 * 1000);
    const plus_31 = new Date(base.getTime() + 31 * 60 * 1000);
    const minus_31 = new Date(base.getTime() - 31 * 60 * 1000);

    expect(snap_date_to_minutes(plus_29, 30).getTime()).toBe(base.getTime() + 30 * 60 * 1000);
    expect(snap_date_to_minutes(plus_31, 30).getTime()).toBe(base.getTime() + 30 * 60 * 1000);
    expect(snap_date_to_minutes(minus_31, 30).getTime()).toBe(base.getTime() - 30 * 60 * 1000);
});

test('find_row_id_at_svg_y resolves row across boundaries', () => {
    const rows = [
        { id: 'row-1', y: 40, height: 20 },
        { id: 'row-2', y: 60, height: 30 },
        { id: 'row-3', y: 90, height: 25 },
    ];

    expect(find_row_id_at_svg_y(rows, 39.9)).toBe(null);
    expect(find_row_id_at_svg_y(rows, 40)).toBe('row-1');
    expect(find_row_id_at_svg_y(rows, 59.99)).toBe('row-1');
    expect(find_row_id_at_svg_y(rows, 60)).toBe('row-2');
    expect(find_row_id_at_svg_y(rows, 89.99)).toBe('row-2');
    expect(find_row_id_at_svg_y(rows, 90)).toBe('row-3');
    expect(find_row_id_at_svg_y(rows, 114.99)).toBe('row-3');
    expect(find_row_id_at_svg_y(rows, 115)).toBe(null);
});