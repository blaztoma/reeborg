/* Path utilities useful for world creators */

require("./../rur.js");

/** @function print_path
 * @memberof RUR
 * @instance
 * @summary This function prints the path followed by the default robot, where
 * the values ['x', 'y'] are used to draw the trace on the screen. Values are
 * only appended to the path when they change; thus, turns and other actions
 * performed at a given location are ignored.
 *
 *
 */

RUR.print_path = function () {
    "use strict";
    var history, i, path, world, prev_x, prev_y, x, y;

    world = RUR.get_current_world();
    if (world.robots === undefined || world.robots.length === 0) {
        throw new RUR.ReeborgError("Missing robot; cannot print path.");
    }
    history = world.robots[0]._trace_history;
    path = [];
    prev_x = prev_y = -1;
    for (i=0; i < history.length; i++) {
        x = history[i]['grid_x'];
        y = history[i]['grid_y'];
        if (x != prev_x || y != prev_y) {
            path.push([x, y]);
            prev_x = x;
            prev_y = y;
        }
    }
    RUR._write_ln(path);
};

/** @function check_path
 * @memberof RUR
 * @instance
 * @summary This function compares the path followed by the default robot
 * with that which was desired.
 *
 * @param {list} path A desired path, as printed by RUR.print_path.
 *
 * @returns {bool} True if the correct path was followed.
 *
 */

RUR.check_path = function (path) {
    "use strict";
    var history, i, world, desired_x, desired_y, prev_x, prev_y, x, y;

    world = RUR.get_current_world();
    if (world.robots === undefined || world.robots.length === 0) {
        throw new RUR.ReeborgError("Missing robot; cannot print path.");
    }
    history = world.robots[0]._trace_history;
    prev_x = prev_y = -1;
    for (i=0, j=0; i < history.length; i++) {
        x = history[i]['grid_x'];
        y = history[i]['grid_y'];
        if (x != prev_x || y != prev_y) {
            if (j> path.length) {
                return false;
            }
            desired_x = path[j][0];
            desired_y = path[j][1];
            prev_x = x;
            prev_y = y;
            if (x != desired_x || y != desired_y) {
                return false;
            }
            j++;
        }
    }
    if (path.length > j) {
        return false;
    }
    return true;
};