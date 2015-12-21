/* jshint node:true */
'use strict';

var _util = require('util');
var _q = require('q');
var Connector = require('iot-client-lib').Connector;
var CommandExecutor = require('../utils/startup-helper');

var DEFAULT_REQUEST_ID = 'na';

/**
 * Connector that performs specific cnc actions on the gateway, based on
 * commands from the cloud.
 *
 * @class CncGatewayConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function CncGatewayConnector(id) {
    CncGatewayConnector.super_.call(this, id)
    this._commandExecutor = null;
    this._cloudLogger = this._createCloudLogger();
}

_util.inherits(CncGatewayConnector, Connector);

/**
 * @class CncGatewayConnector
 * @method _createCloudLogger
 * @private
 */
CncGatewayConnector.prototype._createCloudLogger = function() {
    var logger = {};
    [ 'info', 'warn', 'error' ].forEach(function(methodName) {
        logger[methodName] = function(message, requestId) {
            if(message instanceof Array) {
                message = _util.format.apply(_util, message);
            }
            var payload = {
                requestId: requestId || 'na',
                qos: (methodName === 'info')? 0:1,
                message: '[' + methodName + '] [' + requestId + '] ' + message.toString()
            }
            this.emit(CncGatewayConnector.super_.LOG_EVENT, payload);
        }.bind(this);
    }.bind(this));

    return logger;
};


/**
 * @class CncGatewayConnector
 * @method _start
 * @protected
 */
CncGatewayConnector.prototype._start = function() {
    this._logger.info('Initializing connector');

    // TODO: Review this is the correct place to do the
    // initialization.
    if(!this._commandExecutor) {
        this._commandExecutor = new CommandExecutor(this._logger);
    }
    var def = _q.defer();
    def.resolve();

    return def.promise;
};

/**
 * @class CncGatewayConnector
 * @method _stop
 * @protected
 */
CncGatewayConnector.prototype._stop = function() {
    this._logger.info('Stopping connector');
    var def = _q.defer();
    def.resolve();

    return def.promise;
};

/**
 * @class CncGatewayConnector
 * @method addLogData
 * @public
 */
CncGatewayConnector.prototype.addLogData = function(data) {
};

/**
 * Handles data payloads from the cloud and takes necessary actions based
 * on the data.
 *
 * @class CncGatewayConnector
 * @method addData
 * @param {Object} data The data obtained from the cloud
 * @param {String} [requestId] An optional request id that can be used for logging.
 */
CncGatewayConnector.prototype.addData = function(data, requestId) {
    requestId = requestId || DEFAULT_REQUEST_ID;
    var message = '';
    if(typeof data !== 'string' || data.length <= 0) {
        message = _util.format('Invalid data payload received: [%s]', data);
        this._logger.error(message);
        this._cloudLogger.error(message, requestId);
        return;
    }
    try {
        data = JSON.parse(data);
    } catch(ex) {
        message = _util.format('Error parsing data payload', ex);
        this._logger.error(message);
        this._cloudLogger.error(message, requestId);
        return;
    }
    if(typeof data.command !== 'string') {
        message = _util.format('Data does not define a valid command: [%s]', data.command);
        this._logger.error(message);
        this._cloudLogger.error(message, requestId);
        return;
    }

    var command = data.command.toLowerCase();
    this._logger.debug('Processing command from cloud: [%s]', data.command);
    switch(command) {
        case 'reboot':
            this._commandExecutor.reboot(requestId).then(function(){
                this._cloudLogger.info([ 'Reboot scheduled' ], requestId);
            }.bind(this), function(err) {
                this._cloudLogger.info([ 'Error scheduling reboot: [%s]', err ], requestId);
            }.bind(this));
            break;
        case 'disable_local_network':
            this._commandExecutor.enableHostAP(requestId).then(function(){
                this._cloudLogger.info([ 'Local AP daemon enabled on startup' ], requestId);
            }.bind(this), function(err) {
                this._cloudLogger.info([ 'Error enabling local AP daemon on startup: [%s]', err ], requestId);
            }.bind(this));
            this._commandExecutor.enableDhcp(requestId).then(function(){
                this._cloudLogger.info([ 'Local DHCP daemon enabled on startup' ], requestId);
            }.bind(this), function(err) {
                this._cloudLogger.info([ 'Error enabling local DHCP daemon on startup: [%s]', err ], requestId);
            }.bind(this));
            break;
        default:
            this._logger.warn('Unrecognized command: [%s]', data.command);
            this._cloudLogger.warn([ 'Unrecognized command: [%s]', data.command ], requestId);
            break;
    }
};

module.exports = CncGatewayConnector;
