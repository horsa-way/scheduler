
<div align="center">
    <img src="https://github.com/horsa-way/scheduler/assets/11760847/a961ea22-d3c6-49e3-8c5f-357d64dacc2d" height="128">
    <h2>Horsa Scheduler</h2>
    <p align="center">
        <p>A lightweight and interactive svg scheduler library for web applications</p>
        <!-- <a>
            <b>View the demo »</b>
        </a> -->
    </p>
</div>

<p align="center">
    <img src="https://github.com/horsa-way/scheduler/assets/11760847/8c8ac467-6549-4112-950f-95500d377d43">
</p>

### Install
Download from [GitHub releases](https://github.com/horsa-way/scheduler/releases/latest)

and include it in your HTML:
```
<script src="horsa-scheduler.min.js"></script>
<link rel="stylesheet" href="horsa-scheduler.min.css">
```

### Usage
Look the HTML [index file](https://github.com/horsa-way/scheduler/blob/master/index.html) for a complete example.

```js
var tasks = [
  {
    id: 'Task 1',
    name: 'Redesign website',
    start: '2016-12-28',
    end: '2016-12-31',
    progress: 20,
    dependencies: 'Task 2, Task 3',
    row: 'row_id_1', // row where put the task
    custom_class: 'bar-milestone' // optional
  },
  ...
]
var scheduler = new Scheduler("#scheduler", tasks);
```

You can also pass various options to the Scheduler constructor:
```js
var cells = [
    {
        row: 'row_id_1',
        column: 'name',
        value: 'name cell 1'
    },
    {
        row: 'row_id_1',
        column: 'description',
        value: 'description cell 1'
    },
]
var scheduler = new Scheduler("#scheduler", tasks, cells, {
    header_height: 50,
    column_width: 30,
    step: 24,
    view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
    bar_height: 20,
    bar_corner_radius: 3,
    arrow_curve: 5,
    padding: 18,
    view_mode: 'Day',
    date_format: 'YYYY-MM-DD',
    language: 'en', // or 'es', 'it', 'ru', 'ptBr', 'fr', 'tr', 'zh', 'de', 'hu'
    custom_popup_html: null,
    resize_left: true,
    resize_right: true,
    drag_drop_x: true,
    drag_drop_y: true,
    popup_position: ['left', 'bottom']
    date_start: 'YYYY-MM-DD',
    date_end: 'YYYY-MM-DD',
    rows: ['row_id_1', 'row_id_2', 'row_id_3'],
    fixed_columns: ['name', 'description'],
    on_task_dblclick: task => {
        console.log(task);
    },
    on_grid_dblclick: row_id => {
        console.log(row_id);
    },
    on_cell_dblclick: (row_id, col_id) => {
        console.log(row_id, col_id);
    },
    on_position_change: (task, row, start, end) => {
        console.log(task, row, start, end);
    },
    on_progress_change: (task, progress) => {
        console.log(task, progress);
    },
    on_view_change: (mode) => {
        console.log(mode);
    },
});
```

### Structure 
The Scheduler class is designed to manage and organize tasks within a given wrapper element. It provides functionalities to set up and manage tasks, cells, and rows,, all of which are rendered as SVG elements. The appearance and layout of these elements are controlled via CSS. Below is a brief overview of the key methods and operations performed during the initialization of the Scheduler class.

Constructor: constructor(wrapper, tasks, cells, options)
The constructor initializes a new instance of the Scheduler class and takes the following parameters:
```js
export default class Scheduler {
    constructor(wrapper, tasks, cells, options) {
        this.setup_options(options);
        this.setup_wrapper(wrapper);
        this.setup_cells(cells);
        this.setup_tasks(tasks);
        this.setup_rows();
        this.change_view_mode();
        this.bind_events();
    }
}
```
wrapper: The container element where the scheduler will be rendered.
tasks: An array representing the tasks to be managed and displayed by the scheduler.
cells: This are the cells for the left columns.
options: Configuration options to customize the behavior and appearance of the scheduler.

#### Methods Called in Constructor
setup_options(options):
This method processes and applies the configuration options passed to the scheduler. It sets default values if no specific options are provided.

setup_wrapper(wrapper):
Initializes the wrapper element where the scheduler will be displayed.

setup_cells(cells):
Configures the single cell.

setup_tasks(tasks):
Prepares and organizes the tasks to be managed by the scheduler.

setup_rows():
Configures the rows.

change_view_mode():
Initializes the scheduler with a default view mode (e.g., by day, week, month).

bind_events():
Binds necessary event listeners to the scheduler, allowing interaction and dynamic updates (e.g., task dragging, resizing, etc.).

### Contributing
If you want to contribute enhancements or fixes:

1. Clone this repo.
2. `cd` into project directory
3. Install Yarn by typing `npm install --global yarn` in your terminal
4. `yarn`
5. `yarn start`
6. Open `index.html` in your browser, make your code changes and test them.

### Publishing
Every times a new version is pushed, Github Actions will create a release on github releases.

License: MIT

------------------
Project maintained by [horsa way](https://github.com/horsa-way)
