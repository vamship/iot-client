/* jshint node:true */
'use strict';

var _util = require('util');
var PollingConnector = require('iot-client-lib').PollingConnector;

/**
 * Connector that interfaces with a vacuum pump over SPI, and
 * extract data intended for the cloud.
 *
 * @class VacuumPumpConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function VacuumPumpConnector(id) {
    VacuumPumpConnector.super_.call(this, id)
}

_util.inherits(VacuumPumpConnector, PollingConnector);

/**
 * @class VacuumPumpConnector
 * @method _process
 * @protected
 */
VacuumPumpConnector.prototype._process = function() {
    this.emit('data', {
        id: this._id,
        data: {
            temperature: Math.random() * 10,
            humidity: Math.random() * 14,
            pressure: Math.random() * 10
        }
    });
};

module.exports = VacuumPumpConnector;
