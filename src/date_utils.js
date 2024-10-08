const YEAR = 'year';
const MONTH = 'month';
const DAY = 'day';
const HOUR = 'hour';
const MINUTE = 'minute';
const SECOND = 'second';
const MILLISECOND = 'millisecond';

export default {
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
