function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function get_pointer_x_in_container(client_x, container_left, container_width) {
    return clamp(client_x - container_left, 0, container_width);
}

export function get_timeline_x_from_client(
    client_x,
    container_left,
    container_width,
    scroll_left
) {
    return scroll_left + get_pointer_x_in_container(client_x, container_left, container_width);
}

export function snap_date_to_minutes(date, snap_minutes) {
    const snap_ms = Math.max(1, snap_minutes) * 60 * 1000;
    return new Date(Math.round(date.getTime() / snap_ms) * snap_ms);
}

export function find_row_id_at_svg_y(rows, svg_y) {
    for (let row of rows) {
        if (svg_y >= row.y && svg_y < row.y + row.height) {
            return row.id;
        }
    }

    return null;
}