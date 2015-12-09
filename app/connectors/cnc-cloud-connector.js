/* jshint node:true */
'use strict';

var _util = require('util');
var MqttConnector = require('./mqtt-connector');

/**
 * Connector that uses MQTT to communicate with the cloud for command and
 * control purposes.
 *
 * @class CncCloudConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function CncCloudConnector(id) {
    CncCloudConnector.super_.call(this, id)
}

_util.inherits(CncCloudConnector, MqttConnector);


/**
 * @class CncCloudConnector
 * @method _processBrokerMessage
 * @private
 */
CncCloudConnector.prototype._processBrokerMessage = function(topic, message) {
    if(typeof topic !== 'string' || topic.length <= 0) {
        this._logger.warn('Invalid topic specified: [%s]', topic);
    }

    var tokens = topic.split('/');
    if(tokens.length < 3) {
        this._logger.warn('Message topic did not have sufficient tokens: [%s]', topic);
        return;
    }

    var requestId = tokens[3];

    this._logger.info('Command received from cloud [%s]. RequestId: [%s]', topic, requestId);
    var payload = null;
    try {
        payload = JSON.parse(message.toString());
        payload.command = payload.command || {};
        payload.command.requestId = requestId;
    } catch (ex) {
        this._logger.error('Invalid message received: [%s] [%s]. RequestId: [%s]. Error: [%s]', topic, message, requestId, ex.toString());
        this.emit('log', [ 'Invalid message received: [%s] [%s]. RequestId: [%s]. Error: [%s]', topic, message, requestId, ex.toString() ]);
        return;
    }

    this.emit('data', [ payload.command ]);
};

module.exports = CncCloudConnector;
