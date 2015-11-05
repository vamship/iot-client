/* jshint node:true */
'use strict';

var _util = require('util');
var _unirest = require('unirest');
var PollingConnector = require('iot-client-lib').PollingConnector;

/**
 * Connector that can make HTTP requests at a predetermined frequency.
 *
 * @class HttpConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function HttpConnector(id) {
    HttpConnector.super_.call(this, id)
}

_util.inherits(HttpConnector, PollingConnector);

/**
 * @class HttpConnector
 * @method _preparePayload
 * @private
 */
HttpConnector.prototype._preparePayload = function() {
    var gatewayId = this._config.gatewayId;
    var payload = {};

    this._buffer.forEach(function(item) {
        var nodeName = gatewayId + '-' + item.id;
        var nodeData = payload[nodeName];
        if(!nodeData) {
            nodeData = {
                sensors: []
            };
            payload[nodeName] = nodeData;
        }

        var timestamp = item.data['timestamp'];
        for(var sensorName in item.data) {
            if(sensorName !== 'timestamp') {
                nodeData.sensors.push({
                    sensorName: sensorName,
                    timestamp: timestamp,
                    value: item.data[sensorName]
                });
            }
        }
    });
    this._buffer.splice(0);

    return payload;
};

/**
 * @class HttpConnector
 * @method _makeRequest
 * @private
 */
HttpConnector.prototype._makeRequest = function(nodeName, payload) {
    this._logger.info('Sending data to cloud for: [%s]', nodeName);

    var url = this._config.url + '/api/nodes/' + nodeName;
    var request = _unirest.post(url);
    for(var header in this._config.headers) {
        request = request.header(header, this._config.headers[header]);
    }

    var payloadString = JSON.stringify(payload);
    this._logger.debug('Payload: ', payloadString);
    request.send(payloadString)
        .end(function(response) {
            if(response.ok) {
                this._logger.info('Data successfully posted to the cloud for: [%s]', nodeName);
            } else {
                //TODO: log message here
                //Error posting data to server.
                this._logger.error('Error posting data to server for [%s]. Status: [%s]. Body:',
                                            nodeName, response.status, response.body);
            }
        }.bind(this));
};

/**
 * @class HttpConnector
 * @method _process
 * @protected
 */
HttpConnector.prototype._process = function() {
    var payload = this._preparePayload();
    var nodeNames = Object.keys(payload);
    if(nodeNames.length <= 0) {
        this._logger.info('No data to send');
        return;
    }

    this._logger.info('Sending [%s] packets of data to the cloud', nodeNames.length);
    nodeNames.forEach(function(nodeName) {
        this._makeRequest(nodeName, payload[nodeName]);
    }.bind(this));
};

module.exports = HttpConnector;
