/* jshint node:true */
'use strict';

var SEPARATOR = (new Array(81)).join('=');

/**
 * Helper module with useful routines for logging.
 *
 * @class LogHelper
 * @constructor
 * @param {Object} logger Reference to a logger object that can be used
 *          for logging on behalf of the calling module.
 */
function LogHelper(logger) {
    if(!logger || typeof logger !== 'object') {
        throw new Error('Invalid logger specified (arg #1)');
    }
    this._logger = logger;
};


/**
 * Iterates over an object and logs the object as key/value pairs.
 *
 * @class LogHelper
 * @method logObject
 * @param {Object} obj The object to log. This method will do nothing
 *          if a valid object is not specified.
 * @param {String} [methodName=info] The logging method name to use for 
 *          logging. If omitted, or an invalid value is provided, the
 *          parameter will default to "info".
 * @param {Boolean} [showSeparators=true] If set to true, will log
 *          separator lines around the object key value pairs.
 */
LogHelper.prototype.logObject = function(obj, level, showSeparators) {
    if(!obj || !typeof obj === 'object') {
        return;
    };

    showSeparators = !!showSeparators;

    var method = this._logger[level];
    if(!method) {
        method = this._logger.info;
    }
    method = method.bind(this);

    if(showSeparators) {
        this._logger.silly(SEPARATOR);
    }
    for(var key in obj) {
        method('[%s] = [%s]', key, obj[key]);
    }
    if(showSeparators) {
        this._logger.silly(SEPARATOR);
    }
};

module.exports = LogHelper;
