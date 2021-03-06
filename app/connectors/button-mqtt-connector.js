/* jshint node:true */
'use strict';

var _util = require('util');
var _shortId = require('shortid');
var Connector = require('iot-client-lib').Connector;
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
 * @method _processObjectPayload
 * @private
 */
ButtonMqttConnector.prototype._processObjectPayload = function(payload) {
    var messages = [];
    var counter = 0;
    var value = 1;

    if(payload.action === 'heartbeat') {
        value = 0;
    } else if(payload.action === 'alert_reset') {
        value = 2;
    }
    // HACK: The button is sending us a single timestamp record in
    // an array instead of a single numerical value
    if(payload.timestamp instanceof Array) {
        payload.timestamp = payload.timestamp[0];
    }
    payload.press.forEach(function(offset) {
        messages.push({
            // We are getting time in seconds, and need to report it
            // in milliseconds
            timestamp: ((payload.timestamp + offset) * 1000) + counter,
            button: value,
        });
        counter++;
    });
    if(payload.battery) {
        messages.push({
            // We are getting time in seconds, and need to report it
            // in milliseconds
            timestamp: (payload.timestamp * 1000) + counter,
            battery: payload.battery,
        });
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
    if(sensorName === 'data') {
        this._logger.debug('Parsing message as object');
        try {
            var payload = JSON.parse(message);
            eventData = eventData.concat(this._processObjectPayload(payload));
        } catch (ex) {
            this._logger.warn('Unable to parse object payload: [%s]', message, ex);
        }
    } else if(sensorName === 'log') {
        this.emit(Connector.LOG_EVENT, {
            requestId: 'button_log_' + _shortId.generate(),
            data: topic + '::' + message
        });
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
