import date_utils from './date_utils';
import { $, createSVG, animateSVG } from './svg_utils';

export default class Bar {
    constructor(scheduler, task) {
        this.set_defaults(scheduler, task);
        this.prepare();
        this.draw();
        this.bind();
    }

    set_defaults(scheduler, task) {
        this.action_completed = false;
        this.scheduler = scheduler;
        this.task = task;
    }

    prepare() {
        this.prepare_values();
        this.prepare_helpers();
    }

    prepare_values() {
        let task_end = this.task._end;
        this.invalid = this.task.invalid;
        this.height = this.scheduler.options.bar_height;
        this.handle_width = 8;
        this.x = this.compute_x();
        this.y = this.compute_y();
        this.corner_radius = this.scheduler.options.bar_corner_radius;
        const duration_in_ms = task_end.getTime() - this.task._start.getTime();
        this.duration = duration_in_ms / this.scheduler.get_ms_per_column();
        this.width = this.scheduler.duration_to_width(duration_in_ms);

        if (duration_in_ms < 60 * 60 * 1000) {
            const minimum_columns = this.scheduler.options.zoom_step <= (24 * 60) ? 0.1 : 0.03;
            this.width = Math.max(this.width, this.scheduler.options.column_width * minimum_columns);
            this.duration = this.width / this.scheduler.options.column_width;
        }

        this.progress_width =
            this.width *
            (this.task.progress / 100) || 0;
        this.group = createSVG('g', {
            class: 'bar-wrapper ' + (this.task.custom_class || ''),
            'data-id': this.task.id,
        });
        this.bar_group = createSVG('g', {
            class: 'bar-group',
            append_to: this.group,
        });
        this.handle_group = createSVG('g', {
            class: 'handle-group',
            append_to: this.group,
        });
    }

    prepare_helpers() {
        SVGElement.prototype.getX = function () {
            return +this.getAttribute('x');
        };
        SVGElement.prototype.getY = function () {
            return +this.getAttribute('y');
        };
        SVGElement.prototype.getWidth = function () {
            return +this.getAttribute('width');
        };
        SVGElement.prototype.getHeight = function () {
            return +this.getAttribute('height');
        };
        SVGElement.prototype.getEndX = function () {
            return this.getX() + this.getWidth();
        };
    }

    draw() {
        this.draw_bar();
        this.draw_progress_bar();
        this.draw_label();
        this.draw_resize_handles();
    }

    draw_bar() {
        this.$bar = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'bar',
            append_to: this.bar_group,
        });

        animateSVG(this.$bar, 'width', 0, this.width);

        if (this.invalid) {
            this.$bar.classList.add('bar-invalid');
        }
    }

    draw_progress_bar() {
        if (this.invalid) return;
        this.$bar_progress = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.progress_width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'bar-progress',
            append_to: this.bar_group,
        });

        animateSVG(this.$bar_progress, 'width', 0, this.progress_width);
    }

    draw_label() {
        createSVG('text', {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            innerHTML: this.task.name,
            class: 'bar-label',
            append_to: this.bar_group,
        });
        // labels get BBox in the next tick
        requestAnimationFrame(() => this.update_label_position());
    }

    draw_resize_handles() {
        if (this.invalid) return;

        const bar = this.$bar;
        const handle_width = this.handle_width;

        if (this.task.resize_right)
            createSVG('rect', {
                x: bar.getX() + bar.getWidth() - handle_width - 1,
                y: bar.getY() + 1,
                width: handle_width,
                height: this.height - 2,
                rx: this.corner_radius,
                ry: this.corner_radius,
                class: 'handle right',
                append_to: this.handle_group,
            });

        if (this.task.resize_left)
            createSVG('rect', {
                x: bar.getX() + 1,
                y: bar.getY() + 1,
                width: handle_width,
                height: this.height - 2,
                rx: this.corner_radius,
                ry: this.corner_radius,
                class: 'handle left',
                append_to: this.handle_group,
            });

        if (this.task.progress && this.task.progress < 100) {
            this.$handle_progress = createSVG('polygon', {
                points: this.get_progress_polygon_points().join(','),
                class: 'handle progress',
                append_to: this.handle_group,
            });
        }
    }

    get_progress_polygon_points() {
        const bar_progress = this.$bar_progress;
        return [
            bar_progress.getEndX() - 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX() + 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX(),
            bar_progress.getY() + bar_progress.getHeight() - 8.66,
        ];
    }

    bind() {
        if (this.invalid) return;
        this.setup_click_event();
    }

    setup_click_event() {
        $.on(this.group, 'mouseover', '.bar-wrapper', (e) => {
            if (this.scheduler.bar_being_dragged)
                return;
            // if (!e.target.classList.contains('bar')) return;
            this.show_popup(e);
        });

        $.on(this.group, 'mouseleave', '.bar-wrapper', (e) => {
            if (e.relatedTarget != null &&
                (e.relatedTarget.classList.contains('pointer') ||
                    e.relatedTarget.classList.contains('title'))) return;
            this.scheduler.hide_popup();
        });

        $.on(this.group, 'click', (e) => {
            if (this.action_completed) return;

            this.scheduler.unselect_all();
            this.group.classList.add('active');
        });

        $.on(this.group, 'dblclick', (e) => {
            if (this.action_completed) {
                // just finished a move action, wait for a few seconds
                return;
            }

            this.scheduler.trigger_event('task_dblclick', [this.task.id]);
        });
    }

    show_popup(e) {
        const start_date = date_utils.format(
            this.task._start,
            'D MMM YYYY HH:mm',
            this.scheduler.options.language
        );
        const end_date = date_utils.format(
            this.task._end,
            'D MMM YYYY HH:mm',
            this.scheduler.options.language
        );
        const subtitle = start_date + ' - ' + end_date;

        this.scheduler.show_popup({
            target_element: this.$bar,
            title: this.task.name,
            description: this.task.description,
            subtitle: subtitle,
            task: this.task,
            e: e,
        });
    }

    update_bar_position({ x = null, width = null, y = null }) {
        const bar = this.$bar;
        if (x !== null) {
            // get all x values of parent task
            const xs = this.task.dependencies.map((dep) => {
                return this.scheduler.get_bar(dep).$bar.getX();
            });
            // child task must not go before parent
            const valid_x = xs.reduce((prev, curr) => {
                return x >= curr;
            }, x);
            if (!valid_x) {
                width = null;
                return;
            }
            this.update_attr(bar, 'x', x);
            this.x = x;
        }
        if (width !== null && width >= this.handle_width * 2 + 3) {
            this.update_attr(bar, 'width', width);
            this.width = width;
        }
        if (y !== null) {
            this.update_attr(bar, 'y', y);
            this.y = y;
        }
        this.update_label_position();
        this.update_progressbar_position();
        this.update_handle_position();
        this.update_arrow_position();
    }

    position_changed(calc_start, calc_end) {
        let changed = false;
        let { new_start_date, new_end_date } = this.compute_start_end_date();
        if (calc_start) {
            changed = true;
            this.task._start = new_start_date;
            this.task.start = date_utils.to_local(new_start_date);
        }

        if (calc_end) {
            changed = true;
            this.task._end = new_end_date;
            this.task.end = date_utils.to_local(new_end_date);
        }

        const new_index = this.compute_index();
        const new_row = this.scheduler.options.rows[new_index];
        if (this.task._index !== new_index) {
            changed = true;
            this.task._index = new_index;
            this.task.row = new_row;
        }

        if (!changed) return;

        this.scheduler.trigger_event('position_change', [
            this.task,
            new_row,
            date_utils.to_local(new_start_date),
            date_utils.to_local(new_end_date),
        ]);
    }

    progress_changed() {
        const new_progress = this.compute_progress();
        this.task.progress = new_progress;
        this.scheduler.trigger_event('progress_change', [this.task, new_progress]);
    }

    set_action_completed() {
        this.action_completed = true;
        setTimeout(() => (this.action_completed = false), 200);
    }

    compute_start_end_date() {
        const bar = this.$bar;
        const new_start_date = this.scheduler.normalize_snapped_date(
            this.scheduler.x_to_time(bar.getX())
        );
        const duration_ms = Math.round(this.scheduler.width_to_duration_ms(bar.getWidth()));
        const new_end_date = this.scheduler.normalize_snapped_date(
            new Date(new_start_date.getTime() + duration_ms)
        );

        return { new_start_date, new_end_date };
    }

    compute_index() {
        const bar = this.$bar;
        const barY = bar.getY();
        let sum_height = this.scheduler.options.header_height + this.scheduler.options.padding / 2;

        for (let i = 0; i < this.scheduler.rows.length; i++) {
            const row_start = sum_height;
            const row = this.scheduler.rows[i];
            sum_height += row.height;

            if (barY >= row_start && barY <= sum_height)
                return i;
        }
    }

    compute_progress() {
        const progress =
            (this.$bar_progress.getWidth() / this.$bar.getWidth()) * 100;
        return parseInt(progress, 10);
    }

    compute_x() {
        const task_start = this.task._start;
        return this.scheduler.time_to_x(task_start);
    }

    compute_y() {
        let bar_y;
        if (this.scheduler.options.overlap) {
            bar_y = (this.scheduler.options.padding / 2) +
                (this.scheduler.options.padding + this.scheduler.options.bar_height) * this.task._sub_level_index +
                this.scheduler.rows[this.task._index].y;
        } else {
            bar_y = ((this.scheduler.options.padding / 2) + this.scheduler.rows[this.task._index].y);
        }
        return bar_y;
    }

    update_attr(element, attr, value) {
        value = +value;
        if (!isNaN(value)) {
            element.setAttribute(attr, value);
        }
        return element;
    }

    update_progressbar_position() {
        if (this.invalid) return;
        this.$bar_progress.setAttribute('x', this.$bar.getX());
        this.$bar_progress.setAttribute('y', this.$bar.getY());
        this.$bar_progress.setAttribute(
            'width',
            this.$bar.getWidth() * (this.task.progress / 100)
        );
    }

    update_label_position() {
        const bar = this.$bar,
            label = this.group.querySelector('.bar-label');

        const handle_width = this.handle_width;

        const max_width = bar.getWidth() - (handle_width * 2);
        const text = label.textContent;
        const text_width = label.getBBox().width;
        const original_text = this.task.name;

        if (text_width + (handle_width * 2) > max_width) {
            const reduction_percentage = (text_width - max_width) / text_width;
            const visible_characters = Math.max(0, Math.round(text.length * (1 - reduction_percentage)));
            label.textContent = text.substring(0, visible_characters);
        } else {
            const expansion_percentage = (max_width - text_width) / original_text.length;
            const visible_characters = Math.min(original_text.length, Math.round(original_text.length * (1 + expansion_percentage)));
            label.textContent = original_text.substring(0, visible_characters);
        }

        label.setAttribute('x', bar.getX() + bar.getWidth() / 2);
        label.setAttribute('y', bar.getY() + bar.getHeight() / 2);
    }

    update_handle_position() {
        if (this.invalid) return;
        const bar = this.$bar;

        let handle = this.handle_group.querySelector('.handle.left');
        if (handle) {
            handle.setAttribute('x', bar.getX() + 1)
            handle.setAttribute('y', bar.getY() + 1)
        }
        handle = this.handle_group.querySelector('.handle.right');
        if (handle) {
            handle.setAttribute('x', bar.getEndX() - this.handle_width - 1)
            handle.setAttribute('y', bar.getY() + 1);
        }
        handle = this.group.querySelector('.handle.progress');
        handle &&
            handle.setAttribute('points', this.get_progress_polygon_points());
    }

    update_arrow_position() {
        this.arrows = this.arrows || [];
        for (let arrow of this.arrows) {
            arrow.update();
        }
    }
}

function isFunction(functionToCheck) {
    var getType = {};
    return (
        functionToCheck &&
        getType.toString.call(functionToCheck) === '[object Function]'
    );
}
