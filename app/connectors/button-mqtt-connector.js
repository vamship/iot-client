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
 * @method _processSequence
 * @private
 */
ButtonMqttConnector.prototype._processSequence = function(sequence, sensorName, value) {
    var messages = [];
    if(!(sequence instanceof Array)) {
        this._logger.warn('Cannot process sequence. Input is not an array');
        return messages;
    }

    var baseTimestamp = null;
    sequence.forEach(function(offset) {
        if(baseTimestamp === null) {
            baseTimestamp = offset;
            offset = 0;
        }
        var data = {
            // We are getting time in seconds, and need to report it
            // in milliseconds
            timestamp: (baseTimestamp + offset) * 1000
        };
        data[sensorName] = value;
        messages.push(data);
    });

    return messages;
};

/**
 * @class ButtonMqttConnector
 * @method _processObjectPayload
 * @private
 */
ButtonMqttConnector.prototype._processObjectPayload = function(payload) {
    var messages = [];
    messages = messages.concat(this._processSequence(payload.buttonPress, 'button', 1));
    if(messages.length === 0) {
        // No data received. Treat it as a heartbeat
        messages.push({
            timestamp: Date.now(),
            button: 0
        });
    }
    if(payload.alertReset > 0) {
        messages.push({
            timestamp: payload.alertReset * 1000,
            button: 2
        });
    }
    for(var key in payload) {
        if(key !== 'buttonPress' && key !== 'alertReset') {
            var data = {
                timestamp: Date.now()
            };
            data[key] = payload[key];
            messages.push(data);
        }
    }
    return messages;
};

/**
 * @class ButtonMqttConnector
 * @method _processNumberPayload
 * @private
 */
ButtonMqttConnector.prototype._processNumberPayload = function(sensorName, payload) {
    var messages = [];
    var simpleValue = parseInt(payload);
    if(isNaN(simpleValue)) {
        this._logger.warn('Non number payload received from sensor: [%s] [%s]', sensorName, payload);
    } else {
        this._logger.info('Emitting data for single sensor: [%s] [%s]', sensorName, simpleValue);
        var data = {
            timestamp: Date.now()
        };
        data[sensorName] = simpleValue;
        messages.push(data);
    }
    return messages;
};

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
    if(tokens.length < 3) {
        this._logger.warn('Message topic did not have sufficient tokens: [%s]', topic);
        return;
    }
    var thingName = tokens[tokens.length - 2];
    var sensorName = tokens[tokens.length - 1];

    if(thingName.length <= 0 || sensorName.length <= 0) {
        this._logger.warn('Message topic did not have a valid thing name or sensor name: [%s]', topic);
        return;
    }
    message = message.toString();
    if(message.length <= 0) {
        this._logger.warn('Invalid message received. Expecting non empty string');
        return;
    }

    var eventData = [];
    if(sensorName === 'all') {
        this._logger.debug('Parsing message as object');
        try {
            var payload = JSON.parse(message);
            eventData = eventData.concat(this._processObjectPayload(payload));
        } catch (ex) {
            this._logger.warn('Unable to parse object payload: [%s]', message, ex);
        }
    } else {
        this._logger.debug('Parsing message as number');
        eventData = eventData.concat(this._processNumberPayload(sensorName, message));
    }
    eventData.forEach(function(item) {
        this._logger.debug('Emitting data:', item);
        this.emit('data', {
            id: thingName,
            data: item
        });
    }.bind(this));
};

module.exports = ButtonMqttConnector;
