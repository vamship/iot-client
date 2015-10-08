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
            mac: mac,
            sensors: []
        };
        for(var dataType in item.data) {
            hasData = true;
            data.sensors.push({
                name: item.id + '-' + dataType,
                value: item.data[dataType]
            });
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
 * @method _process
 * @protected
 */
HttpConnector.prototype._process = function() {
    var payload = this._preparePayload();
    if(!payload) {
        //TODO: Log message here.
        //No data to send
        this._logger.info('No data to send');
        return;
    }

    var request = _unirest.post(this._config.url + '/api/nodes');
    for(var header in this._config.headers) {
        request = request.header(header, this._config.headers[header]);
    }

    this._logger.info('Sending data to cloud');
    this._logger.verbose('Payload: ', payload);
    request.send(JSON.stringify(payload))
        .end(function(response) {
            if(response.ok) {
                this._logger.info('Request processed successfully');
            } else {
                //TODO: log message here
                //Error posting data to server.
                this._logger.error('Error posting data to server. Status: [%s]. Body:', response.status, response.body);
            }
        }.bind(this));
};

module.exports = HttpConnector;
