/* jshint node:true */
'use strict';

var _util = require('util');
var _q = require('q');
var _package = require('../../package.json');

var Connector = require('iot-client-lib').Connector;
var CommandExecutor = require('../utils/command-executor');
var Pm2Helper = require('../utils/pm2-helper');
var StartupHelper = require('../utils/startup-helper');

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
    this._startupHelper = null;
    this._mockRequest = this._createMockRequest();
    this._pm2Helper = null;
}

_util.inherits(CncGatewayConnector, Connector);

/**
 * @class CncGatewayConnector
 * @method _createMockRequest
 * @private
 */
CncGatewayConnector.prototype._createMockRequest = function() {
    var request = {
        id: 'na'
    };
    [ 'logInfo',
        'logWarn',
        'logError',
        'acknowledge',
        'completeOk',
        'completeError' ].forEach(function(methodName) {

        request[methodName] = function(message, requestId) {
        }.bind(this);
    }.bind(this));

    return request;
};

/**
 * @class CncGatewayConnector
 * @method _start
 * @protected
 */
CncGatewayConnector.prototype._start = function() {
    this._logger.info('Initializing connector');

    // TODO: Review if this is the correct place to do the
    // initialization.
    if(!this._commandExecutor) {
        this._commandExecutor = new CommandExecutor(this._logger);
        this._startupHelper = new StartupHelper(this._logger);
        this._pm2Helper = new Pm2Helper(this._logger);
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
 * @param {String} [request] An optional request that represents the request
 *                  from the cloud.
 */
CncGatewayConnector.prototype.addData = function(data, request) {
    request = request || this._mockRequest;
    var message = '';
    if(!data || typeof data !== 'object') {
        message = _util.format('Invalid data payload received: [%s]', data);
        this._logger.error(message);
        request.completeError(message);
        return;
    }
    if(typeof data.command !== 'string') {
        message = _util.format('Data does not define a valid command: [%s]', data.command);
        this._logger.error(message);
        request.completeError(message);
        return;
    }

    var command = data.command.toLowerCase();
    this._logger.debug('Processing command from cloud: [%s]', data.command);
    switch(command) {
        case 'enable_local_network':
            this._commandExecutor.enableHostAP(request.id)
                .then(this._commandExecutor.enableDhcp.bind(this._commandExecutor, request.id))
                .then(function() {
                    request.logInfo('Local wifi network enabled on boot');
                    request.completeOk();
                }, function(err) {
                    request.completeError('Error enabling local wifi network on boot: [%s]', err);
                });
            break;
        case 'disable_local_network':
            this._commandExecutor.disableHostAP(request.id)
                .then(this._commandExecutor.disableDhcp.bind(this._commandExecutor, request.id))
                .then(function() {
                    request.logInfo('Local wifi network disabled on boot');
                    request.completeOk();
                }, function(err) {
                    request.completeError('Error disabling local wifi network on boot: [%s]', err);
                });
            break;
        case 'system_info':
            request.completeOk({
                name: _package.name,
                version: _package.version
            });
            break;
        case 'reset_agent':
            this._commandExecutor.disableHostAP(request.id)
                .then(this._commandExecutor.disableDhcp.bind(this._commandExecutor, request.id))
                .then(this._startupHelper.setStartupAction.bind(this._startupHelper, StartupHelper.PROVISION_MODE, request.id))
                .then(function() {
                    request.logInfo('Gateway will start in provisioning mode on boot');
                    request.completeOk();
                }, function(err) {
                    request.completeError('Error enabling provisioning mode on boot: [%s]', err);
                });
            break;
        case 'start_mqtt':
            this._pm2Helper.startMqtt(requestId).then(function() {
                request.logInfo('Local MQTT broker started');
            }.bind(this), function(err) {
                request.logInfo('Error starting local MQTT broker: [%s]', err);
            }.bind(this));
            break;
        case 'stop_mqtt':
            this._pm2Helper.stopMqtt(requestId).then(function() {
                request.logInfo('Local MQTT broker stopped');
            }.bind(this), function(err) {
                request.logInfo('Error stopping local MQTT broker: [%s]', err);
            }.bind(this));
            break;
        default:
            request.completeError('Unrecognized command: [%s]', data.command);
            break;
    }
};

module.exports = CncGatewayConnector;
