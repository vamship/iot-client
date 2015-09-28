/* jshint node:true */
'use strict';

var _path = require('path');

GLOBAL.config = {};
GLOBAL.config.cfg_logs_dir = _path.join(__dirname, '../log');
GLOBAL.config.cfg_module_base_path = __dirname;

module.exports = {
};
