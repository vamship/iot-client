/* jshint node:true */
'use strict';

var _logger = require('../../logger');

var CR = 13;
var LF = 13;
var SENSOR_MAP = {
    '0': 'bpMotorCurrent',
    '1': 'mpMotorCurrent',
    '2': 'caseTemperature',
    '3': 'coolingWaterFlow',
    '4': 'sealN2Flow',
    '5': 'diluentN2Flow',
    '6': 'bpMotorPressure',
    '7': 'mpMotorPressure',
    '8': 'boxTemperature'
};

/**
 * Represents a parser object that can receive and process data from a vacuum
 * pump
 *
 * @class EbaraPumpParser
 * @constructor
 */
function EbaraPumpParser(id) {
    this._lines = [];
    this._currentLine = [];
    this._lastByte = null;

    var logger = _logger.getLogger(id);
    logger.extend(this);
}

/**
 * @class EbaraPumpParser
 * @method _populateTimestamp
 * @private
 */
EbaraPumpParser.prototype._populateTimestamp = function(payload, tokens) {
    var matches = /([0-9]{4,}\/[0-9]{2,}\/[0-9]{2,})\/(.*)/.exec(tokens[0]);
    var timestamp = NaN;

    if(matches && matches.length && matches.length > 2) {
        timestamp = Date.parse(matches[1] + ' ' + matches[2]);
        if(isNaN(timestamp)) {
            this.warn('Unable to parse timestamp: %s', tokens[0]);
        } else {
            payload.timestamp = timestamp;
        }
    }
};

/**
 * @class EbaraPumpParser
 * @method _populateSensorData
 * @private
 */
EbaraPumpParser.prototype._populateSensorData = function(payload, tokens) {
    var sensor = SENSOR_MAP[tokens[0]];
    if(sensor) {
        payload[sensor] = parseFloat(tokens[1]);
    } else {
        this.warn('Unable to find sensor with id: %s', tokens[0]);
    }
};

/**
 * @class EbaraPumpParser
 * @method _parseResponse
 * @private
 */
EbaraPumpParser.prototype._parseResponse = function(data) {
    var payload = {};
    for(var index=0; index<data.length; index++) {
        var line = data[index];

        var tokens = line.split(',').map(function(token) {
            return token.trim();
        });

        if(index === 0) {
            this._populateTimestamp(payload, tokens);
        } else if (index>1) {
            this._populateSensorData(payload, tokens);
        }
    }
    return payload;
}

/**
 * Returns a parser handler for serial port communication
 * @class EbaraPumpParser
 * @method getParser
 * @return {Function} A function that can be used with a node-serialport
 *          port object.
 */
EbaraPumpParser.prototype.getParser = function() {
    return function(emitter, buffer) {
        for(var index=0; index<buffer.length; index++) {
            var nextByte = buffer[index];
            if(this._lastByte === CR && nextByte === LF) {
                var buf = new Buffer(this._currentLine);
                var line = buf.toString('ascii');

                if(line === 'END') {
                    emitter.emit('data', this._parseResponse(this._lines));
                    this._lines = [];
                } else {
                    this._lines.push(line);
                }

                this._currentLine = [];
                this._lastByte = null;
            } else {
                this._lastByte = nextByte;
                if(this._lastByte !== CR && this._lastByte !== LF) {
                    this._currentLine.push(this._lastByte);
                }
            }
        }
    }.bind(this);
};

module.exports = EbaraPumpParser;
