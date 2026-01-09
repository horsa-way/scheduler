var Scheduler = (function () {
    'use strict';

    const YEAR = 'year';
    const MONTH = 'month';
    const DAY = 'day';
    const HOUR = 'hour';
    const MINUTE = 'minute';
    const SECOND = 'second';
    const MILLISECOND = 'millisecond';

    var date_utils = {
        parse(date, date_separator = '-', time_separator = /[.:]/) {
            if (date instanceof Date) {
                return date;
            }
            if (typeof date === 'string') {
                let date_parts, time_parts;
                const parts = date.split(' ');

                date_parts = parts[0]
                    .split(date_separator)
                    .map((val) => parseInt(val, 10));
                time_parts = parts[1] && parts[1].split(time_separator);

                // month is 0 indexed
                date_parts[1] = date_parts[1] - 1;

                let vals = date_parts;

                if (time_parts && time_parts.length) {
                    if (time_parts.length == 4) {
                        time_parts[3] = '0.' + time_parts[3];
                        time_parts[3] = parseFloat(time_parts[3]) * 1000;
                    }
                    vals = vals.concat(time_parts);
                }

                return new Date(...vals);
            }
        },

        to_string(date, with_time = false) {
            if (!(date instanceof Date)) {
                throw new TypeError('Invalid argument type');
            }
            const vals = this.get_date_values(date).map((val, i) => {
                if (i === 1) {
                    // add 1 for month
                    val = val + 1;
                }

                if (i === 6) {
                    return padStart(val + '', 3, '0');
                }

                return padStart(val + '', 2, '0');
            });
            const date_string = `${vals[0]}-${vals[1]}-${vals[2]}`;
            const time_string = `${vals[3]}:${vals[4]}:${vals[5]}.${vals[6]}`;

            return date_string + (with_time ? ' ' + time_string : '');
        },

        format(date, format_string = 'YYYY-MM-DD HH:mm:ss.SSS', lang = 'it') {
            const dateTimeFormat = new Intl.DateTimeFormat(lang, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3,
                weekday: 'long',
                month: 'long',
                timeZone: "UTC",
            });
            const parts = dateTimeFormat.formatToParts(date);
            const dateParts = {};
            parts.forEach(({ type, value }) => {
                dateParts[type] = value;
            });
            const day_name_capitalized = dateParts.weekday.charAt(0).toUpperCase() + dateParts.weekday.slice(1);
            const month_name_capitalized = dateParts.month.charAt(0).toUpperCase() + dateParts.month.slice(1);
            const format_map = {
                YYYY: dateParts.year,
                YYY: dateParts.year.substring(2,4),
                MM: dateParts.month.padStart(2, '0'),
                DD: dateParts.day.padStart(2, '0'),
                HH: dateParts.hour.padStart(2, '0'),
                mm: dateParts.minute.padStart(2, '0'),
                ss: dateParts.second.padStart(2, '0'),
                SSS: dateParts.fractionalSecond.padStart(3, '0'),
                D: dateParts.day.padStart(2, '0'),
                MMM: month_name_capitalized,
                MM: month_name_capitalized.substring(0,3),
                ddd: day_name_capitalized,
                dd: day_name_capitalized.substring(0,2)
            };

            let str = format_string;
            const formatted_values = [];

            Object.keys(format_map)
                .sort((a, b) => b.length - a.length) // big string first
                .forEach((key) => {
                    if (str.includes(key)) {
                        str = str.replace(key, `$${formatted_values.length}`);
                        formatted_values.push(format_map[key]);
                    }
                });

            formatted_values.forEach((value, i) => {
                str = str.replace(`$${i}`, value);
            });

            return str;
        },

        diff(date_a, date_b, scale = DAY) {
            let milliseconds, seconds, hours, minutes, days, months, years;

            milliseconds = date_a - date_b;
            seconds = milliseconds / 1000;
            minutes = seconds / 60;
            hours = minutes / 60;
            days = hours / 24;
            months = days / 30;
            years = months / 12;

            if (!scale.endsWith('s')) {
                scale += 's';
            }

            return Math.round(
                {
                    milliseconds,
                    seconds,
                    minutes,
                    hours,
                    days,
                    months,
                    years,
                }[scale]
            );
        },

        today() {
            const vals = this.get_date_values(new Date()).slice(0, 3);
            return new Date(...vals);
        },

        now() {
            return new Date();
        },

        add(date, qty, scale) {
            qty = parseInt(qty, 10);
            const vals = [
                date.getUTCFullYear() + (scale === YEAR ? qty : 0),
                date.getUTCMonth() + (scale === MONTH ? qty : 0),
                date.getUTCDate() + (scale === DAY ? qty : 0),
                date.getUTCHours() + (scale === HOUR ? qty : 0),
                date.getUTCMinutes() + (scale === MINUTE ? qty : 0),
                date.getUTCSeconds() + (scale === SECOND ? qty : 0),
                date.getUTCMilliseconds() + (scale === MILLISECOND ? qty : 0),
            ];
            return new Date(Date.UTC(...vals));
        },

        start_of(date, scale) {
            if (scale == 'week')
            {
                var d = this.clone(date);
                var day = d.getUTCDay(), diff = d.getUTCDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
                d.setUTCDate(diff);
                return d;
            }

            const scores = {
                [YEAR]: 6,
                [MONTH]: 5,
                [DAY]: 4,
                [HOUR]: 3,
                [MINUTE]: 2,
                [SECOND]: 1,
                [MILLISECOND]: 0,
            };

            function should_reset(_scale) {
                const max_score = scores[scale];
                return scores[_scale] <= max_score;
            }

            const vals = [
                date.getFullYear(),
                should_reset(YEAR) ? 0 : date.getUTCMonth(),
                should_reset(MONTH) ? 1 : date.getUTCDate(),
                should_reset(DAY) ? 0 : date.getUTCHours(),
                should_reset(HOUR) ? 0 : date.getUTCMinutes(),
                should_reset(MINUTE) ? 0 : date.getUTCSeconds(),
                should_reset(SECOND) ? 0 : date.getUTCMilliseconds(),
            ];

            return new Date(Date.UTC(...vals));
        },

        clone(date) {
            return new Date(Date.UTC(...this.get_date_values(date)));
        },

        get_date_values(date) {
            return [
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                date.getUTCHours(),
                date.getUTCMinutes(),
                date.getUTCSeconds(),
                date.getUTCMilliseconds(),
            ];
        },

        get_days_in_month(date) {
            const no_of_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

            const month = date.getMonth();

            if (month !== 1) {
                return no_of_days[month];
            }

            // Feb
            const year = date.getFullYear();
            if ((year % 4 == 0 && year % 100 != 0) || year % 400 == 0) {
                return 29;
            }
            return 28;
        },

        normalize_UTC(date) {
            return new Date(Date.UTC(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
                date.getHours(),
                date.getMinutes(),
                date.getSeconds(),
                date.getMilliseconds()
            ));
        },

        to_local(date) {
            return new Date(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                date.getUTCHours(),
                date.getUTCMinutes(),
                date.getUTCSeconds(),
                date.getUTCMilliseconds(),
            );
        }
    };

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
    function padStart(str, targetLength, padString) {
        str = str + '';
        targetLength = targetLength >> 0;
        padString = String(typeof padString !== 'undefined' ? padString : ' ');
        if (str.length > targetLength) {
            return String(str);
        } else {
            targetLength = targetLength - str.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength / padString.length);
            }
            return padString.slice(0, targetLength) + String(str);
        }
    }

    function $(expr, con) {
        return typeof expr === 'string'
            ? (con || document).querySelector(expr)
            : expr || null;
    }

    function createSVG(tag, attrs) {
        const elem = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (let attr in attrs) {
            if (attr === 'append_to') {
                const parent = attrs.append_to;
                parent.appendChild(elem);
            } else if (attr === 'innerHTML') {
                elem.innerHTML = attrs.innerHTML;
            } else {
                elem.setAttribute(attr, attrs[attr]);
            }
        }
        return elem;
    }

    function animateSVG(svgElement, attr, from, to) {
        const animatedSvgElement = getAnimationElement(svgElement, attr, from, to);

        if (animatedSvgElement === svgElement) {
            // triggered 2nd time programmatically
            // trigger artificial click event
            const event = document.createEvent('HTMLEvents');
            event.initEvent('click', true, true);
            event.eventName = 'click';
            animatedSvgElement.dispatchEvent(event);
        }
    }

    function getAnimationElement(
        svgElement,
        attr,
        from,
        to,
        dur = '0.4s',
        begin = '0.1s'
    ) {
        const animEl = svgElement.querySelector('animate');
        if (animEl) {
            $.attr(animEl, {
                attributeName: attr,
                from,
                to,
                dur,
                begin: 'click + ' + begin, // artificial click
            });
            return svgElement;
        }

        const animateElement = createSVG('animate', {
            attributeName: attr,
            from,
            to,
            dur,
            begin,
            calcMode: 'spline',
            values: from + ';' + to,
            keyTimes: '0; 1',
            keySplines: cubic_bezier('ease-out'),
        });
        svgElement.appendChild(animateElement);

        return svgElement;
    }

    function cubic_bezier(name) {
        return {
            ease: '.25 .1 .25 1',
            linear: '0 0 1 1',
            'ease-in': '.42 0 1 1',
            'ease-out': '0 0 .58 1',
            'ease-in-out': '.42 0 .58 1',
        }[name];
    }

    $.on = (element, event, selector, callback) => {
        if (!callback) {
            callback = selector;
            $.bind(element, event, callback);
        } else {
            $.delegate(element, event, selector, callback);
        }
    };

    $.off = (element, event, handler) => {
        element.removeEventListener(event, handler);
    };

    $.bind = (element, event, callback) => {
        event.split(/\s+/).forEach(function (event) {
            element.addEventListener(event, callback);
        });
    };

    $.delegate = (element, event, selector, callback) => {
        element.addEventListener(event, function (e) {
            const delegatedTarget = e.target.closest(selector);
            if (delegatedTarget) {
                e.delegatedTarget = delegatedTarget;
                callback.call(this, e, delegatedTarget);
            }
        });
    };

    $.closest = (selector, element) => {
        if (!element) return null;

        if (element.matches(selector)) {
            return element;
        }

        return $.closest(selector, element.parentNode);
    };

    $.attr = (element, attr, value) => {
        if (!value && typeof attr === 'string') {
            return element.getAttribute(attr);
        }

        if (typeof attr === 'object') {
            for (let key in attr) {
                $.attr(element, key, attr[key]);
            }
            return;
        }

        element.setAttribute(attr, value);
    };

    class Bar {
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
            const duration_in_minutes = date_utils.diff(task_end, this.task._start, 'minute');
            if (this.scheduler.view_is('Hour')) {
                this.duration =
                    duration_in_minutes /
                    this.scheduler.options.step;
            } else {
                this.duration =
                    date_utils.diff(task_end, this.task._start, 'hour') /
                    this.scheduler.options.step;
                if (duration_in_minutes < 60) {
                    if (this.scheduler.view_is('Day') ||
                        this.scheduler.view_is('Half Day') ||
                        this.scheduler.view_is('Quarter Day'))
                        this.duration = 0.1;
                    else
                        this.duration = 0.03;

                }
            }
            this.width = this.scheduler.options.column_width * this.duration;
            this.progress_width =
                this.scheduler.options.column_width *
                this.duration *
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
            if (x) {
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
            if (width && width >= this.handle_width * 2 + 3) {
                this.update_attr(bar, 'width', width);
                this.width = width;
            }
            if (y) {
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
            const x_in_units = bar.getX() / this.scheduler.options.column_width;
            let new_start_date;
            if (this.scheduler.view_is('Hour'))
                new_start_date = date_utils.add(
                    this.scheduler.scheduler_start,
                    x_in_units * this.scheduler.options.step,
                    'minute'
                );
            else
                new_start_date = date_utils.add(
                    this.scheduler.scheduler_start,
                    x_in_units * this.scheduler.options.step,
                    'hour'
                );
            const width_in_units = bar.getWidth() / this.scheduler.options.column_width;
            let new_end_date;
            if (this.scheduler.view_is('Hour'))
                new_end_date = date_utils.add(
                    new_start_date,
                    width_in_units * this.scheduler.options.step,
                    'minute'
                );
            else
                new_end_date = date_utils.add(
                    new_start_date,
                    width_in_units * this.scheduler.options.step,
                    'hour'
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
            const { step, column_width } = this.scheduler.options;
            const task_start = this.task._start;
            const scheduler_start = this.scheduler.scheduler_start;

            let diff;
            if (this.scheduler.view_is('Hour'))
                diff = date_utils.diff(task_start, scheduler_start, 'minute');
            else
                diff = date_utils.diff(task_start, scheduler_start, 'hour');

            let x = Math.floor((diff / step) * column_width * 1000) / 1000;

            return x;
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

        get_snap_position(dx) {
            let odx = dx,
                rem,
                position;

            if (this.scheduler.view_is('Week')) {
                rem = dx % (this.scheduler.options.column_width / 7);
                position =
                    odx -
                    rem +
                    (rem < this.scheduler.options.column_width / 14
                        ? 0
                        : this.scheduler.options.column_width / 7);
            } else if (this.scheduler.view_is('Month')) {
                rem = dx % (this.scheduler.options.column_width / 30);
                position =
                    odx -
                    rem +
                    (rem < this.scheduler.options.column_width / 60
                        ? 0
                        : this.scheduler.options.column_width / 30);
            } else {
                rem = dx % this.scheduler.options.column_width;
                position =
                    odx -
                    rem +
                    (rem < this.scheduler.options.column_width / 2
                        ? 0
                        : this.scheduler.options.column_width);
            }
            return position;
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
                handle.setAttribute('x', bar.getX() + 1);
                handle.setAttribute('y', bar.getY() + 1);
            }
            handle = this.handle_group.querySelector('.handle.right');
            if (handle) {
                handle.setAttribute('x', bar.getEndX() - this.handle_width - 1);
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

    class Arrow {
        constructor(scheduler, from_task, to_task) {
            this.scheduler = scheduler;
            this.from_task = from_task;
            this.to_task = to_task;

            this.calculate_path();
            this.draw();
        }

        calculate_path() {
            let start_x =
                this.from_task.$bar.getX() + this.from_task.$bar.getWidth() / 2;

            const condition = () =>
                this.to_task.$bar.getX() < start_x + this.scheduler.options.padding &&
                start_x > this.from_task.$bar.getX() + this.scheduler.options.padding;

            while (condition()) {
                start_x -= 10;
            }

            const start_y =
                this.from_task.$bar.getY() + this.scheduler.options.bar_height;

            const end_x = this.to_task.$bar.getX() - this.scheduler.options.padding / 2;
            const end_y =
                this.to_task.$bar.getY() + this.scheduler.options.bar_height / 2;
            // ======= TODO Da capire come gestirlo
            //             this.scheduler.options.header_height +
            //             this.scheduler.options.bar_height +
            //             (this.scheduler.options.padding + this.scheduler.options.bar_height) *
            //             this.from_task.task._index +
            //             this.scheduler.options.padding;

            //         const end_x = this.to_task.$bar.getX() - this.scheduler.options.padding / 2;
            //         const end_y =
            //             this.scheduler.options.header_height +
            //             this.scheduler.options.bar_height / 2 +
            //             (this.scheduler.options.padding + this.scheduler.options.bar_height) *
            //             this.to_task.task._index +
            //             this.scheduler.options.padding;
            // >>>>>>> 5ec8c1cf7d6f126a89a5e5db096915fb66cda0a4

            const from_is_below_to =
                this.from_task.$bar.getY() > this.to_task.$bar.getY();
            const curve = this.scheduler.options.arrow_curve;
            const clockwise = from_is_below_to ? 1 : 0;
            const curve_y = from_is_below_to ? -curve : curve;
            const offset = from_is_below_to
                ? end_y + this.scheduler.options.arrow_curve
                : end_y - this.scheduler.options.arrow_curve;

            this.path = `
            M ${start_x} ${start_y}
            V ${offset}
            a ${curve} ${curve} 0 0 ${clockwise} ${curve} ${curve_y}
            L ${end_x} ${end_y}
            m -5 -5
            l 5 5
            l -5 5`;

            if (
                this.to_task.$bar.getX() <
                this.from_task.$bar.getX() + this.scheduler.options.padding
            ) {
                const down_1 = this.scheduler.options.padding / 2 - curve;
                const down_2 =
                    this.to_task.$bar.getY() +
                    this.to_task.$bar.getHeight() / 2 -
                    curve_y;
                const left = this.to_task.$bar.getX() - this.scheduler.options.padding;

                this.path = `
                M ${start_x} ${start_y}
                v ${down_1}
                a ${curve} ${curve} 0 0 1 -${curve} ${curve}
                H ${left}
                a ${curve} ${curve} 0 0 ${clockwise} -${curve} ${curve_y}
                V ${down_2}
                a ${curve} ${curve} 0 0 ${clockwise} ${curve} ${curve_y}
                L ${end_x} ${end_y}
                m -5 -5
                l 5 5
                l -5 5`;
            }
        }

        draw() {
            this.element = createSVG('path', {
                d: this.path,
                'data-from': this.from_task.task.id,
                'data-to': this.to_task.task.id,
            });
        }

        update() {
            this.calculate_path();
            this.element.setAttribute('d', this.path);
        }
    }

    class Popup {
        constructor(parent, custom_html) {
            this.parent = parent;
            this.custom_html = custom_html;
            this.is_showing = false;
            this.make();
        }

        make() {
            this.parent.innerHTML = `
            <div class="title"></div>
            <div class="description"></div>
            <div class="subtitle"></div>
            <div class="pointer"></div>
        `;

            this.hide();

            this.title = this.parent.querySelector('.title');
            this.description = this.parent.querySelector('.description');
            this.subtitle = this.parent.querySelector('.subtitle');
            this.pointer = this.parent.querySelector('.pointer');
        }

        show(options, container, scroll) {
            if (this.is_showing) return;
            if (!options.target_element) {
                throw new Error('target_element is required to show popup');
            }

            const target_element = options.target_element;
            this.target_element = options.target_element;
            const width = this.compute_width(options.title.length);

            if (this.custom_html) {
                let html = this.custom_html(options.task);
                html += '<div class="pointer"></div>';
                this.parent.innerHTML = html;
                this.pointer = this.parent.querySelector('.pointer');
            } else {
                // set data
                this.title.innerHTML = options.title;

                this.description.innerHTML = options.description;
                if (options.description === '')
                    this.description.classList.remove('description');
                else
                    this.description.classList.add('description');

                this.subtitle.innerHTML = options.subtitle;
                if (options.subtitle === '')
                    this.subtitle.classList.remove('subtitle');
                else
                    this.subtitle.classList.add('subtitle');

                this.parent.style.width = width + 'px';
            }
            if (target_element instanceof HTMLElement) {
                target_element.getBoundingClientRect();
            } else if (target_element instanceof SVGElement) {
                options.target_element.getBBox();
            }
            const middle_popup = width / 2;

            if (options.e.clientY + this.parent.clientHeight + 20 > container.offsetHeight + container.offsetTop) {
                this.parent.style.left = (options.e.clientX - middle_popup) + 'px';
                if (options.target_element.localName === 'text')
                    this.parent.style.top = (parseInt(options.target_element.getAttribute('y')) + container.offsetTop - scroll - this.parent.offsetHeight - 20) + 'px';
                else
                    this.parent.style.top = (parseInt(options.target_element.getAttribute('y')) + container.offsetTop - scroll - this.parent.offsetHeight - 10) + 'px';
                this.pointer.style.transform = 'rotateZ(0deg)';
                this.pointer.style.left = middle_popup + 'px';
                this.pointer.style.top = (this.parent.offsetHeight + 0.5) + 'px';
            } else {
                this.parent.style.left = (options.e.clientX - middle_popup) + 'px';
                if (options.target_element.localName === 'text')
                    this.parent.style.top = (parseInt(options.target_element.getAttribute('y')) + container.offsetTop + 15 - scroll) + 'px';
                else
                    this.parent.style.top = (parseInt(options.target_element.getAttribute('y')) + container.offsetTop + 30 - scroll) + 'px';
                this.pointer.style.transform = 'rotateZ(180deg)';
                this.pointer.style.left = middle_popup + 'px';
                this.pointer.style.top = '-10px';
            }

            if (parseFloat(this.parent.style.left) < container.offsetLeft) {
                this.parent.style.left = container.offsetLeft + 'px';
                this.pointer.style.left = options.e.clientX - container.offsetLeft + 'px';
            }

            // show
            this.parent.style.opacity = 1;
            this.is_showing = true;
        }

        compute_width(title_length) {
            let width;
            const char_width = 6;

            if (title_length < 20)
                width = 20 * char_width;
            else
                width = title_length * char_width;

            return width;
        }

        hide() {
            this.parent.style.opacity = 0;
            this.parent.style.left = 0;
            this.is_showing = false;
        }
    }

    const VIEW_MODE = {
        HOUR: 'Hour',
        QUARTER_DAY: 'Quarter Day',
        HALF_DAY: 'Half Day',
        DAY: 'Day',
        WEEK: 'Week',
        MONTH: 'Month',
        YEAR: 'Year',
    };

    class Scheduler {
        constructor(wrapper, tasks, cells, options) {
            this.setup_options(options);
            this.setup_wrapper(wrapper);
            this.setup_cells(cells);
            this.setup_tasks(tasks);
            this.setup_rows();
            // initialize with default view mode
            this.change_view_mode();
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
            this.update_view_scale(mode);
            this.setup_dates();
            this.render();
            // fire viewmode_change event
            this.trigger_event('view_change', [mode]);
        }

        update_view_scale(view_mode) {
            this.options.view_mode = view_mode;
            switch (this.options.view_mode) {
                case VIEW_MODE.HOUR:
                    this.options.step = 60;
                    this.options.column_width = 60;
                    break;
                case VIEW_MODE.QUARTER_DAY:
                    this.options.step = 24 / 4;
                    this.options.column_width = 24 * 2;
                    break;
                case VIEW_MODE.HALF_DAY:
                    this.options.step = 24 / 2;
                    this.options.column_width = 24 * 2;
                    break;
                case VIEW_MODE.DAY:
                    this.options.step = 24;
                    this.options.column_width = 24 * 2;
                    break;
                case VIEW_MODE.WEEK:
                    this.options.step = 24 * 7;
                    this.options.column_width = this.options.step;
                    break;
                case VIEW_MODE.MONTH:
                    this.options.step = 24 * 30;
                    this.options.column_width = 150;
                    break;
                case VIEW_MODE.YEAR:
                    this.options.step = 24 * 365;
                    this.options.column_width = 120;
                    break;
            }
        }

        setup_dates() {
            this.setup_scheduler_dates();
            this.setup_date_values();
        }

        setup_scheduler_dates() {
            this.scheduler_start = this.options.date_start;
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
        }

        setup_date_values() {
            this.dates = [];
            let cur_date = date_utils.clone(this.scheduler_start);

            while (cur_date <= this.scheduler_end) {
                this.dates.push(cur_date);
                switch (this.options.view_mode) {
                    case VIEW_MODE.YEAR:
                        cur_date = date_utils.add(cur_date, 1, 'year');
                        break;
                    case VIEW_MODE.MONTH:
                        cur_date = date_utils.add(cur_date, 1, 'month');
                        break;
                    case VIEW_MODE.WEEK:
                        cur_date = date_utils.add(cur_date, 7, 'day');
                        break;
                    case VIEW_MODE.HOUR:
                        cur_date = date_utils.add(cur_date, 1, 'hour');
                        break;
                    default:
                        cur_date = date_utils.add(cur_date, this.options.step, 'hour');
                        break;
                }
            }
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
            this.make_dates();
            this.make_bars();
            this.make_arrows();
            this.map_arrows_on_bars();
            this.set_width();
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
            this.make_grid_ticks();
            this.make_grid_highlights();
        }

        make_grid_background() {
            let grid_width;
            if (this.view_is(VIEW_MODE.WEEK) || this.view_is(VIEW_MODE.MONTH) || this.view_is(VIEW_MODE.YEAR)) {
                grid_width = (this.dates.length - 1) * this.options.column_width;
            } else
                grid_width = this.dates.length * this.options.column_width;
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

            const row_width = this.dates.length * this.options.column_width;

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
            const header_width = this.dates.length * this.options.column_width;
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
            let tick_x = 0;
            let tick_y = 0;
            let tick_height = sum_rows_height;

            for (let date of this.dates) {
                let tick_class = 'tick';
                // thick tick for monday
                if (this.view_is(VIEW_MODE.DAY) && date.getDate() === 1) {
                    tick_class += ' thick';
                }
                // thick tick for first week
                if (
                    this.view_is(VIEW_MODE.WEEK) &&
                    date.getDate() >= 1 &&
                    date.getDate() < 8
                ) {
                    tick_class += ' thick';
                }
                // thick ticks for quarters
                if (this.view_is(VIEW_MODE.MONTH) && date.getMonth() % 3 === 0) {
                    tick_class += ' thick';
                }

                createSVG('path', {
                    d: `M ${tick_x} ${tick_y} v ${tick_height}`,
                    class: tick_class,
                    append_to: this.layers.grid,
                });

                if (this.view_is(VIEW_MODE.MONTH)) {
                    tick_x +=
                        (date_utils.get_days_in_month(date) *
                            this.options.column_width) /
                        30;
                } else {
                    tick_x += this.options.column_width;
                }
            }
        }

        make_grid_highlights() {
            const today = date_utils.today();
            let x = Math.round(date_utils.diff(today, this.dates[0], 'hour') /
                this.options.step) * this.options.column_width;
            let width = this.options.column_width;

            switch (this.options.view_mode) {
                case VIEW_MODE.HOUR:
                    x = date_utils.diff(today, this.dates[0], 'minute') /
                        this.options.step * this.options.column_width;
                    if (today.getTimezoneOffset() === -60)
                        x += this.options.column_width;
                    else
                        x += (this.options.column_width * 2);
                    width *= 24;
                    break;
                case VIEW_MODE.HALF_DAY:
                    width *= 2;
                    break;
                case VIEW_MODE.QUARTER_DAY:
                    width *= 4;
                    break;
                case VIEW_MODE.WEEK:
                    const day_of_week = today.getDay(); // 0 = Domenica, 1 = Lunedì, ..., 6 = Sabato
                    const start_of_week = new Date(today);
                    start_of_week.setDate(today.getDate() - (day_of_week === 0 ? 6 : day_of_week - 1)); // Sposta indietro al lunedì
                    x = Math.round(date_utils.diff(start_of_week, this.dates[0], 'hour') /
                        this.options.step) * this.options.column_width;
                    break;
                case VIEW_MODE.MONTH:
                    const start_of_month = date_utils.start_of(today, 'month');
                    x = date_utils.diff(start_of_month, this.dates[0], 'hour') /
                        this.options.step * this.options.column_width;
                    width = (date_utils.get_days_in_month(today) *
                        this.options.column_width) /
                        30;
                    break;
                case VIEW_MODE.YEAR:
                    const start_of_year = date_utils.start_of(today, 'year');
                    const starting_year = date_utils.start_of(this.scheduler_start, 'year');
                    x = date_utils.diff(start_of_year, starting_year, 'hour') /
                        this.options.step * this.options.column_width;
                    break;
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
                append_to: this.layers.grid,
            });
        }

        make_dates() {
            let last_date_info = null;

            this.dates.map((date) => {
                const d = this.get_date_info(date, last_date_info);
                last_date_info = d;
                createSVG('text', {
                    x: d.lower_x,
                    y: d.lower_y,
                    innerHTML: d.lower_text,
                    class: 'lower-text bold',
                    append_to: this.layers.date,
                });

                if ((d.date.getDay() === 6 || d.date.getDay() === 0) &&
                    (this.options.view_mode === VIEW_MODE.DAY ||
                        this.options.view_mode === VIEW_MODE.HALF_DAY ||
                        this.options.view_mode === VIEW_MODE.QUARTER_DAY ||
                        this.options.view_mode === VIEW_MODE.HOUR)) {

                    let highlight_x;
                    const highlight_y = d.lower_y + (this.options.padding / 2);
                    let highlight_width = this.options.column_width;
                    const highlight_height = this.rows[this.rows.length - 1].y +
                        this.rows[this.rows.length - 1].height -
                        this.options.header_height -
                        (this.options.padding / 2);

                    if (this.view_is(VIEW_MODE.DAY))
                        highlight_x = d.lower_x - (this.options.column_width / 2);
                    else if (this.view_is(VIEW_MODE.HOUR))
                        if (d.date.getTimezoneOffset() === -60)
                            highlight_x = d.lower_x + this.options.column_width;
                        else
                            highlight_x = d.lower_x + (this.options.column_width * 2);
                    else
                        highlight_x = d.lower_x;

                    createSVG('rect', {
                        x: highlight_x,
                        y: highlight_y,
                        width: highlight_width,
                        height: highlight_height,
                        class: 'weekend-highlight',
                        append_to: this.layers.grid,
                    });
                }
                if (d.upper_text) {
                    createSVG('text', {
                        x: d.upper_x,
                        y: d.upper_y,
                        innerHTML: d.upper_text,
                        class: 'upper-text bold',
                        append_to: this.layers.date,
                    });
                }
                return d;
            });
        }

        get_date_info(date, last_date_info) {
            let column_width = this.options.column_width;
            let x_pos;
            let hour_pointer;
            let date_text;
            const hour = [
                '00', '01', '02', '03', '04', '05', '06', '07', '08', '09',
                '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
                '20', '21', '22', '23'
            ];
            let last_date = null;
            if (last_date_info) {
                last_date = last_date_info.date;
            } else {
                last_date = date_utils.add(date, 1, 'year');
                last_date = date_utils.add(last_date, 1, 'month');
                last_date = date_utils.add(last_date, 1, 'day');
            }
            if (this.view_is(VIEW_MODE.DAY)) {
                date_text = {
                    Day_lower:
                        date.getDate() !== last_date.getDate()
                            ? date_utils.format(date, 'D dd', this.options.language)
                            : '',
                    Day_upper:
                        date.getMonth() !== last_date.getMonth()
                            ? date_utils.format(date, 'MMM YYYY', this.options.language)
                            : '',
                };
                x_pos = {
                    Day_lower: column_width / 2,
                    Day_upper: (column_width * 30) / 2
                };
            } else if (this.view_is(VIEW_MODE.HOUR)) {
                hour_pointer = last_date_info?.hour_pointer || 0;
                date_text = {
                    Hour_lower: hour[hour_pointer],
                    Hour_upper:
                        hour_pointer === 0
                            ? date_utils.format(date, 'ddd D MMM YYYY', this.options.language)
                            : '',
                };
                hour_pointer = (hour_pointer < 23) ? hour_pointer + 1 : 0;
                x_pos = {
                    Hour_lower: 0,
                    Hour_upper: column_width * 24 / 2
                };
            } else if (this.view_is(VIEW_MODE.WEEK)) {
                date_text = {
                    Week_lower:
                        date.getMonth() !== last_date.getMonth()
                            ? date_utils.format(date, 'D MMM', this.options.language)
                            : date_utils.format(date, 'D', this.options.language),
                    Week_upper:
                        date.getMonth() !== last_date.getMonth()
                            ? date_utils.format(date, 'MMM YYYY', this.options.language)
                            : '',
                };
                x_pos = {
                    Week_lower: 0,
                    Week_upper: (column_width * 4) / 2
                };
            } else if (this.view_is(VIEW_MODE.QUARTER_DAY)) {
                hour_pointer = last_date_info?.hour_pointer || 0;
                date_text = {
                    'Quarter Day_lower': hour[hour_pointer],
                    'Quarter Day_upper':
                        hour_pointer === 0
                            ? date_utils.format(date, 'ddd D MMM YYYY', this.options.language)
                            : '',
                };
                hour_pointer = (hour_pointer < 18) ? hour_pointer + 6 : 0;
                x_pos = {
                    'Quarter Day_lower': 0,
                    'Quarter Day_upper': column_width + (column_width / 2)
                };
            } else if (this.view_is(VIEW_MODE.HALF_DAY)) {
                hour_pointer = last_date_info?.hour_pointer || 0;
                date_text = {
                    'Half Day_lower': hour[hour_pointer],
                    'Half Day_upper':
                        hour_pointer === 0
                            ? date.getMonth() !== last_date.getMonth()
                                ? date_utils.format(date, 'D dd MMM', this.options.language)
                                : date_utils.format(date, 'D dd MM YYY', this.options.language)
                            : '',
                };
                hour_pointer = (hour_pointer < 12) ? hour_pointer + 12 : 0;
                x_pos = {
                    'Half Day_lower': 0,
                    'Half Day_upper': column_width
                };
            } else if (this.view_is(VIEW_MODE.MONTH)) {
                date_text = {
                    Month_lower: date_utils.format(date, 'MMM YYYY', this.options.language),
                    Month_upper:
                        date.getFullYear() !== last_date.getFullYear()
                            ? date_utils.format(date, 'YYYY', this.options.language)
                            : '',
                };
                column_width =
                    (date_utils.get_days_in_month(date) * column_width) / 30;
                x_pos = {
                    Month_lower: column_width / 2,
                    Month_upper: (column_width * 12) / 2
                };
            } else if (this.view_is(VIEW_MODE.YEAR)) {
                date_text = {
                    Year_lower: date_utils.format(date, 'YYYY', this.options.language),
                    Year_upper:
                        date.getFullYear() !== last_date.getFullYear()
                            ? date_utils.format(date, 'YYYY', this.options.language)
                            : '',
                };
                x_pos = {
                    Year_lower: column_width / 2,
                    Year_upper: (column_width * 30) / 2
                };
            }
            const base_pos = {
                x: last_date_info
                    ? last_date_info.base_pos_x + last_date_info.column_width
                    : 0,
                lower_y: this.options.header_height,
                upper_y: this.options.header_height - 25,
            };

            return {
                date,
                column_width,
                base_pos_x: base_pos.x,
                upper_text: date_text[`${this.options.view_mode}_upper`],
                lower_text: date_text[`${this.options.view_mode}_lower`],
                upper_x: base_pos.x + x_pos[`${this.options.view_mode}_upper`],
                upper_y: base_pos.upper_y,
                lower_x: base_pos.x + x_pos[`${this.options.view_mode}_lower`],
                lower_y: base_pos.lower_y,
                hour_pointer,
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

            const hours_before_today = date_utils.diff(
                date_utils.today(),
                this.scheduler_start,
                'hour'
            );

            let scroll_pos;
            if (this.view_is('Hour'))
                scroll_pos =
                    hours_before_today *
                    this.options.column_width -
                    this.options.column_width;
            else
                scroll_pos =
                    (hours_before_today / this.options.step) *
                    this.options.column_width -
                    this.options.column_width;

            parent_element.scrollLeft = scroll_pos;
        }

        bind_grid_events() {
            const scroll = this.$svg.parentElement;
            let is_dragging = false;
            let start_x;
            let scroll_left;
            let x = 0;
            let is_resizing = false;
            let header_tick = null;

            $.on(this.$svg, 'mousedown', '.grid-header, .lower-text, .upper-text', (e) => {
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
                    });
                } else
                    data_id = e.target.getAttribute('data-id');

                const x_in_units = e.offsetX / this.options.column_width;
                let datetime;
                if (this.view_is('Hour'))
                    datetime = date_utils.add(
                        this.scheduler_start,
                        x_in_units * this.options.step,
                        'minute');
                else
                    datetime = date_utils.add(
                        this.scheduler_start,
                        x_in_units * this.options.step,
                        'hour');

                this.trigger_event('grid_dblclick', [data_id, date_utils.to_local(datetime)]);
            });

            $.on(this.$container, 'scroll', e => {
                this.$column_container.scrollTop = e.currentTarget.scrollTop;
                this.layers.date.setAttribute('transform', 'translate(0,' + e.currentTarget.scrollTop + ')');
                this.fixed_col_layers.header.setAttribute('transform', 'translate(0,' + e.currentTarget.scrollTop + ')');
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

            $.on(this.$container, 'wheel', '.grid, .bar', (e) => {
                this.hide_popup();
                e.preventDefault();

                const VIEW_MODES_ORDER = [
                    VIEW_MODE.HOUR,
                    VIEW_MODE.QUARTER_DAY,
                    VIEW_MODE.HALF_DAY,
                    VIEW_MODE.DAY,
                    VIEW_MODE.WEEK,
                    VIEW_MODE.MONTH,
                    VIEW_MODE.YEAR,
                ];

                let curr_index = VIEW_MODES_ORDER.indexOf(this.options.view_mode);
                const scroll_pos = this.$svg.parentElement.scrollLeft;
                const scroll_width = this.$svg.parentElement.scrollWidth;

                if (e.deltaY > 0 && curr_index !== VIEW_MODES_ORDER.length - 1) {
                    this.change_view_mode(VIEW_MODES_ORDER[curr_index + 1]);
                } else if (e.deltaY < 0 && curr_index > 0) {
                    this.change_view_mode(VIEW_MODES_ORDER[curr_index - 1]);
                }

                this.$svg.parentElement.scrollLeft = scroll_pos * (this.$svg.parentElement.scrollWidth / scroll_width);
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
                e.offsetY - y_on_start;

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
            const ticks = Array.from(this.$svg.querySelectorAll('g.grid > path'));
            ticks.forEach(tick => {
                const curr_d = tick.getAttribute('d');
                const new_d = curr_d.replace(/v\s*[^v]*$/, `v ${max_height}`);

                $.attr(tick, 'd', new_d);
            });
            //highlight
            if (this.view_is(VIEW_MODE.DAY)) {
                const today_highlight = this.$svg.getElementsByClassName('today-highlight');
                $.attr(today_highlight[0], 'height', max_height);
                const weekend_highlight = Array.from(this.$svg.getElementsByClassName('weekend-highlight'));
                weekend_highlight.forEach(weekend => {
                    $.attr(weekend, 'height', max_height);
                });
            }
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

        get_snap_x_position(dx) {
            let odx = dx,
                rem,
                position,
                divider;

            switch (this.options.view_mode) {
                case VIEW_MODE.MONTH:
                    divider = 30;
                    break;
                case VIEW_MODE.WEEK:
                    divider = 7;
                    break;
                case VIEW_MODE.DAY:
                    divider = 24;
                    break;
                case VIEW_MODE.HALF_DAY:
                    divider = 12;
                    break;
                case VIEW_MODE.QUARTER_DAY:
                    divider = 6;
                    break;
                case VIEW_MODE.HOUR:
                    divider = 60;
                    break;
                default:
                    divider = 1;
                    break;
            }
            rem = dx % (this.options.column_width / divider);
            position =
                odx -
                rem +
                (rem < this.options.column_width / (2 * divider)
                    ? 0
                    : this.options.column_width / divider);
            return position;
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

    return Scheduler;

})();
//# sourceMappingURL=horsa-scheduler.js.map
