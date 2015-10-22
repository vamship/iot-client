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
    var payload = [];
    var mac = this._config.mac;
    var hasData = false;
    
    this._buffer.map(function(item) {
        var data = {
            mac: mac + '-' + item.id,
            sensors: []
        };
        for(var dataType in item.data) {
            hasData = true;
            if(dataType === 'timestamp') {
                data.timestamp = item.data[dataType];
            } else {
                data.sensors.push({
                    name: dataType,
                    value: item.data[dataType]
                });
            }
        }
        return data;
    }).forEach(function(array) {
        payload.push(array);
    });
    this._buffer.splice(0);

    return hasData? payload:null;
};

/**
 * @class HttpConnector
 * @method _makeRequest
 * @private
 */
HttpConnector.prototype._makeRequest = function(payload) {
    this._logger.info('Sending data to cloud for: [%s]', payload[0].mac);

    var request = _unirest.post(this._config.url + '/api/nodes');
    for(var header in this._config.headers) {
        request = request.header(header, this._config.headers[header]);
    }

    var payloadString = JSON.stringify(payload);
    this._logger.debug('Payload: ', payloadString);
    request.send(payloadString)
        .end(function(response) {
            if(response.ok) {
                this._logger.info('Data successfully posted to the cloud for: [%s]', payload[0].mac);
            } else {
                //TODO: log message here
                //Error posting data to server.
                this._logger.error('Error posting data to server for [%s]. Status: [%s]. Body:',
                                            payload[0].mac, response.status, response.body);
            }
        }.bind(this));
};

/**
 * @class HttpConnector
 * @method _process
 * @protected
 */
HttpConnector.prototype._process = function() {
    var payloads = this._preparePayload();
    if(!payloads) {
        //TODO: Log message here.
        //No data to send
        this._logger.info('No data to send');
        return;
    }

    this._logger.info('Sending [%s] packets of data to the cloud', payloads.length);
    payloads.forEach(function(payload) {
        this._makeRequest([payload]);
    }.bind(this));
};

module.exports = HttpConnector;
