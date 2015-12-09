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
 * @method _processBrokerMessage
 * @private
 */
ButtonMqttConnector.prototype._processBrokerMessage = function(topic, message) {
    if(typeof topic !== 'string' || topic.length <= 0) {
        this._logger.warn('Invalid topic specified: [%s]', topic);
    }

    var tokens = topic.split('/');
    if(tokens.length < 2) {
        this._logger.warn('Message topic did not have sufficient tokens: [%s]', topic);
        return;
    }
    var thingName = tokens[tokens.length - 2];
    var sensorName = tokens[tokens.length - 1];

    if(thingName.length <= 0 || sensorName.length <= 0) {
        this._logger.warn('Message topic did not have a valid thing name or sensor name: [%s]', topic);
        return;
    }

    var data = {
        timestamp: Date.now()
    };
    var payload = parseInt(message);
    if(isNaN(payload)) {
        payload = -1;
    }
    data[sensorName] = payload;

    this.emit('data', {
        id: thingName,
        data: data
    });
};

module.exports = ButtonMqttConnector;
