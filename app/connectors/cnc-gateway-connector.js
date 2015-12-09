/* jshint node:true */
'use strict';

var _util = require('util');
var _q = require('q');
var _serialport = require('serialport');
var SerialPort = _serialport.SerialPort;
//SerialPort = require('../../test/mock-serial-port');
var Connector = require('iot-client-lib').Connector;
var EbaraPumpParser = require('./io/ebara-pump-parser');

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

module.exports = CncGatewayConnector;
