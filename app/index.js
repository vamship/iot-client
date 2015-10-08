/* jshint node:true */
'use strict';

var _iotLib = require('iot-client-lib');
var _args = require('./arg-parser').args;
var _loggerProvider = require('./logger-provider');

var logger = _loggerProvider.getLogger('app');

logger.debug('Application ready to launch.');
logger.debug('Application configuration: ', GLOBAL.config);

logger.debug('Creating controller');
var controller = new _iotLib.Controller({
    moduleBasePath: GLOBAL.config.cfg_module_base_dir
}, _loggerProvider);

logger.info('Initializing connectors');
controller.init(GLOBAL.config.cfg_node_config_path).then(function() {
    logger.info('Connectors successfully initialized');
}, function(err) {
    logger.error('Error initializing connectors: ', err);
    controller.stop().fin(function(err) {
        if(err) {
            logger.error('Error stopping program: ', err);
        }
        logger.info('Program stopped');
    });
}).done();
