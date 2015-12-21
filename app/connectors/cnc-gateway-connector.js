/* jshint node:true */
'use strict';

var _util = require('util');
var _q = require('q');
var _serialport = require('serialport');
var SerialPort = _serialport.SerialPort;
//SerialPort = require('../../test/mock-serial-port');
var Connector = require('iot-client-lib').Connector;
var EbaraPumpParser = require('./io/ebara-pump-parser');

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
}

_util.inherits(CncGatewayConnector, Connector);

/**
 * @class CncGatewayConnector
 * @method _start
 * @protected
 */
CncGatewayConnector.prototype._start = function() {
    this._logger.info('Initializing connector');

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
    console.log(data);
};

module.exports = CncGatewayConnector;
