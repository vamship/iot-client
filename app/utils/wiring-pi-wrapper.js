/* jshint node:true */
'use strict';

var _loggerProvider = require('../logger-provider');
var logger = _loggerProvider.getLogger('utils::wiring-pi-wrapper');

/**
 * Wrapper for the wiring pi module. Returns a mock object if wiring pi is
 * not available for the current platform, or if a mock is requested via
 * command line arguments.
 */
if(GLOBAL.config.cfg_mock_wiring_pi) {
    logger.warn('Using mock wiring pi');
    module.exports = {
        INPUT: 0,
        OUTPUT: 1,
        wiringPiSetup: function() {
            logger.debug('mock: wiringPiSetup()');
        },
        digitalWrite: function(pin, value) {
            logger.debug('mock: digitalWrite(%s, %s)', pin, value);
        },
        pinMode: function(pin, value) {
            logger.debug('mock: pinMode(%s, %s)', pin, value);
        }
    };
} else {
    logger.info('Using regular wiring pi library');
    module.exports = require('wiring-pi');
}
