/* jshint node:true */
'use strict';

var _path = require('path');
var _pm2 = require('pm2');
var _util = require('util');
var _q = require('q');

/**
 * Helper object that can be used to start, stop or manage PM2 apps.
 *
 * @class Pm2Helper
 * @constructor
 * @param {Object} logger Reference to a logger object that can be used
 *          for logging on behalf of the calling module.
 */
function Pm2Helper(logger) {
    if(!logger || typeof logger !== 'object') {
        throw new Error('Invalid logger specified (arg #1)');
    }
    this._logger = logger;
};

/**
 * @class Pm2Helper
 * @method _connectToPm2
 * @protected
 */
Pm2Helper.prototype._connectToPm2 = function() {
    var def = _q.defer();
    this._logger.info('Connecting to PM2 daemon');
    _pm2.connect(function(err) {
        if(err) {
            var message = _util.format('Error connecting to PM2 daemon: [%s]', err);
            this._logger.error(message);
            def.reject(err);
            return;
        }
        this._logger.info('Successfully connected to PM2 daemon');
        def.resolve();
    }.bind(this));

    return def.promise;
};

/**
 * @class Pm2Helper
 * @method _startPm2App
 * @protected
 */
Pm2Helper.prototype._startPm2App = function(script) {
    var def = _q.defer();
    this._logger.info('Starting PM2 app: [%s]' script);
    _pm2.start(script, {}, function(err) {
        if(err) {
            var message = _util.format('Error starting PM2 app [%s]: [%s]', script, err);
            this._logger.error(message);
            def.reject(message);
            return;
        }
        this._logger.info('Successfully started PM2 app: [%s]', script);
        def.resolve();
    }.bind(this));

    return def.promise;
};

/**
 * @class Pm2Helper
 * @method _stopPm2App
 * @protected
 */
Pm2Helper.prototype._stopPm2App = function(appName) {
    var def = _q.defer();
    this._logger.info('Stopping PM2 app: [%s]', appName);
    _pm2.stop(appName, {}, function(err) {
        if(err) {
            var message = _util.format('Error stopping PM2 app [%s]: [%s]', appName, err);
            this._logger.error(message);
            def.reject(message);
            return;
        }
        this._logger.info('Successfully stopped PM2 app: [%s]', appName);
        def.resolve();
    }.bind(this));

    return def.promise;
};

/**
 * @class Pm2Helper
 * @method _savePm2State
 * @protected
 */
Pm2Helper.prototype._savePm2State = function() {
    var def = _q.defer();
    this._logger.info('Saving PM2 state');
    _pm2.stop(appName, {}, function(err) {
        if(err) {
            var message = _util.format('Error saving PM2 state: [%s]', err);
            this._logger.error(message);
            def.reject(message);
            return;
        }
        this._logger.info('Successfully saved PM2 state');
        def.resolve();
    }.bind(this));

    return def.promise;
};

/**
 * Stops the PM2 process for the MQTT server.
 *
 * @class Pm2Helper
 * @method stopMqtt
 * @param {String} [requestId] An optional request id
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the operation.
 */
Pm2Helper.prototype.stopMqtt = function(requestId) {
    this._logger.info('Stopping local MQTT broker. RequestId: [%s]', requestId);

    return this._connectToPm2()
            .then(this._stopPm2App.bind(this, 'mosca'))
            .then(this._savePm2State.bind(this))
            .then(function() {
                this._logger.info('Local MQTT broker successfully stopped. RequestId: [%s]', requestId);
            }.bind(this), function(err) {
                this._logger.error('Error stopping local MQTT broker. RequestId: [%s]', requestId, err);
                throw err;
            }).fin(function() {
                _pm2.disconnect();
            });
};

/**
 * Stops the PM2 process for the MQTT server.
 *
 * @class Pm2Helper
 * @method startMqtt
 * @param {String} [requestId] An optional request id
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the operation.
 */
Pm2Helper.prototype.startMqtt = function(requestId) {
    this._logger.info('Starting local MQTT broker. RequestId: [%s]', requestId);

    var scriptName = _path.resolve(GLOBAL.config.cfg_program_root, 'pm2/mosca.json');

    return this._connectToPm2()
            .then(this._startPm2App.bind(this, scriptName))
            .then(this._savePm2State.bind(this))
            .then(function() {
                this._logger.info('Local MQTT broker successfully started. RequestId: [%s]', requestId);
            }.bind(this), function(err) {
                this._logger.error('Error starting local MQTT broker. RequestId: [%s]', requestId, err);
                throw err;
            }).fin(function() {
                _pm2.disconnect();
            });
};

module.exports =  Pm2Helper;
