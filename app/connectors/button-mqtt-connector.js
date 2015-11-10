/* jshint node:true */
'use strict';

var _util = require('util');
var MqttConnector = require('./mqtt-connector');

/**
 * Connector that uses MQTT to communicate with sensors connected to a
 * common MQTT broker.
 *
 * @class ButtonMqttConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function ButtonMqttConnector(id) {
    ButtonMqttConnector.super_.call(this, id)
}

_util.inherits(ButtonMqttConnector, MqttConnector);


/**
 * @class ButtonMqttConnector
 * @method _parsePayload
 * @private
 */
ButtonMqttConnector.prototype._parsePayload = function(message) {
    if(typeof message === 'undefined' || message === null) {
        return 0;
    }
    var payload = parseInt(message);
    if(isNaN(payload)) {
        payload = -1;
    }

    return payload;
};

module.exports = ButtonMqttConnector;
