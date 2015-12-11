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
 * @method _start
 * @protected
 */
CncCloudConnector.prototype._start = function() {
    this._topicPrefix = ['', this._config.username, this._config.gatewayname, '' ].join('/');
    this._config.topics = 'cloud' + this._topicPrefix + '+';
    return CncCloudConnector.super_.prototype._start.call(this);
}

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
    if(tokens.length < 4) {
        this._logger.warn('Message topic did not have sufficient tokens: [%s]', topic);
        return;
    }

    var requestId = tokens[3];

    this._logger.info('Command received from cloud [%s]. RequestId: [%s]', topic, requestId);

    var commands = [];
    try {
        var cloudCommands = JSON.parse(message.toString());
        if(!(cloudCommands instanceof Array)) {
            cloudCommands = [ cloudCommands ];
        }

        cloudCommands.forEach(function(command) {
            if(command && typeof command === 'object') {
                command.requestId = requestId;
                commands.push(command);
            } else {
                this._logger.warn('Bad command received from cloud. Command will be ignored', command);
            }
        });
    } catch (ex) {
        this._logger.error('Invalid message received: [%s] [%s]. RequestId: [%s]. Error: [%s]', topic, message, requestId, ex.toString());
        return;
    }


    this.emit('data', commands);
};

/**
 * @class CncCloudConnector
 * @method addLogData
 * @param {Object} data The data to add to the connector's log buffer.
 */
CncCloudConnector.prototype.addLogData = function(data) {
    if(!data || (data instanceof Array) || typeof data !== 'object') {
        this._logger.warn('Log message was not presented in a valid format, and will be ignored', data);
        return;
    }
    var requestId = data.requestId || 'na';
    var message = data.message || '';
    var qos = 0;
    var topic = 'gateway' + this._topicPrefix + requestId;
    this._publish(topic, message, qos);
};

module.exports = CncCloudConnector;
