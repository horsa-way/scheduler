import date_utils from './date_utils';
import { $, createSVG } from './svg_utils';
import Bar from './bar';
import Arrow from './arrow';
import Popup from './popup';
import {
    clamp_zoom_step,
    get_max_zoom_step_for_width,
    get_nearest_view_mode,
    get_tick_step_minutes,
    get_view_preset,
    zoom_step_from_wheel,
} from './time_scale';
import {
    get_common_fitting_level,
    get_lower_text_candidates,
    get_upper_grouping,
    get_upper_text_candidates,
    pick_fitting_label,
} from './date_labels';

import './scheduler.scss';

const VIEW_MODE = {
    HOUR: 'Hour',
    QUARTER_DAY: 'Quarter Day',
    HALF_DAY: 'Half Day',
    DAY: 'Day',
    WEEK: 'Week',
    MONTH: 'Month',
    YEAR: 'Year',
};

export default class Scheduler {
    constructor(wrapper, tasks, cells, options) {
        this.setup_options(options);
        this.setup_wrapper(wrapper);
        this.setup_cells(cells);
        this.setup_tasks(tasks);
        this.setup_rows();
        // initialize with default view mode
        this.change_view_mode();
        this.pending_wheel_delta = 0;
        this.pending_wheel_event = null;
        this.wheel_animation_frame = null;
        this.bind_events();
    }

    setup_wrapper(element) {
        let svg_element, wrapper_element;

        // CSS Selector is passed
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        // get the SVGElement
        if (element instanceof HTMLElement) {
            wrapper_element = element;
            svg_element = element.querySelector('svg');
        } else if (element instanceof SVGElement) {
            svg_element = element;
        } else {
            throw new TypeError(
                'Scheduler only supports usage of a string CSS selector,' +
                " HTML DOM element or SVG DOM element for the 'element' parameter"
            );
        }

        // TODO da capire se da cambiare
        // svg element
        if (!svg_element) {
            // create it
            this.$svg = createSVG('svg', {
                append_to: wrapper_element,
                class: 'scheduler',
                id: 'schedulerSvg'
            });
            this.$column_svg = createSVG('svg', {
                append_to: wrapper_element,
                class: 'scheduler',
                id: 'columnSvg'
            });
        } else {
            this.$svg = svg_element;
            this.$svg.classList.add('scheduler');
            this.$column_svg = svg_element;
            this.$column_svg.classList.add('scheduler');
        }

        // TODO da rivedere questo giro di wrapper
        // wrapper element
        this.$container = document.createElement('div');
        this.$container.classList.add('scheduler-grid-container');
        this.$column_container = document.createElement('div');
        this.$column_container.classList.add('scheduler-columns-container');

        this.$container_parent = document.createElement('div');
        this.$container_parent.classList.add('scheduler-container');
        this.$container_parent.style.height = this.options.container_height + 'px';
        this.$container_parent.appendChild(this.$column_container);
        this.$container_parent.appendChild(this.$container);

        const parent_element = this.$svg.parentElement;
        parent_element.appendChild(this.$container_parent);
        this.$column_container.appendChild(this.$column_svg);
        this.$container.appendChild(this.$svg);

        // popup wrapper
        this.popup_wrapper = document.createElement('div');
        this.popup_wrapper.classList.add('popup-wrapper');
        this.$container_parent.appendChild(this.popup_wrapper);

        $.on(this.popup_wrapper, 'mouseleave', '.popup-wrapper', (e) => {
            this.hide_popup();
        });
    }

    setup_options(options) {
        const default_options = {
            container_height: 300,
            header_height: 50,
            date_start: null,
            date_end: null,
            view_modes: [...Object.values(VIEW_MODE)],
            bar_height: 20,
            bar_corner_radius: 3,
            arrow_curve: 5,
            padding: 18,
            view_mode: 'Day',
            date_format: 'YYYY-MM-DD',
            custom_popup_html: null,
            language: 'it',
            resize_left: false,
            resize_right: false,
            drag_drop_x: false,
            drag_drop_y: false,
            fixed_columns: [],
            rows: [],
            overlap: true,
            moving_scroll_bar: true,
            hide_fixed_columns: false,
            zoom_min_step: 15,
            zoom_max_step: 24 * 60 * 365,
            zoom_interactive_max_step: 30 * 24 * 60,
            time_axis_overscan: 600,
        };
        this.options = Object.assign({}, default_options, options);

        if (this.options.date_start)
            this.options.date_start = date_utils.normalize_UTC(new Date(this.options.date_start));
        if (this.options.date_end)
            this.options.date_end = date_utils.normalize_UTC(new Date(this.options.date_end));
    }

    setup_cells(cells) {
        this.cells = cells.filter(t => t.row && t.column);
    }

    setup_tasks(tasks) {
        // prepare tasks
        this.tasks = tasks.filter(t => t.row).map((task, i) => {
            return this.setup_task(task);
        }).filter(t => (
            ((!this.options.date_start || t._end >= this.options.date_start) &&
                (!this.options.date_end || t._start <= this.options.date_end) &&
                (
                    (t._start >= this.options.date_start && t._end <= this.options.date_end) ||  // Task within the range
                    (t._start < this.options.date_start && t._end >= this.options.date_start) ||  // Task starts before but ends during or after date_start
                    (t._start >= this.options.date_start && t._end > this.options.date_end)   // Task starts within the range but ends after date_end
                ))
        ));

        this.setup_dependencies();
    }

    setup_task(task) {
        let need_to_be_lock = false;
        // convert to Date objects
        task._start = date_utils.normalize_UTC(new Date(task.start));
        task._end = date_utils.normalize_UTC(new Date(task.end));
        if (this.options.date_end)
            if (task._end > this.options.date_end)
                need_to_be_lock = true;
        if (this.options.date_start)
            if (task._start < this.options.date_start)
                need_to_be_lock = true;

        // cache index
        task._index = this.options.rows.indexOf(task.row);
        if (task._index === -1) task._index = 0;

        // invalid dates
        if (!task.start && !task.end) {
            const today = date_utils.today();
            task._start = today;
            task._end = date_utils.add(today, 2, 'day');
        }

        if (!task.start && task.end) {
            task._start = date_utils.add(task._end, -2, 'day');
        }

        if (task.start && !task.end) {
            task._end = date_utils.add(task._start, 2, 'day');
        }

        // if hours is not set, assume the last day is full day
        // e.g: 2018-09-09 becomes 2018-09-09 23:59:59
        const task_end_values = date_utils.get_date_values(task._end);
        if (task_end_values.slice(3).every((d) => d === 0)) {
            // task._end = date_utils.add(task._end, 24, 'hour');
            task._end = date_utils.add(task._end, 23, 'hour');
            task._end = date_utils.add(task._end, 59, 'minute');
            task._end = date_utils.add(task._end, 59, 'second');
        }

        if (!need_to_be_lock) {
            task.resize_left = (task.resize_left != null) ? task.resize_left : this.options.resize_left;
            task.resize_right = (task.resize_right != null) ? task.resize_right : this.options.resize_right;
            task.drag_drop_x = (task.drag_drop_x != null) ? task.drag_drop_x : this.options.drag_drop_x;
            task.drag_drop_y = (task.drag_drop_y != null) ? task.drag_drop_y : this.options.drag_drop_y;
        } else {
            task.resize_left = false;
            task.resize_right = false;
            task.drag_drop_x = false;
            task.drag_drop_y = false;
        }
        // invalid flag
        if (!task.start || !task.end) {
            task.invalid = true;
        }

        // dependencies
        if (typeof task.dependencies === 'string' || !task.dependencies) {
            let deps = [];
            if (task.dependencies) {
                deps = task.dependencies
                    .split(',')
                    .map((d) => d.trim())
                    .filter((d) => d);
            }
            task.dependencies = deps;
        }

        // uids
        if (!task.id) {
            task.id = generate_id(task);
        }
        //description
        if (!task.description)
            task.description = '';

        return task;
    }

    setup_dependencies() {
        this.dependency_map = {};
        for (let t of this.tasks) {
            for (let d of t.dependencies) {
                this.dependency_map[d] = this.dependency_map[d] || [];
                this.dependency_map[d].push(t.id);
            }
        }
    }

    refresh(tasks = this.tasks, cells = this.cells, options = this.options) {
        const scroll_pos = this.$svg.parentElement.scrollLeft;
        const scroll_width = this.$svg.parentElement.scrollWidth;

        this.setup_options(options);
        this.setup_cells(cells);
        this.setup_tasks(tasks);
        this.setup_rows();
        this.change_view_mode();

        this.$svg.parentElement.scrollLeft = scroll_pos * (this.$svg.parentElement.scrollWidth / scroll_width);
    }

    setup_rows() {
        this.rows = [];
        let sum_y = (this.options.header_height + this.options.padding / 2);
        this.options.rows.forEach(row_id => {
            let row = { id: row_id, height: 0, y: 0, sub_level: [], cell_wrapper: [] };

            if (this.options.overlap) {
                row.sub_level = this.compute_row_sub_level(row_id);
                row.height = this.compute_row_height(row.sub_level.length);
            } else {
                row.height = this.options.bar_height + this.options.padding;
            }

            for (let i = 0; i < this.options.fixed_columns.length; i++)
                row.cell_wrapper[i] = {};

            row.y += sum_y;
            this.rows.push(row);
            sum_y += row.height;
        });
    }

    change_view_mode(mode = this.options.view_mode) {
        this.is_zooming = false;
        this.update_view_scale(mode);
        this.setup_dates();
        this.render();
        // fire viewmode_change event
        this.trigger_event('view_change', [this.options.view_mode]);
    }

    update_view_scale(view_mode) {
        this.options.view_mode = view_mode;
        const preset = get_view_preset(this.options.view_mode);
        this.options.zoom_step = preset.step_minutes;
        this.options.column_width = preset.column_width;
        this.options.step = this.options.zoom_step / 60;
        this.calendar_tick_unit = preset.calendar_unit;
    }

    get_ms_per_column() {
        return this.options.zoom_step * 60 * 1000;
    }

    time_to_x(date) {
        return ((date.getTime() - this.scheduler_start.getTime()) / this.get_ms_per_column()) * this.options.column_width;
    }

    x_to_time(x) {
        return new Date(this.scheduler_start.getTime() + ((x / this.options.column_width) * this.get_ms_per_column()));
    }

    duration_to_width(duration_ms) {
        return (duration_ms / this.get_ms_per_column()) * this.options.column_width;
    }

    width_to_duration_ms(width) {
        return (width / this.options.column_width) * this.get_ms_per_column();
    }

    get_tick_info() {
        if (this.calendar_tick_unit) {
            return { unit: this.calendar_tick_unit, value: 1 };
        }

        const tick_minutes = get_tick_step_minutes(this.options.zoom_step, this.options.column_width);

        if (tick_minutes >= 262800) {
            return { unit: 'year', value: 1 };
        }

        if (tick_minutes >= 43200) {
            return { unit: 'month', value: 1 };
        }

        return { unit: 'minute', value: tick_minutes };
    }

    floor_to_tick(date, tick_info) {
        if (tick_info.unit === 'year') {
            return date_utils.start_of(date, 'year');
        }

        if (tick_info.unit === 'month') {
            return date_utils.start_of(date, 'month');
        }

        if (tick_info.unit === 'week') {
            return date_utils.start_of(date, 'week');
        }

        const tick_ms = tick_info.value * 60 * 1000;
        const date_ms = date.getTime();
        const floored = Math.floor(date_ms / tick_ms) * tick_ms;
        return new Date(floored);
    }

    add_tick(date, tick_info) {
        if (tick_info.unit === 'year') {
            return date_utils.add(date, 1, 'year');
        }

        if (tick_info.unit === 'month') {
            return date_utils.add(date, 1, 'month');
        }

        if (tick_info.unit === 'week') {
            return date_utils.add(date, 7, 'day');
        }

        return new Date(date.getTime() + tick_info.value * 60 * 1000);
    }

    get_grid_width() {
        if (!this.grid_end) {
            return this.options.column_width;
        }

        return Math.max(this.time_to_x(this.grid_end), this.options.column_width);
    }

    get_interactive_max_zoom_step() {
        const fallback_max = this.options.zoom_interactive_max_step;
        const viewport_width = (this.$container && this.$container.clientWidth)
            ? this.$container.clientWidth + 1
            : 0;

        if (!this.scheduler_start || !this.grid_end || viewport_width <= 0) {
            return fallback_max;
        }

        const range_minutes = (this.grid_end.getTime() - this.scheduler_start.getTime()) / (60 * 1000);
        const derived_max = get_max_zoom_step_for_width(
            range_minutes,
            this.options.column_width,
            viewport_width,
            fallback_max
        );

        return clamp_zoom_step(derived_max, this.options.zoom_min_step, fallback_max);
    }

    setup_dates() {
        this.setup_scheduler_dates();
        this.setup_date_values();
    }

    setup_scheduler_dates() {
        this.scheduler_start = this.options.date_start
        this.scheduler_end = this.options.date_end;

        if (!this.scheduler_start || !this.scheduler_end)
            for (let task of this.tasks) {
                // set global start and end date
                if (!this.scheduler_start || task._start < this.scheduler_start) {
                    this.scheduler_start = date_utils.clone(task._start);
                }
                if (!this.scheduler_end || task._end > this.scheduler_end) {
                    this.scheduler_end = date_utils.clone(task._end);
                }
            }

        this.scheduler_start.setUTCHours(0, 0, 0, 0);
        this.scheduler_end.setUTCHours(0, 0, 0, 0);

        // add date padding on both sides
        if (!this.options.date_start) {
            if (this.view_is([VIEW_MODE.HOUR, VIEW_MODE.QUARTER_DAY, VIEW_MODE.HALF_DAY])) {
                this.scheduler_start = date_utils.add(this.scheduler_start, -7, 'day');
            } else if (this.view_is(VIEW_MODE.MONTH)) {
                this.scheduler_start = date_utils.start_of(this.scheduler_start, 'year');
            } else if (this.view_is(VIEW_MODE.YEAR)) {
                this.scheduler_start = date_utils.add(this.scheduler_start, -2, 'year');
            } else {
                this.scheduler_start = date_utils.add(this.scheduler_start, -1, 'month');
            }
        } else {
            if (this.view_is(VIEW_MODE.WEEK)) {
                this.scheduler_start = date_utils.start_of(this.scheduler_start, 'week');
            } else if (this.view_is(VIEW_MODE.MONTH)) {
                this.scheduler_start = date_utils.start_of(this.scheduler_start, 'month');
            } else if (this.view_is(VIEW_MODE.YEAR)) {
                this.scheduler_start = date_utils.start_of(this.scheduler_start, 'year');
            }
        }

        if (!this.options.date_end) {
            if (this.view_is([VIEW_MODE.HOUR, VIEW_MODE.QUARTER_DAY, VIEW_MODE.HALF_DAY])) {
                this.scheduler_end = date_utils.add(this.scheduler_end, 7, 'day');
            } else if (this.view_is(VIEW_MODE.MONTH)) {
                this.scheduler_end = date_utils.add(this.scheduler_end, 1, 'year');
            } else if (this.view_is(VIEW_MODE.YEAR)) {
                this.scheduler_end = date_utils.add(this.scheduler_end, 2, 'year');
            } else {
                this.scheduler_end = date_utils.add(this.scheduler_end, 1, 'month');
            }
        }

        if (this.view_is(VIEW_MODE.WEEK)) {
            this.scheduler_start = date_utils.start_of(this.scheduler_start, 'week');
        } else if (this.view_is(VIEW_MODE.MONTH)) {
            this.scheduler_start = date_utils.start_of(this.scheduler_start, 'month');
        }
    }

    setup_date_values() {
        this.tick_info = this.get_tick_info();
        this.dates = [];
        let cur_date = this.floor_to_tick(this.scheduler_start, this.tick_info);

        if (cur_date < this.scheduler_start) {
            cur_date = this.add_tick(cur_date, this.tick_info);
        }

        while (cur_date <= this.scheduler_end) {
            this.dates.push(cur_date);
            cur_date = this.add_tick(cur_date, this.tick_info);
        }

        this.grid_end = cur_date;
    }

    bind_events() {
        this.bind_grid_events();
        this.bind_cell_events();
        this.bind_bar_events();
    }

    render() {
        this.clear();
        this.setup_layers();
        this.make_fixed_columns();
        this.make_grid();
        this.make_bars();
        this.make_arrows();
        this.map_arrows_on_bars();
        this.set_width();
        if (!this.is_zooming)
            this.set_scroll_position();
        if (!this.options.overlap)
            this.red_border();
    }

    setup_layers() {
        this.layers = {};
        this.fixed_col_layers = {};
        const layers = ['grid', 'arrow', 'progress', 'bar', 'details', 'date'];
        const fixed_col_layers = ['grid', 'cell', 'header'];
        // make group layers
        for (let layer of layers) {
            this.layers[layer] = createSVG('g', {
                class: layer,
                append_to: this.$svg,
            });
        }
        for (let layer of fixed_col_layers) {
            this.fixed_col_layers[layer] = createSVG('g', {
                class: layer,
                append_to: this.$column_svg
            });
        }
    }

    // TODO refactor with single functions?
    make_fixed_columns() {
        const column_grid_width = this.options.fixed_columns.reduce((acc, curr) => acc + curr.width, 0);
        if (this.options.hide_fixed_columns || column_grid_width === 0) {
            this.$column_svg.setAttribute('width', 0);
            return;
        }
        // make_grid_background
        const sum_rows_height = this.rows[this.rows.length - 1].y + this.rows[this.rows.length - 1].height;
        const grid_height = sum_rows_height;

        createSVG('rect', {
            x: 0,
            y: 0,
            width: column_grid_width,
            height: grid_height,
            class: 'grid-background',
            append_to: this.fixed_col_layers.grid
        });
        $.attr(this.$column_svg, {
            height: grid_height,
            width: column_grid_width,
        });

        // make_grid_rows // praticamente è identica, cambia solo il layer e la width
        const rows_layer = createSVG('g', { append_to: this.fixed_col_layers.grid });
        const lines_layer = createSVG('g', { append_to: this.fixed_col_layers.grid });

        let i = 0;

        for (let row of this.options.rows) {

            const row_height = this.rows[i].height;
            const row_y = this.rows[i].y;
            const rect = createSVG('rect', {
                x: 0,
                y: row_y,
                width: column_grid_width,
                height: row_height,
                class: 'grid-row',
                'data-id': row,
                append_to: rows_layer,
            });

            this.rows[i].fixed_rect = rect;

            const fixed_line = createSVG('line', {
                x1: 0,
                y1: row_y + row_height,
                x2: column_grid_width,
                y2: row_y + row_height,
                class: 'row-line',
                append_to: lines_layer,
            });

            this.rows[i].fixed_line = fixed_line;

            i++;
        }

        // make_grid_header
        const header_height = this.options.header_height + 10;
        createSVG('rect', {
            x: 0,
            y: 0,
            width: column_grid_width,
            height: header_height,
            class: 'grid-header',
            append_to: this.fixed_col_layers.header
        });

        // make_dates -> header
        const pos_y = this.options.header_height;
        let pos_x = 0;
        for (let column of this.options.fixed_columns) {
            const max_width = column.width;
            if (max_width === 0) continue;
            let text_content = column.header;
            const text_width = text_content.length * 7;

            if (text_width > max_width) {
                const reduction_percentage = (text_width - max_width) / text_width;
                const visible_characters = Math.max(0, Math.round(text_content.length * (1 - reduction_percentage))) - 1;
                text_content = text_content.substring(0, visible_characters);
            }
            pos_x += column.width / 2;
            createSVG('text', {
                x: pos_x,
                y: pos_y,
                value: column.header,
                innerHTML: text_content,
                class: 'lower-text bold',
                append_to: this.fixed_col_layers.header
            });
            pos_x += column.width / 2;

            createSVG('path', {
                d: `M ${pos_x - 2} ${0} v ${this.options.header_height + (this.options.padding / 2)}`,
                class: 'header-tick',
                append_to: this.fixed_col_layers.header,
            });

            // make_grid_ticks
            let tick_y = 0;
            let tick_height = sum_rows_height;
            createSVG('path', {
                d: `M ${pos_x} ${tick_y} v ${tick_height}`,
                class: 'tick thick',
                append_to: this.fixed_col_layers.grid,
            });
        }

        // make_bars
        this.make_cells();
    }

    make_cells() {
        for (let row of this.rows) {
            const row_height = row.height;
            const row_y = row.y;
            let pos_x = 0;
            let c = 0;
            for (let column of this.options.fixed_columns) {
                if (column.width === 0) continue;
                const cell_wrapper = createSVG('g', {
                    class: 'cell-wrapper',
                    'data-row-id': row.id,
                    'data-col-id': column.id,
                    append_to: this.fixed_col_layers.cell,
                });

                const fixed_cell = createSVG('rect', {
                    x: pos_x,
                    y: row_y,
                    width: column.width,
                    height: row_height,
                    append_to: cell_wrapper,
                });
                row.cell_wrapper[c].fixed_cell = fixed_cell;


                const cell = this.cells.find(t => t.row === row.id && t.column === column.id);
                if (cell) {

                    const max_width = column.width;
                    let text_content = cell.value;
                    const text_width = text_content.length * 7;
                    let tooltip = '';
                    if (cell.tooltip)
                        tooltip = cell.tooltip;

                    if (text_width > max_width) {
                        const reduction_percentage = (text_width - max_width) / text_width;
                        const visible_characters = Math.max(0, Math.round(text_content.length * (1 - reduction_percentage))) - 1;
                        text_content = text_content.substring(0, visible_characters);
                    }
                    const text = createSVG('text', {
                        x: (column.width / 2) + pos_x,
                        y: 24 + row_y,
                        innerHTML: text_content,
                        value: String(cell.value),
                        tooltip: tooltip,
                        class: 'lower-text',
                        append_to: cell_wrapper
                    });
                    row.cell_wrapper[c].text = text;
                }
                pos_x += column.width;
                c++;

                $.on(cell_wrapper, 'mouseleave', (e) => {
                    if (e.relatedTarget != null &&
                        (e.relatedTarget.classList.contains('pointer') ||
                            e.relatedTarget.classList.contains('title')))
                        return;
                    this.hide_popup();
                });
            }
        }
    }

    make_grid() {
        this.make_grid_background();
        this.make_grid_rows();
        this.make_grid_header();
        this.grid_ticks_group = createSVG('g', {
            class: 'grid-ticks',
            append_to: this.layers.grid,
        });
        this.grid_highlights_group = createSVG('g', {
            class: 'grid-highlights',
            append_to: this.layers.grid,
        });
        this.date_values_group = createSVG('g', {
            class: 'date-values',
            append_to: this.layers.date,
        });

        this.render_time_axis_viewport();
    }

    get_viewport_x_bounds() {
        const viewport_width = this.$container?.clientWidth || this.get_grid_width();
        const scroll_left = this.$container?.scrollLeft || 0;
        const overscan = this.options.time_axis_overscan;

        return {
            start: Math.max(0, scroll_left - overscan),
            end: scroll_left + viewport_width + overscan,
        };
    }

    get_visible_dates() {
        if (!this.dates.length) {
            return [];
        }

        const bounds = this.get_viewport_x_bounds();
        let start_index = this.dates.findIndex((date) => this.time_to_x(date) >= bounds.start);

        if (start_index === -1) {
            start_index = this.dates.length - 1;
        }

        start_index = Math.max(0, start_index - 1);

        let end_index = start_index;
        while (
            end_index < this.dates.length &&
            this.time_to_x(this.dates[end_index]) <= bounds.end
        ) {
            end_index++;
        }

        end_index = Math.min(this.dates.length - 1, end_index + 1);

        return this.dates.slice(start_index, end_index + 1);
    }

    render_time_axis_viewport() {
        if (!this.grid_ticks_group || !this.grid_highlights_group || !this.date_values_group) {
            return;
        }

        this.grid_ticks_group.innerHTML = '';
        this.grid_highlights_group.innerHTML = '';
        this.date_values_group.innerHTML = '';

        this.make_grid_ticks();
        this.make_grid_highlights();
        this.make_dates();
    }

    request_time_axis_render() {
        if (this.time_axis_animation_frame) {
            return;
        }

        this.time_axis_animation_frame = requestAnimationFrame(() => {
            this.render_time_axis_viewport();
            this.time_axis_animation_frame = null;
        });
    }

    make_grid_background() {
        const grid_width = this.get_grid_width();
        const sum_rows_height = this.rows[this.rows.length - 1].y + this.rows[this.rows.length - 1].height;
        const grid_height = sum_rows_height;

        createSVG('rect', {
            x: 0,
            y: 0,
            width: grid_width,
            height: grid_height,
            class: 'grid-background',
            append_to: this.layers.grid,
        });

        $.attr(this.$svg, {
            height: grid_height,
            width: '100%',
        });
    }

    make_grid_rows() {
        const rows_layer = createSVG('g', { append_to: this.layers.grid });
        const lines_layer = createSVG('g', { append_to: this.layers.grid });

        const row_width = this.get_grid_width();

        let i = 0;

        for (let row of this.options.rows) {
            const row_height = this.rows[i].height;
            const row_y = this.rows[i].y;

            const rect = createSVG('rect', {
                x: 0,
                y: row_y,
                width: row_width,
                height: row_height,
                class: 'grid-row',
                'data-id': row,
                append_to: rows_layer,
            });

            this.rows[i].rect = rect;

            const line = createSVG('line', {
                x1: 0,
                y1: row_y + row_height,
                x2: row_width,
                y2: row_y + row_height,
                class: 'row-line',
                append_to: lines_layer,
            });

            this.rows[i].line = line;

            i++;
        }
    }

    make_grid_header() {
        const header_width = this.get_grid_width();
        const header_height = this.options.header_height + 10;
        createSVG('rect', {
            x: 0,
            y: 0,
            width: header_width,
            height: header_height,
            class: 'grid-header',
            append_to: this.layers.date,
        });
    }

    make_grid_ticks() {
        const sum_rows_height = this.rows[this.rows.length - 1].y + this.rows[this.rows.length - 1].height;
        const tick_y = this.options.header_height + (this.options.padding / 2);
        const tick_height = sum_rows_height - tick_y;
        const visible_dates = this.get_visible_dates();

        for (let date of visible_dates) {
            const tick_x = this.time_to_x(date);

            createSVG('path', {
                d: `M ${tick_x} ${tick_y} v ${tick_height}`,
                class: this.get_tick_class(date),
                append_to: this.grid_ticks_group,
            });
        }
    }

    get_tick_class(date) {
        if (this.tick_info.unit === 'year' ||
            (this.tick_info.unit === 'month' && date.getUTCMonth() === 0)) {
            return 'tick year-boundary';
        }

        if (this.tick_info.unit === 'month' || date.getUTCDate() === 1) {
            return 'tick month-boundary';
        }

        if (this.tick_info.unit === 'week') {
            return 'tick week-boundary';
        }

        if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
            return 'tick day-boundary';
        }

        return 'tick subdivision';
    }

    make_grid_highlights() {
        const bounds = this.get_viewport_x_bounds();
        const today = date_utils.today();
        const start_of_today = date_utils.start_of(today, 'day');
        const tomorrow = date_utils.add(start_of_today, 1, 'day');
        const x = this.time_to_x(start_of_today);
        const width = this.duration_to_width(tomorrow.getTime() - start_of_today.getTime());

        if ((x + width) < bounds.start || x > bounds.end) {
            return;
        }

        const y = this.options.header_height + this.options.padding / 2;
        const height = this.rows[this.rows.length - 1].y +
            this.rows[this.rows.length - 1].height - y;
        createSVG('rect', {
            x,
            y,
            width,
            height,
            class: 'today-highlight',
            append_to: this.grid_highlights_group,
        });
    }

    make_dates() {
        const visible_dates = this.get_visible_dates();
        const date_infos = visible_dates.map((date) => this.get_date_info(date));
        const common_lower_level = this.get_common_lower_text_level(date_infos);

        date_infos.map((d) => {
            const lower_text_element = createSVG('text', {
                x: d.lower_x,
                y: d.lower_y,
                innerHTML: d.lower_text,
                class: 'lower-text bold',
                append_to: this.date_values_group,
            });
            lower_text_element.textContent = this.get_lower_text_at_level(d, common_lower_level);

            const pos_x = this.time_to_x(d.next_date);

            createSVG('path', {
                d: `M ${pos_x} ${30} V ${this.options.header_height + (this.options.padding / 2)}`,
                class: this.get_tick_class(d.next_date),
                append_to: this.date_values_group,
            });

            if ((d.date.getUTCDay() === 6 || d.date.getUTCDay() === 0) &&
                this.tick_info.unit === 'minute' && this.tick_info.value < 24 * 60) {

                const highlight_y = d.lower_y + (this.options.padding / 2);
                const highlight_x = d.base_pos_x;
                const highlight_width = d.column_width;
                const highlight_height = this.rows[this.rows.length - 1].y +
                    this.rows[this.rows.length - 1].height -
                    this.options.header_height -
                    (this.options.padding / 2);

                createSVG('rect', {
                    x: highlight_x,
                    y: highlight_y,
                    width: highlight_width,
                    height: highlight_height,
                    class: 'weekend-highlight',
                    append_to: this.grid_highlights_group,
                });
            }
            return d;
        });

        this.make_upper_period_labels();
    }

    get_common_lower_text_level(date_infos) {
        if (!date_infos.length) {
            return 0;
        }

        const measure_element = createSVG('text', {
            x: 0,
            y: 0,
            innerHTML: '',
            class: 'lower-text bold',
            append_to: this.date_values_group,
        });

        const candidate_matrix = date_infos.map((date_info) => {
            return date_info.lower_text_candidates && date_info.lower_text_candidates.length
                ? date_info.lower_text_candidates
                : [date_info.lower_text];
        });

        const available_widths = date_infos.map((date_info) => {
            return Math.max(date_info.column_width - 8, 1);
        });

        const level = get_common_fitting_level(candidate_matrix, available_widths, (label) => {
            const measured = this.measure_svg_text_width(measure_element, label);
            return measured != null ? measured : label.length * 7;
        });

        measure_element.remove();
        return level;
    }

    get_lower_text_at_level(date_info, level) {
        const candidates = date_info.lower_text_candidates && date_info.lower_text_candidates.length
            ? date_info.lower_text_candidates
            : [date_info.lower_text];

        const candidate_index = Math.min(level, candidates.length - 1);
        return candidates[candidate_index] || date_info.lower_text;
    }

    get_fitted_lower_text(date_info, lower_text_element) {
        const horizontal_padding = 8;
        const available_width = Math.max(date_info.column_width - horizontal_padding, 1);
        const candidates = date_info.lower_text_candidates && date_info.lower_text_candidates.length
            ? date_info.lower_text_candidates
            : [date_info.lower_text];

        return pick_fitting_label(candidates, available_width, (label) => {
            const measured = this.measure_svg_text_width(lower_text_element, label);
            return measured != null ? measured : label.length * 7;
        });
    }

    measure_svg_text_width(text_element, text) {
        if (!text_element) {
            return null;
        }

        text_element.textContent = text;

        if (typeof text_element.getComputedTextLength !== 'function') {
            return null;
        }

        const width = text_element.getComputedTextLength();
        return Number.isFinite(width) && width > 0 ? width : null;
    }

    get_period_end(start_date, period_unit) {
        if (period_unit === 'day') {
            return date_utils.add(start_date, 1, 'day');
        }

        if (period_unit === 'month') {
            return date_utils.add(start_date, 1, 'month');
        }

        if (period_unit === 'year') {
            return date_utils.add(start_date, 1, 'year');
        }

        return date_utils.add(start_date, 1, 'day');
    }

    make_upper_period_labels() {
        const grouping = get_upper_grouping(this.tick_info);
        if (!grouping) {
            return;
        }

        const bounds = this.get_viewport_x_bounds();
        const viewport_start_date = this.x_to_time(bounds.start);
        const viewport_end_date = this.x_to_time(bounds.end);
        let current_start = date_utils.start_of(viewport_start_date, grouping.unit);

        let last_text_end = Number.NEGATIVE_INFINITY;
        while (current_start <= viewport_end_date) {
            const current_end = this.get_period_end(current_start, grouping.unit);
            const period_start_x = this.time_to_x(current_start);
            const period_end_x = this.time_to_x(current_end);

            const visible_start_x = Math.max(period_start_x, bounds.start);
            const visible_end_x = Math.min(period_end_x, bounds.end);
            const available_width = visible_end_x - visible_start_x - 8;

            if (available_width <= 0) {
                current_start = current_end;
                continue;
            }

            const center_x = visible_start_x + ((visible_end_x - visible_start_x) / 2);
            const upper_text_element = createSVG('text', {
                x: center_x,
                y: this.options.header_height - 25,
                innerHTML: '',
                class: 'upper-text bold',
                append_to: this.date_values_group,
            });

            const candidates = get_upper_text_candidates(current_start, grouping.unit, this.options.language);
            const label = pick_fitting_label(candidates, available_width, (candidate) => {
                const measured = this.measure_svg_text_width(upper_text_element, candidate);
                return measured != null ? measured : candidate.length * 7;
            });

            upper_text_element.textContent = label;

            const text_width = this.measure_svg_text_width(upper_text_element, label) || label.length * 7;
            const text_start = center_x - (text_width / 2);

            if (text_width > available_width || text_start < last_text_end + 8) {
                upper_text_element.remove();
                current_start = current_end;
                continue;
            }

            last_text_end = center_x + (text_width / 2);
            current_start = current_end;
        }
    }

    get_date_info(date) {
        const next_date = this.add_tick(date, this.tick_info);
        const base_pos_x = this.time_to_x(date);
        const next_pos_x = this.time_to_x(next_date);
        const column_width = Math.max(next_pos_x - base_pos_x, 1);
        const lower_text_candidates = get_lower_text_candidates(
            date,
            this.tick_info,
            this.options.language
        );
        const lower_text = lower_text_candidates.length
            ? lower_text_candidates[0]
            : date_utils.format(date, 'D MMM', this.options.language);

        return {
            date,
            next_date,
            column_width,
            base_pos_x,
            lower_text,
            lower_text_candidates,
            lower_x: base_pos_x + (column_width / 2),
            lower_y: this.options.header_height,
        };
    }

    make_bars() {
        this.bars = this.tasks.map((task) => {
            const bar = new Bar(this, task);
            this.layers.bar.appendChild(bar.group);
            return bar;
        });
    }

    make_arrows() {
        this.arrows = [];
        for (let task of this.tasks) {
            let arrows = [];
            arrows = task.dependencies
                .map((task_id) => {
                    const dependency = this.get_task(task_id);
                    if (!dependency) return;
                    const arrow = new Arrow(
                        this,
                        this.get_bar(dependency.id), // from_task
                        this.get_bar(task.id) // to_task
                    );
                    this.layers.arrow.appendChild(arrow.element);
                    return arrow;
                })
                .filter(Boolean); // filter falsy values
            this.arrows = this.arrows.concat(arrows);
        }
    }

    map_arrows_on_bars() {
        for (let bar of this.bars) {
            bar.arrows = this.arrows.filter((arrow) => {
                return (
                    arrow.from_task.task.id === bar.task.id ||
                    arrow.to_task.task.id === bar.task.id
                );
            });
        }
    }

    set_width() {
        const actual_width = this.$svg
            .querySelector('.grid .grid-row')
            .getAttribute('width');
        this.$svg.setAttribute('width', actual_width);
    }

    set_scroll_position() {
        const parent_element = this.$svg.parentElement;
        if (!parent_element) return;

        const scroll_pos = this.time_to_x(date_utils.today()) - this.options.column_width;

        parent_element.scrollLeft = scroll_pos;
    }

    set_zoom_step(step_minutes, anchor_date = null, anchor_screen_x = null) {
        const previous_view_mode = this.options.view_mode;
        const clamped_zoom_step = clamp_zoom_step(
            step_minutes,
            this.options.zoom_min_step,
            this.options.zoom_max_step
        );

        if (Math.abs(clamped_zoom_step - this.options.zoom_step) < 0.0001) {
            return;
        }

        this.options.zoom_step = clamped_zoom_step;
        this.options.step = this.options.zoom_step / 60;
        this.options.view_mode = get_nearest_view_mode(this.options.zoom_step, this.options.view_modes);
        this.calendar_tick_unit = get_view_preset(this.options.view_mode).calendar_unit;

        this.is_zooming = true;
        this.setup_dates();
        this.render();
        this.is_zooming = false;

        if (anchor_date && anchor_screen_x != null) {
            this.$container.scrollLeft = this.time_to_x(anchor_date) - anchor_screen_x;
        }

        if (this.options.view_mode !== previous_view_mode) {
            this.trigger_event('view_change', [this.options.view_mode]);
        }

        this.trigger_event('zoom_change', [this.options.zoom_step]);
    }

    zoom_in(anchor_date = null, anchor_screen_x = null) {
        this.set_zoom_step(this.options.zoom_step * 0.85, anchor_date, anchor_screen_x);
    }

    zoom_out(anchor_date = null, anchor_screen_x = null) {
        const interactive_max = this.get_interactive_max_zoom_step();
        if (this.options.zoom_step >= interactive_max) {
            return;
        }

        this.set_zoom_step(
            Math.min(this.options.zoom_step * 1.15, interactive_max),
            anchor_date,
            anchor_screen_x
        );
    }

    bind_grid_events() {
        const scroll = this.$svg.parentElement;
        let is_dragging = false;
        let start_x;
        let scroll_left;
        let x = 0;
        let is_resizing = false;
        let header_tick = null;

        $.on(this.$svg, 'mousedown', '.grid-header, .lower-text, .upper-text, .grid-row, .weekend-highlight, .today-highlight', (e) => {
            is_dragging = true;
            start_x = e.pageX;
            scroll_left = scroll.scrollLeft;
        });

        $.on(this.$container_parent, 'mousemove', '.grid-row, .grid-header, .lower-text, .upper-text, .weekend-highlight', (e) => {
            if (is_dragging) {
                const x = e.pageX;
                const walk = x - start_x;
                scroll.scrollLeft = scroll_left - walk;
            }
        });

        $.on(document, 'mouseup', () => {
            if (is_dragging)
                is_dragging = false;

            if (is_resizing) {
                is_resizing = false;
                header_tick = null;
            }
        });

        $.on(this.$container_parent, 'mouseleave', () => {
            if (is_dragging)
                is_dragging = false;

            if (is_resizing) {
                is_resizing = false;
                header_tick = null;
            }
        });

        $.on(this.$svg, 'click', '.grid-row', (e) => {
            if (e.target.classList.contains('grid-row')) {
                const row = $.closest('.grid-row', e.target);
                const data_id = row.getAttribute('data-id');
                const cells = this.$column_svg.querySelectorAll('g.cell > g.cell-wrapper[data-row-id="' + data_id + '"]');
                const is_currently_selected = row.classList.contains('selected-row');

                this.unselect_all();
                this.hide_popup();
                if (!is_currently_selected) {
                    row.classList.add('selected-row');
                    cells.forEach(cell => {
                        cell.classList.add('selected-row');
                    });
                }

                this.trigger_event('row_select', [data_id]);
            }
        });

        $.on(this.$svg, 'dblclick', '.grid-row, .weekend-highlight, .today-highlight', (e) => {
            let data_id;
            if (e.target.classList.contains('weekend-highlight') || e.target.classList.contains('today-highlight')) {
                let prev_y = 0;
                this.rows.forEach(row => {
                    if (e.offsetY >= prev_y && e.offsetY < row.y)
                        return;
                    data_id = row.id;
                    prev_y = row.y;
                })
            } else
                data_id = e.target.getAttribute('data-id');

            const datetime = this.x_to_time(this.$container.scrollLeft + e.offsetX);

            this.trigger_event('grid_dblclick', [data_id, date_utils.to_local(datetime)]);
        });

        $.on(this.$container, 'scroll', e => {
            this.$column_container.scrollTop = e.currentTarget.scrollTop;
            this.layers.date.setAttribute('transform', 'translate(0,' + e.currentTarget.scrollTop + ')');
            this.fixed_col_layers.header.setAttribute('transform', 'translate(0,' + e.currentTarget.scrollTop + ')');
            this.request_time_axis_render();
        });

        $.on(this.$column_container, 'scroll', e => {
            this.$container.scrollTop = e.currentTarget.scrollTop;
        });

        $.on(this.$column_svg, 'mousedown', '.header-tick', (e) => {
            is_resizing = true;
            x = e.clientX;
            header_tick = e.target;
        });

        $.on(this.$container_parent, 'mousemove', '.header-tick, .grid-header', (e) => {
            if (is_resizing) {
                const delta_x = e.clientX - x;
                x = e.clientX;
                let cell_x;
                let cell_width;
                let max_width;
                let text_pos_x;
                let need_to_resize = true;
                let d_attr = header_tick.getAttribute('d');
                const tick_x = parseInt(d_attr.split(' ')[1]);
                //cell-wrapper
                const cells = this.$column_svg.querySelectorAll('g.cell-wrapper > *');
                for (let i = 0; i < cells.length; i++) {
                    const cell = cells[i];
                    if (cell.tagName === 'rect') {
                        cell_x = parseInt(cell.getAttribute('x'));
                        cell_width = cell.getBBox().width;
                        if (cell_x < tick_x && (cell_width + cell_x) > tick_x) {
                            max_width = cell_width + delta_x;
                            if (max_width < 50) { //impostata larghezza minima
                                need_to_resize = false;
                                break;
                            }
                            $.attr(cell, 'width', max_width);
                            text_pos_x = tick_x + 2 + cell_x;
                        } else if (cell_x > tick_x) {
                            $.attr(cell, 'x', cell_x + delta_x);
                        }
                    } else {
                        if (cell_x < tick_x && (cell_width + cell_x) > tick_x) {
                            let text_content = cell.getAttribute('value');
                            const text_width = text_content.length * 7;
                            if (text_width > max_width) {
                                const reduction_percentage = (text_width - max_width) / text_width;
                                const visible_characters = Math.max(0, Math.round(text_content.length * (1 - reduction_percentage))) - 1;
                                cell.textContent = text_content.substring(0, visible_characters);
                            } else {
                                const expansion_percentage = (max_width - text_width) / text_content.length;
                                const visible_characters = Math.min(text_content.length, Math.round(text_content.length * (1 + expansion_percentage)));
                                cell.textContent = text_content.substring(0, visible_characters);
                            }
                            $.attr(cell, 'x', text_pos_x / 2);
                        } else if (cell_x > tick_x) {
                            const text_x = parseInt(cell.getAttribute('x'));
                            $.attr(cell, 'x', text_x + delta_x);
                        }
                    }
                }

                if (need_to_resize) {
                    //tick
                    let new_d_attr = d_attr.replace(/M\s*\d+/, `M ${tick_x + delta_x}`);
                    $.attr(header_tick, 'd', new_d_attr);

                    //other tick
                    const header_ticks = this.$column_svg.querySelectorAll('g.header > path');
                    header_ticks.forEach(tick => {
                        if (tick !== header_tick) {
                            const d_attr = tick.getAttribute('d');
                            const M_value = parseInt(d_attr.split(' ')[1]);
                            if (tick_x < M_value) {
                                let new_d_attr = d_attr.replace(/M\s*\d+/, `M ${M_value + delta_x}`);
                                $.attr(tick, 'd', new_d_attr);
                            }
                        }
                    });

                    //background
                    const current_width = parseInt(this.$column_svg.getAttribute('width'));
                    const new_width = current_width + delta_x;
                    $.attr(this.$column_svg, 'width', new_width);

                    //header
                    $.attr(this.$column_svg.querySelector('g.header > rect.grid-header'), 'width', new_width);
                    //header text
                    const header_text = this.$column_svg.querySelectorAll('g.header > text.lower-text.bold');
                    const text_to_resize = header_tick.previousSibling;
                    header_text.forEach(text => {
                        const text_x = parseFloat(text.getAttribute('x'));

                        if (text === text_to_resize) {
                            const left_tick = (text_x * 2) - tick_x - 2;
                            const max_width = tick_x - Math.abs(left_tick) + delta_x;
                            const text_content = text.textContent;
                            const original_text = text.getAttribute('value');
                            const text_width = text_content.length * 7;
                            if (text_width > max_width) {
                                const reduction_percentage = (text_width - max_width) / text_width;
                                const visible_characters = Math.max(0, Math.round(text_content.length * (1 - reduction_percentage))) - 1;
                                text.textContent = text_content.substring(0, visible_characters);
                            } else {
                                const expansion_percentage = (max_width - text_width) / (original_text.length * 7);
                                const visible_characters = Math.min(original_text.length, Math.round(text_content.length * (1 + expansion_percentage)));
                                text.textContent = original_text.substring(0, visible_characters);
                            }
                            $.attr(text, 'x', text_pos_x / 2);
                        }

                        if (text_x > tick_x)
                            $.attr(text, 'x', text_x + delta_x);
                    });
                    //ticks under the header
                    const ticks = this.$column_svg.querySelectorAll('g.grid > path');
                    ticks.forEach(tick => {
                        const d_attr = tick.getAttribute('d');
                        const M_value = parseInt(d_attr.split(' ')[1]);
                        if (tick_x < M_value) {
                            let new_d_attr = d_attr.replace(/M\s*\d+/, `M ${M_value + delta_x}`);
                            $.attr(tick, 'd', new_d_attr);
                        }
                    });

                    //row
                    const fixed_grid_rows = this.$column_svg.querySelectorAll('g.grid > g > rect.grid-row');
                    fixed_grid_rows.forEach(row => {
                        $.attr(row, 'width', new_width);
                    });
                }
            }
        });

        $.on(this.$container, 'wheel', (e) => {
            this.hide_popup();
            e.preventDefault();
            e.stopPropagation();

            const delta_multiplier = e.deltaMode === 1
                ? 16
                : e.deltaMode === 2
                    ? this.$container.clientWidth
                    : 1;

            this.pending_wheel_delta += e.deltaY * delta_multiplier;
            this.pending_wheel_event = e;

            if (this.wheel_animation_frame) return;

            this.wheel_animation_frame = requestAnimationFrame(() => {
                if (!this.pending_wheel_event) {
                    this.wheel_animation_frame = null;
                    return;
                }

                const wheel_event = this.pending_wheel_event;
                const wheel_delta = this.pending_wheel_delta;
                const container_rect = this.$container.getBoundingClientRect();
                const anchor_screen_x = Math.max(
                    0,
                    Math.min(this.$container.clientWidth, wheel_event.clientX - container_rect.left)
                );
                const anchor_date = this.x_to_time(this.$container.scrollLeft + anchor_screen_x);
                const interactive_max = this.get_interactive_max_zoom_step();

                if (wheel_delta > 0 && this.options.zoom_step >= interactive_max) {
                    this.pending_wheel_delta = 0;
                    this.pending_wheel_event = null;
                    this.wheel_animation_frame = null;
                    return;
                }

                const target_zoom_step = zoom_step_from_wheel(
                    this.options.zoom_step,
                    wheel_delta,
                    this.options.zoom_min_step,
                    this.options.zoom_step > interactive_max
                        ? this.options.zoom_max_step
                        : interactive_max
                );

                this.set_zoom_step(target_zoom_step, anchor_date, anchor_screen_x);

                this.pending_wheel_delta = 0;
                this.pending_wheel_event = null;
                this.wheel_animation_frame = null;
            });
        });
    }

    bind_cell_events() {
        $.on(this.$column_svg, 'mouseover', '.cell-wrapper > text', (e) => {
            const cell = $.closest('.cell-wrapper > text', e.target);
            const cell_tooltip = cell.getAttribute('tooltip');
            const cell_value = cell.getAttribute('value');
            if (cell_value !== cell.innerHTML || (
                cell_tooltip && cell_tooltip !== cell_value))
                this.show_cell_popup(cell, cell_value, cell_tooltip, e);
        });

        $.on(this.$column_svg, 'dblclick', '.cell-wrapper', (e) => {
            const cell_wrapper = $.closest('.cell-wrapper', e.target);
            const data_row_id = cell_wrapper.getAttribute('data-row-id');
            const data_col_id = cell_wrapper.getAttribute('data-col-id');
            this.trigger_event('cell_dblclick', [data_row_id, data_col_id]);
        });

        $.on(this.$column_svg, 'click', '.cell-wrapper', (e) => {
            const cell_wrapper = $.closest('.cell-wrapper', e.target);
            const data_row_id = cell_wrapper.getAttribute('data-row-id');
            const cells = this.$column_svg.querySelectorAll('g.cell > g.cell-wrapper[data-row-id="' + data_row_id + '"]');
            const row = this.$container.querySelector('g.grid > g > rect[data-id="' + data_row_id + '"]');
            const is_currently_selected = row.classList.contains('selected-row');

            this.unselect_all();
            this.hide_popup();

            if (!is_currently_selected) {
                row.classList.add('selected-row');
                cells.forEach(cell => {
                    cell.classList.add('selected-row');
                });
            }

            this.trigger_event('row_select', [data_row_id]);
        });
    }

    bind_bar_events() {
        let is_dragging = false;
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing_left = false;
        let is_resizing_right = false;
        let parent_bar_id = null;
        let bars = []; // instanceof Bars, the dragged bar and its children
        let max_y = 0;
        const min_y = this.options.header_height + (this.options.padding / 2);
        this.bar_being_dragged = null; // instanceof dragged bar

        function action_in_progress() {
            return is_dragging || is_resizing_left || is_resizing_right;
        }

        $.on(this.$svg, 'mousedown', '.bar-wrapper, .handle', (e, element) => {
            const bar_wrapper = $.closest('.bar-wrapper', element);

            if (element.classList.contains('left')) {
                is_resizing_left = true;
            } else if (element.classList.contains('right')) {
                is_resizing_right = true;
            } else if (element.classList.contains('bar-wrapper')) {
                is_dragging = true;
            }

            bar_wrapper.classList.add('active');

            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            parent_bar_id = bar_wrapper.getAttribute('data-id');
            const ids = [
                parent_bar_id,
                ...this.get_all_dependent_tasks(parent_bar_id),
            ];
            bars = ids.map((id) => {
                const bar = this.get_bar(id);
                if (parent_bar_id === id) {
                    this.bar_being_dragged = bar;
                }
                const $bar = bar.$bar;
                $bar.ox = $bar.getX();
                $bar.oy = $bar.getY();
                $bar.owidth = $bar.getWidth();
                $bar.finaldx = 0;
                $bar.finaldy = 0;
                return bar;
            });

            is_resizing_left = is_resizing_left && this.bar_being_dragged.task.resize_left;
            is_resizing_right = is_resizing_right && this.bar_being_dragged.task.resize_right;
            is_dragging = is_dragging && (this.bar_being_dragged.task.drag_drop_x || this.bar_being_dragged.task.drag_drop_y);
            max_y = this.rows[this.rows.length - 1].y + this.rows[this.rows.length - 1].height - this.options.bar_height - (this.options.padding / 2);
        });

        $.on(this.$svg, 'mousemove', (e) => {
            if (!action_in_progress()) return;
            const dx = e.offsetX - x_on_start;
            let dy = e.offsetY - y_on_start;

            this.hide_popup();

            // update the dragged bar
            const bar_being_dragged = this.bar_being_dragged;
            if (is_resizing_left) {
                bar_being_dragged.$bar.finaldx = this.get_snap_x_position(dx);
                bar_being_dragged.update_bar_position({
                    x:
                        bar_being_dragged.$bar.ox +
                        bar_being_dragged.$bar.finaldx,
                    width:
                        bar_being_dragged.$bar.owidth -
                        bar_being_dragged.$bar.finaldx,
                });
            } else if (is_resizing_right) {
                bar_being_dragged.$bar.finaldx = this.get_snap_x_position(dx);
                bar_being_dragged.update_bar_position({
                    width:
                        bar_being_dragged.$bar.owidth +
                        bar_being_dragged.$bar.finaldx,
                });
            } else if (is_dragging) {
                if (bar_being_dragged.task.drag_drop_x) {

                    if (this.options.moving_scroll_bar) {
                        this.moving_scroll_bar(e);
                    }

                    bar_being_dragged.$bar.finaldx = this.get_snap_x_position(dx);
                    bar_being_dragged.update_bar_position({
                        x:
                            bar_being_dragged.$bar.ox +
                            bar_being_dragged.$bar.finaldx
                    });
                }
                if (bar_being_dragged.task.drag_drop_y) {
                    const y = bar_being_dragged.$bar.oy + dy;
                    if (y < min_y) {
                        dy = min_y - bar_being_dragged.$bar.oy;
                    } else if (y > max_y) {
                        dy = max_y - bar_being_dragged.$bar.oy;
                    }
                    bar_being_dragged.$bar.finaldy = this.get_snap_y_position(dy);
                    bar_being_dragged.update_bar_position({
                        y:
                            bar_being_dragged.$bar.oy +
                            bar_being_dragged.$bar.finaldy
                    });
                }
            }

            // update children
            bars.forEach((bar) => {
                if (bar.task.id === parent_bar_id) {
                    return;
                }
                const $bar = bar.$bar;
                $bar.finaldx = this.get_snap_x_position(dx);
                this.hide_popup();
                if (is_resizing_left) {
                    bar.update_bar_position({
                        x: $bar.ox + $bar.finaldx,
                    });
                } else if (is_dragging) {
                    bar.update_bar_position({
                        x: $bar.ox + $bar.finaldx,
                    });
                }
            });
        });

        $.on(this.$svg, 'mouseup', (e) => {
            if (action_in_progress()) {
                bars.forEach((bar) => {
                    bar.group.classList.remove('active');

                    const $bar = bar.$bar;
                    const start_row_index = bar.task._index;

                    if ($bar.finaldx || $bar.finaldy) {
                        bar.position_changed((is_dragging || is_resizing_left), (is_dragging || is_resizing_right));
                        bar.set_action_completed();
                        if (this.options.overlap)
                            this.overlap(start_row_index, bar.task._index);
                        else
                            this.red_border();
                    }
                });
            }

            this.bar_being_dragged = null;
            is_dragging = false;
            is_resizing_left = false;
            is_resizing_right = false;
        });

        this.bind_bar_progress();
    }

    bind_bar_progress() {
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing = null;
        let bar = null;
        let $bar_progress = null;
        let $bar = null;

        $.on(this.$svg, 'mousedown', '.handle.progress', (e, handle) => {
            is_resizing = true;
            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            const $bar_wrapper = $.closest('.bar-wrapper', handle);
            const id = $bar_wrapper.getAttribute('data-id');
            bar = this.get_bar(id);

            $bar_progress = bar.$bar_progress;
            $bar = bar.$bar;

            $bar_progress.finaldx = 0;
            $bar_progress.owidth = $bar_progress.getWidth();
            $bar_progress.min_dx = -$bar_progress.getWidth();
            $bar_progress.max_dx = $bar.getWidth() - $bar_progress.getWidth();
        });

        $.on(this.$svg, 'mousemove', (e) => {
            if (!is_resizing) return;
            let dx = e.offsetX - x_on_start;
            let dy = e.offsetY - y_on_start;

            if (dx > $bar_progress.max_dx) {
                dx = $bar_progress.max_dx;
            }
            if (dx < $bar_progress.min_dx) {
                dx = $bar_progress.min_dx;
            }

            const $handle = bar.$handle_progress;
            $.attr($bar_progress, 'width', $bar_progress.owidth + dx);
            $.attr($handle, 'points', bar.get_progress_polygon_points());
            $bar_progress.finaldx = dx;
        });
        $.on(this.$svg, 'mouseup', () => {
            if (is_resizing) {
                if (!($bar_progress && $bar_progress.finaldx)) return;
                bar.progress_changed();
                bar.set_action_completed();
            }
            is_resizing = false;
        });
    }

    compute_row_sub_level(row_id) {
        const task_in_same_row = this.tasks.filter(task => task.row === row_id);
        //ordina per data le task in quella riga
        task_in_same_row.sort((a, b) => a._start - b._start);

        let sub_levels = [];

        task_in_same_row.forEach(task => {
            let i = 0;
            // Trova l'indice del sotto livello in cui inserire questa task
            for (i = 0; i < sub_levels.length; i++) {
                const last_task_in_sub_level = sub_levels[i][sub_levels[i].length - 1];
                if (task._start >= last_task_in_sub_level._end)
                    break;
            }

            task._sub_level_index = i;
            if (!sub_levels[task._sub_level_index])
                sub_levels[task._sub_level_index] = [];

            sub_levels[task._sub_level_index].push(task);
        });

        return sub_levels;
    }

    compute_row_height(nlevels) {
        nlevels = nlevels > 0 ? nlevels : 1;
        const row_height = (this.options.bar_height + this.options.padding) * nlevels;
        return row_height;
    }

    compute_row_y(row_index, fixed_column_width) {
        let sum_y = this.rows[row_index].y;
        for (let i = row_index; i < this.rows.length; i++) {
            $.attr(this.rows[i].rect, 'y', sum_y);
            if (fixed_column_width !== 0) {
                $.attr(this.rows[i].fixed_rect, 'y', sum_y);
                //cell
                for (let c = 0; c < this.options.fixed_columns.length; c++) {
                    $.attr(this.rows[i].cell_wrapper[c].fixed_cell, 'y', sum_y);
                    if (this.rows[i].cell_wrapper[c].text)
                        $.attr(this.rows[i].cell_wrapper[c].text, 'y', sum_y + 24);
                }
            }

            this.rows[i].y = sum_y;
            sum_y += this.rows[i].height;
            //line
            if (fixed_column_width !== 0) {
                $.attr(this.rows[i].fixed_line, 'y1', sum_y);
                $.attr(this.rows[i].fixed_line, 'y2', sum_y);
            }
            $.attr(this.rows[i].line, 'y1', sum_y);
            $.attr(this.rows[i].line, 'y2', sum_y);
        }
    }

    overlap(start_row_index, end_row_index) {
        let render = false;
        let update_from_this_row_index = end_row_index;
        const fixed_column_width = parseInt(this.$column_svg.getAttribute('width'));

        const end_row = this.rows[end_row_index];
        const new_end_sub_level = this.compute_row_sub_level(end_row.id);
        if (new_end_sub_level.length !== end_row.sub_level.length) {
            end_row.sub_level = new_end_sub_level;
            end_row.height = this.compute_row_height(end_row.sub_level.length);

            $.attr(end_row.rect, 'height', end_row.height);
            if (fixed_column_width !== 0) {
                $.attr(end_row.fixed_rect, 'height', end_row.height);
                for (let i = 0; i < this.options.fixed_columns.length; i++) {
                    $.attr(end_row.cell_wrapper[i].fixed_cell, 'height', end_row.height);
                }
            }
            render = true;
        } else {
            const bars_in_same_row = this.bars.filter(bar =>
                bar.task._index === end_row_index
            );
            bars_in_same_row.forEach(bar => {
                const new_y = bar.compute_y();
                bar.update_bar_position({ y: new_y });
            });
        }

        if (start_row_index != end_row_index) {
            const start_row = this.rows[start_row_index];
            const new_start_sub_level = this.compute_row_sub_level(start_row.id);
            if (new_start_sub_level.length != start_row.sub_level.length) {
                start_row.sub_level = new_start_sub_level;
                start_row.height = this.compute_row_height(start_row.sub_level.length);

                $.attr(start_row.rect, 'height', start_row.height);
                if (fixed_column_width !== 0) {
                    $.attr(start_row.fixed_rect, 'height', start_row.height);
                    for (let i = 0; i < this.options.fixed_columns.length; i++) {
                        $.attr(start_row.cell_wrapper[i].fixed_cell, 'height', start_row.height);
                    }
                }
                render = true;
                if (start_row_index < end_row_index)
                    update_from_this_row_index = start_row_index;
            }
        }

        if (render) {
            const scrollTop = this.$container.scrollTop;
            this.compute_row_y(update_from_this_row_index, fixed_column_width);
            this.update_from_row(update_from_this_row_index, fixed_column_width);
            if (scrollTop > (this.$svg.getAttribute('height') - this.$container.clientHeight))
                this.$container.scrollTop = scrollTop - (this.options.bar_height * 2);
        }
    }

    update_from_row(row_index, fixed_column_width) {

        const max_height = this.rows[this.rows.length - 1].y + this.rows[this.rows.length - 1].height;

        //background
        this.$svg.setAttribute('height', max_height);
        const grid_background = this.$svg.querySelector('g.grid > rect');
        $.attr(grid_background, 'height', max_height);

        if (fixed_column_width !== 0) {
            //fixed background
            this.$column_svg.setAttribute('height', max_height);
            const fixed_background = this.$column_svg.querySelector('g.grid > rect');
            $.attr(fixed_background, 'height', max_height);

            //fixed ticks
            const fixed_ticks = Array.from(this.$column_svg.querySelectorAll('g.grid > path'));
            fixed_ticks.forEach(tick => {
                const curr_d = tick.getAttribute('d');
                const new_d = curr_d.replace(/v\s*[^v]*$/, `v ${max_height}`);

                $.attr(tick, 'd', new_d);
            });
        }
        //ticks
        const ticks = Array.from(this.$svg.querySelectorAll('g.grid .grid-ticks path'));
        ticks.forEach(tick => {
            const curr_d = tick.getAttribute('d');
            const new_d = curr_d.replace(/v\s*[^v]*$/, `v ${max_height}`);

            $.attr(tick, 'd', new_d);
        });
        //highlight
        const today_highlight = Array.from(this.$svg.getElementsByClassName('today-highlight'));
        today_highlight.forEach(highlight => {
            const highlight_y = parseFloat(highlight.getAttribute('y')) || 0;
            $.attr(highlight, 'height', Math.max(max_height - highlight_y, 0));
        });
        const weekend_highlight = Array.from(this.$svg.getElementsByClassName('weekend-highlight'))
        weekend_highlight.forEach(weekend => {
            const weekend_y = parseFloat(weekend.getAttribute('y')) || 0;
            $.attr(weekend, 'height', Math.max(max_height - weekend_y, 0));
        });
        //bars
        const bars_to_move = this.bars.filter(bar =>
            bar.task._index >= row_index
        );
        bars_to_move.forEach(bar => {
            const new_y = bar.compute_y();
            bar.update_bar_position({ y: new_y });
        });
    }

    moving_scroll_bar(e) {
        //Variabile che serve per aggiornare la scrollbar
        var scroll_bar = this.$svg.parentElement;
        //coordinate x e y del mouse
        var viewportX = e.clientX;
        var viewportY = e.clientY;
        //edges del container
        var edgeTop = this.$container.offsetTop + this.options.header_height + (this.options.padding * 3);
        var edgeLeft = this.$container.offsetLeft + (this.options.padding * 8);
        var edgeBottom = this.$container.clientHeight - (this.options.padding * 2);
        var edgeRight = this.$container.clientWidth - (this.options.padding * 2);
        //variabili per capire in quale punto ci si trova
        var isInLeftEdge = (viewportX < edgeLeft);
        var isInRightEdge = (viewportX > edgeRight);
        var isInTopEdge = (viewportY < edgeTop);
        var isInBottomEdge = (viewportY > edgeBottom);
        //I massimi sono larghezza e atezza del container
        var maxScrollX = this.$container.scrollWidth;
        var maxScrollY = this.$svg.getAttribute('height') - this.$container.clientHeight;
        // Get the current scroll position of the document.(container)
        var currentScrollX = this.$container.scrollLeft;
        var currentScrollY = this.$container.scrollTop;
        // Determine if the window can be scrolled in any particular direction.
        var canScrollUp = (currentScrollY > 0);
        var canScrollDown = (currentScrollY < maxScrollY);
        var canScrollLeft = (currentScrollX > 0);
        var canScrollRight = (currentScrollX < maxScrollX);

        var nextScrollX = currentScrollX;
        var nextScrollY = currentScrollY;

        //Serve a calcolare la velocità con cui scrollare
        var maxStep = 30;

        // Should we scroll left?
        if (isInLeftEdge && canScrollLeft) {
            var intensity = ((edgeLeft - viewportX) / edgeLeft);
            nextScrollX = (nextScrollX - (maxStep * intensity));
            // Should we scroll right?
        } else if (isInRightEdge && canScrollRight) {
            var intensity = ((viewportX - edgeRight) / edgeLeft);
            nextScrollX = (nextScrollX + (maxStep * intensity));
        }

        // Should we scroll up?
        if (isInTopEdge && canScrollUp) {
            var intensity = ((edgeTop - viewportY) / edgeTop);
            nextScrollY = (nextScrollY - (maxStep * intensity));
            // Should we scroll down?
        } else if (isInBottomEdge && canScrollDown) {
            var intensity = ((viewportY - edgeBottom) / edgeTop);
            nextScrollY = (nextScrollY + (maxStep * intensity));
        }

        nextScrollX = Math.max(0, Math.min(maxScrollX, nextScrollX));
        nextScrollY = Math.max(0, Math.min(maxScrollY, nextScrollY));

        if (
            (nextScrollX !== currentScrollX) ||
            (nextScrollY !== currentScrollY)
        ) {
            scroll_bar.scrollLeft = nextScrollX;
            scroll_bar.scrollTop = nextScrollY;
        }
    }

    red_border() {
        this.bars.forEach(bar => {
            const bar_wrapper = $.closest('.bar-wrapper', bar.$bar);

            if (this.bars.some(other_bar => {
                return other_bar.task.id !== bar.task.id &&
                    other_bar.task.row === bar.task.row &&
                    bar.task._start < other_bar.task._end &&
                    bar.task._end > other_bar.task._start;
            })) {
                bar_wrapper.classList.add('overlap');
            }
            else {
                bar_wrapper.classList.remove('overlap');
            }
        });
    }

    get_all_dependent_tasks(task_id) {
        let out = [];
        let to_process = [task_id];
        while (to_process.length) {
            const deps = to_process.reduce((acc, curr) => {
                acc = acc.concat(this.dependency_map[curr]);
                return acc;
            }, []);

            out = out.concat(deps);
            to_process = deps.filter((d) => !to_process.includes(d));
        }

        return out.filter(Boolean);
    }

    show_cell_popup(cell, cell_value, cell_tooltip, e) {
        if (this.bar_being_dragged) return;
        if (cell_value === cell_tooltip)
            cell_tooltip = '';
        this.show_popup({
            target_element: cell,
            title: cell_value,
            description: '',
            subtitle: cell_tooltip,
            task: '',
            e: e,
        });
    }

    get_snap_minutes() {
        if (this.options.zoom_step <= 30) {
            return 15;
        } else if (this.options.zoom_step <= 60) {
            return 30;
        } else if (this.options.zoom_step <= 12 * 60) {
            return 60;
        } else if (this.options.zoom_step <= 24 * 60) {
            return 120;
        } else if (this.options.zoom_step <= 7 * 24 * 60) {
            return 360;
        }

        return 24 * 60;
    }

    normalize_snapped_date(date) {
        const minute_ms = 60 * 1000;
        return new Date(Math.round(date.getTime() / minute_ms) * minute_ms);
    }

    get_snap_x_position(dx) {
        const duration_ms = this.width_to_duration_ms(dx);
        const snap_ms = this.get_snap_minutes() * 60 * 1000;
        const snapped_duration_ms = Math.round(duration_ms / snap_ms) * snap_ms;
        return this.duration_to_width(snapped_duration_ms);
    }

    get_snap_y_position(dy) {
        let ody = dy,
            rem,
            position;
        const row_height = this.options.bar_height + this.options.padding;
        rem = Math.abs(ody) % row_height;
        position = ody - rem + (rem < row_height / 2 ? 0 : row_height);
        if (ody < 0) {
            position = Math.abs(ody) - rem + (rem < row_height / 2 ? 0 : row_height);
            position = -position;
        }
        return position;
    }

    unselect_all() {
        [...this.$column_svg.querySelectorAll('.cell-wrapper.selected-row')].forEach((el) => {
            el.classList.remove('selected-row');
        });
        [...this.$svg.querySelectorAll('.grid-row.selected-row')].forEach((el) => {
            el.classList.remove('selected-row');
        });
        [...this.$svg.querySelectorAll('.bar-wrapper')].forEach((el) => {
            el.classList.remove('active');
        });
    }

    view_is(modes) {
        if (typeof modes === 'string') {
            return this.options.view_mode === modes;
        }

        if (Array.isArray(modes)) {
            return modes.some((mode) => this.options.view_mode === mode);
        }

        return false;
    }

    get_task(id) {
        return this.tasks.find((task) => {
            return task.id === id;
        });
    }

    get_bar(id) {
        return this.bars.find((bar) => {
            return bar.task.id === id;
        });
    }

    show_popup(options) {
        if (!this.popup) {
            this.popup = new Popup(
                this.popup_wrapper,
                this.options.custom_popup_html
            );
        }
        const scroll = this.$container.scrollTop;
        this.popup.show(options, this.$container_parent, scroll);
    }

    hide_popup() {
        this.popup && this.popup.hide();
    }

    trigger_event(event, args) {
        if (this.options['on_' + event]) {
            this.options['on_' + event].apply(null, args);
        }
    }

    /**
     * Gets the oldest starting date from the list of tasks
     *
     * @returns Date
     * @memberof Scheduler
     */
    get_oldest_starting_date() {
        return this.tasks
            .map((task) => task._start)
            .reduce((prev_date, cur_date) =>
                cur_date <= prev_date ? cur_date : prev_date
            );
    }

    /**
     * Clear all elements from the parent svg element
     *
     * @memberof Scheduler
     */
    clear() {
        this.$svg.innerHTML = '';
        this.$column_svg.innerHTML = '';
    }
}

Scheduler.VIEW_MODE = VIEW_MODE;

function generate_id(task) {
    return task.name + '_' + Math.random().toString(36).slice(2, 12);
}
