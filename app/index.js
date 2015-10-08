/* jshint node:true */
'use strict';

var _iotLib = require('iot-client-lib');

var _config = require('./config');
var _loggerProvider = require('./logger');
var _logger = _loggerProvider.getLogger('app');

_logger.info('Ready to go');
var controller = new _iotLib.Controller({
    moduleBasePath: GLOBAL.config.cfg_module_base_path
}, _loggerProvider);

controller.init('./config.json').then(function() {
    _logger.info('Configuration successfully loaded');
}, function(err) {
    _logger.error('Error loading configuration: ', err);
    controller.stop().fin(function(err) {
        if(err) {
            _logger.error('Error stopping program: %s', err);
        }
        _logger.info('Program stopped');
    });
}).done();
