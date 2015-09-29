/* jshint node:true */
'use strict';

var _iotLib = require('iot-client-lib');

var _config = require('./config');
var _logger = require('./logger').getLogger('app');

_logger.info('Ready to go');
var controller = new _iotLib.Controller({
    moduleBasePath: GLOBAL.config.cfg_module_base_path
});

controller.init('./config.json').then(function() {
    _logger.info('Configuration successfully loaded');
}, function(err) {
    _logger.error('Error loading configuration: ', err);
});
