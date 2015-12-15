/* jshint node:true */
'use strict';

var _winston = require('winston');
var _winstonDailyRotateFile = require('winston-daily-rotate-file');
var _path = require('path');

function _buildTransports(label) {
    var transports = [];

    //Optionally add the console transport
    if(!GLOBAL.config.cfg_no_log_console) {
        transports.push(new _winston.transports.Console({
            level: GLOBAL.config.cfg_log_level,
            colorize: true,
            prettyPrint: true,
            stringify: true,
            label: label
        }));
    }

    //Optionally add the file transport
    if(!GLOBAL.config.cfg_no_log_file) {
        transports.push(new _winstonDailyRotateFile({
            level: GLOBAL.config.cfg_log_level,
            filename: _path.join(GLOBAL.config.cfg_logs_dir, 'app'),
            datePattern: '.yyyy-MM-dd.log',
            label: label
        }));
    }

    return transports;
}

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
            transports: _buildTransports(label)
        });

        return logger;
    }
};
