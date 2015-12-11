/* jshint node:true */
'use strict';

var _util = require('util');
var _mqtt = require('mqtt');
var _prompt = require('prompt');
var _mqttHelper = require('./mqtt-helper');

function Commander(clientOptions, topicPrefix) {
    if(!clientOptions || typeof clientOptions !== 'object') {
        throw new Error('Invalid client options specified (arg #1)');
    }

    if(typeof topicPrefix !== 'string' || topicPrefix.length <= 0) {
        throw new Error('Invalid topic prefix specified (arg #2)');
    }

    this._client = _mqttHelper.initClient(clientOptions);
    this._topicPrefix = topicPrefix;
    this._requestCounter = 0;
}


Commander.prototype._getNextRequestId = function() {
    this._requestCounter++;
    return 'request_' + this._requestCounter;
};


/**
 * Issues a stop command for a specific connector via the mqtt broker.
 *
 * @class Commander
 * @method stopConnector
 * @param {String} [category] The category of the device to start. Can be omitted
 *          if the id is "all".
 * @param {String} [id] The id of the device to start. If omitted, a "stop all"
 *          command will be issued with the specified category.
 * @param {String} [requestId] An optional request id.
 */
Commander.prototype.stopConnector = function(category, id, requestId) {
    requestId = requestId || this._getNextRequestId();
    if(category === 'all') {
        id = category;
        category = undefined;
    } else if (id === 'all') {
        category = undefined;
    } else if (category !== 'cloud' && category !== 'device') {
        throw new Error(_util.format('Invalid category specified: [%s]', category))
    }
    id = id || 'all';

    var payload = {
        category: category,
        action: (id === 'all')? 'stop_all_connectors':'stop_connector',
        id: (id === 'all')? undefined: id
    };

    var topic = this._topicPrefix +  requestId;
    this._client.publish(topic, JSON.stringify(payload));
};

/**
 * Issues a start command for a specific connector via the mqtt broker.
 *
 * @class Commander
 * @method startConnector
 * @param {String} [category] The category of the device to start. Can be omitted
 *          if the id is "all".
 * @param {String} [id] The id of the device to start. If omitted, a "start all"
 *          command will be issued with the specified category.
 * @param {String} [requestId] An optional request id.
 */
Commander.prototype.startConnector = function(category, id, requestId) {
    requestId = requestId || this._getNextRequestId();
    if(category === 'all') {
        id = category;
        category = undefined;
    } else if (id === 'all') {
        category = undefined;
    } else if (category !== 'cloud' && category !== 'device') {
        throw new Error(_util.format('Invalid category specified: [%s]', category))
    }
    id = id || 'all';

    var payload = {
        category: category,
        action: (id === 'all')? 'start_all_connectors':'start_connector',
        id: (id === 'all')? undefined: id
    };

    var topic = this._topicPrefix +  requestId;
    this._client.publish(topic, JSON.stringify(payload));
};

/**
 * Issues a restart command for a specific connector via the mqtt broker.
 *
 * @class Commander
 * @method restartConnector
 * @param {String} [category] The category of the device to restart. Can be omitted
 *          if the id is "all".
 * @param {String} [id] The id of the device to restart. If omitted, a "restart all"
 *          command will be issued with the specified category.
 * @param {String} [requestId] An optional request id.
 */
Commander.prototype.restartConnector = function(category, id, requestId) {
    requestId = requestId || this._getNextRequestId();
    if(category === 'all') {
        id = category;
        category = undefined;
    } else if (id === 'all') {
        category = undefined;
    } else if (category !== 'cloud' && category !== 'device') {
        throw new Error(_util.format('Invalid category specified: [%s]', category))
    }
    id = id || 'all';

    var payload = {
        category: category,
        action: (id === 'all')? 'restart_all_connectors':'restart_connector',
        id: (id === 'all')? undefined: id
    };

    var topic = this._topicPrefix +  requestId;
    this._client.publish(topic, JSON.stringify(payload));
};

/**
 * Issues a program shutdown command to the gateway via the mqtt broker.
 *
 * @class Commander
 * @method shutdownGateway
 */
Commander.prototype.shutdownGateway = function(requestId) {
    requestId = requestId || this._getNextRequestId();

    var payload = {
        action: 'shutdown_program'
    };

    var topic = this._topicPrefix +  requestId;
    this._client.publish(topic, JSON.stringify(payload));
};

/**
 * Issues a program upgrade command to the gateway via the mqtt broker.
 *
 * @class Commander
 * @method upgradeGateway
 */
Commander.prototype.upgradeGateway = function(requestId) {
    requestId = requestId || this._getNextRequestId();

    var payload = {
        action: 'upgrade_program'
    };

    var topic = this._topicPrefix +  requestId;
    this._client.publish(topic, JSON.stringify(payload));
};


module.exports = Commander;
