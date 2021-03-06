/* jshint node:true */
'use strict';

var _fs = require('fs');
var _util = require('util');
var _path = require('path');
var _q = require('q');
var _touch = require('touch');

/**
 * Helper object for actions that need to be taken on program startup.
 *
 * @class StartupHelper
 * @constructor
 * @param {Object} logger Reference to a logger object that can be used
 *          for logging on behalf of the calling module.
 */
function StartupHelper(logger) {
    if(!logger || typeof logger !== 'object') {
        throw new Error('Invalid logger specified (arg #1)');
    }
    this._logger = logger;
    this._startupFilePath = GLOBAL.config.cfg_startup_file;
    this._restartMonitorFile = GLOBAL.config.cfg_restart_monitor_file;
};

/**
 * Defines a startup action that indicates that no special actions need
 * to be taken on startup.
 *
 * @class StartupHelper
 * @property NO_ACTION
 * @type {String}
 * @static
 * @readonly
 */
StartupHelper.NO_ACTION = 'startup_no_action';

/**
 * Defines a startup action that indicates that this is a mock startup,
 * and that the agent should be terminate without really changing anything.
 *
 * @class StartupHelper
 * @property MOCK_STARTUP
 * @type {String}
 * @static
 * @readonly
 */
StartupHelper.MOCK_STARTUP = 'startup_mock_startup';

/**
 * Defines a startup action that places the agent in provisioning mode.
 *
 * @class StartupHelper
 * @property PROVISION_MODE
 * @type {String}
 * @static
 * @readonly
 */
StartupHelper.PROVISION_MODE = 'startup_provision_mode';

/**
 * Reads startup actions from the startup file, and returns the contents
 * of the file.
 *
 * @class StartupHelper
 * @method getStartupAction
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the read operation.
 */
StartupHelper.prototype.getStartupAction = function() {
    var def = _q.defer();
    var message = '';

    this._logger.debug('Reading startup file: [%s]', this._startupFilePath);
    _fs.readFile(this._startupFilePath, function(err, data) {
        if(err) {
            message = _util.format('Error reading startup file: [%s]', this._startupFilePath);
            this._logger.warn(message, err);
            return def.reject(message);
        }
        try {
            this._logger.info('Parsing contents of startup file');
            data = JSON.parse(data);
        } catch (ex) {
            message = _util.format('Error parsing startup action: [%s]', ex.toString());
            this._logger.warn(message);
            return def.reject(message);
        }

        def.resolve(data);
    }.bind(this));

    return def.promise;
};

/**
 * Sets a specific startup action that will be processed when the agent
 * is restarted.
 *
 * @class StartupHelper
 * @method setStartupAction
 * @param {String} action The action to write
 * @param {String} [requestId] An optional request id
 * @param {String} [message] An optional message to record with the action
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the write operation.
 */
StartupHelper.prototype.setStartupAction = function(action, requestId, message) {
    var payload = {
        action: action,
        requestId: requestId || 'na',
        message: message || '',
        timestamp: Date.now()
    };
    payload = JSON.stringify(payload);

    var def = _q.defer();

    this._logger.debug('Writing startup action to file: [%s] [%s]', payload, this._startupFilePath);
    _fs.writeFile(this._startupFilePath, payload, function(err, data) {
        if(err) {
            this._logger.warn('Error writing startup file: [%s]', this._startupFilePath, err);
            return def.reject('Error writing startup file: ' + err.toString());
        }
        this._logger.info('Startup file successfully updated');
        def.resolve('Startup file successfully updated');
    }.bind(this));

    return def.promise;
};

/**
 * Touches a file that is watched by an external process, triggering restart.
 * This method can optionally executed as a synchronous operation that will 
 * block until completed.
 *
 * @class StartupHelper
 * @method touchRestartMonitor
 * @param {Boolean} [isAsync=false] Runs method asynchronously when set to true.
 */
StartupHelper.prototype.touchRestartMonitor = function(isAsync) {
    isAsync = !!isAsync;
    var def = _q.defer();
    if(isAsync) {
        this._logger.info('Touching restart monitor asynchronously: [%s]', this._restartMonitorFile);
        _touch(this._restartMonitorFile, { force: true }, function(err) {
            if(err) {
                this._logger.error('Error touching restart monitor: ', err);
                def.reject(err);
            }
            this._logger.info('Restart monitor file touched (async): [%s]', this._restartMonitorFile);
            def.resolve();
        }.bind(this));
    } else {
        this._logger.info('Touching restart monitor synchronously: [%s]', this._restartMonitorFile);
        try {
            _touch.sync(this._restartMonitorFile, { force: true });
            this._logger.info('Restart monitor file touched (sync): [%s]', this._restartMonitorFile);
            def.resolve();
        } catch(ex) {
            this._logger.error('Error touching restart monitor: ', ex);
            def.reject(err);
        }
    }
    return def.promise;
};

module.exports = StartupHelper;
