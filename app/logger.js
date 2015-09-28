/* jshint node:true */
'use strict';

var _winston = require('winston');
var _path = require('path');

var _fileTransport = new _winston.transports.DailyRotateFile({
    level: 'debug',
    filename: _path.join(GLOBAL.config.cfg_logs_dir, 'app'),
    datePattern: '.yyyy-MM-dd.log'
});

module.exports = {
    /**
     * Returns a pre configured logger of the specified name.
     *
     * @module logger
     * @method getLogger
     * @return {Object} A pre configured logger object.
     */
    getLogger: function(loggerName, label) {
        if(typeof loggerName !== 'string' || loggerName.length <=0) {
            throw new Error('Invalid logger name specified (arg #1)');
        }
        var label = label || loggerName;
        var logger =  _winston.loggers.get(loggerName, {
            transports: [
                new _winston.transports.Console({
                    level: 'silly',
                    colorize: 'true',
                    label: label
                }),
                _fileTransport
            ],
        });

        logger.addRewriter(function(level, msg, meta) {
            meta.__label = label;
            return meta;
        });

        logger.cli();
        return logger;
    }
};
