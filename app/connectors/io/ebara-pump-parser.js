/* jshint node:true */
'use strict';

var _loggerProvider = require('../../logger-provider');

var CR = 13;
var LF = 10;
var SENSOR_MAP = {
    '0': 'bpMotorCurrent',
    '1': 'mpMotorCurrent',
    '2': 'caseTemperature',
    '3': 'coolingWaterFlow',
    '4': 'sealN2Flow',
    '5': 'diluentN2Flow',
    '6': 'vacPressure',
    '7': 'bpMotorPressure',
    '8': 'mpMotorPressure',
    ';': 'boxTemperature'
};

var PUMP_SENSORS  = [
    'Total Running Time',
    'BP Power',
    'MP Power',
    'BP Motor Speed',
    'MP Motor Speed',
    'BP Current',
    'MP Current',
    'BP Casing Temp',
    'MP Casing Temp',
    'Reserved',
    'Reserved',
    'Cooling Water Flow',
    'Pump N2 Flow',
    'Reserved',
    'Back Pressure',
    'Heater 1',
    'Heater 2',
    'Heater 3',
    'Heater 4',
    'Vacuum Pressure',
    'Cooler 1',
    'Cooler 2',
    'Cooler 3',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Current Time',
    'Total Running Time',
    'BP Current',
    'MP Current',
    'Casing Temp',
    'Cooling Water Flow',
    'Pump N2 Flow',
    'Dilution N2 Flow',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Reserved',
    'Cooler 1',
    'Cooler 2',
    'Cooler 3',
    'Exhaust Trap Temp',
    'Vacuum Pressure',
    'BP Motor Speed'
];

/**
 * Represents a parser object that can receive and process data from a vacuum
 * pump
 *
 * @class EbaraPumpParser
 * @constructor
 */
function EbaraPumpParser(id) {
    // <ESC> 'A' 'A' 'N' 'E', ',' '3' '0' <CR> <LF>
    this.connectMessage = new Buffer([ 27, 65, 65, 78, 69, 44, 51, 48, 13, 10 ]);
    this.reset();
    this._logger = _loggerProvider.getLogger(id);
}

/**
 * @class EbaraPumpParser
 * @method _populateTimestamp
 * @private
 */
EbaraPumpParser.prototype._populateTimestamp = function(payload, tokens) {
    var matches = /([0-9]{4,}\/[0-9]{2,}\/[0-9]{2,}).(.*)/.exec(tokens[0]);
    var timestamp = NaN;

    if(matches && matches.length && matches.length > 2) {
        timestamp = Date.parse(matches[1] + ' ' + matches[2]);
        if(isNaN(timestamp)) {
            this._logger.warn('Unable to parse timestamp: [%s]', tokens[0]);
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
        this._logger.warn('Unable to find sensor with id: [%s]', tokens[0]);
    }
};

/**
 * @class EbaraPumpParser
 * @method _parseResponse
 * @private
 */
EbaraPumpParser.prototype._parseResponse = function(data) {
    var payload = {
        id: null,
        data: { }
    };
    for(var index=0; index<data.length; index++) {
        var line = data[index];

        var tokens = line.split(',').map(function(token) {
            return token.trim();
        });

        if(index === 0) {
            this._populateTimestamp(payload.data, tokens);
        } else if(index === data.length - 2) {
            payload.id = tokens[1];
        } else if (index>1 && index<data.length - 2) {
            this._populateSensorData(payload.data, tokens);
        }
    }
    return payload;
}


/**
 * Resets the parser, discarding any unprocessed data that has been received
 * from the pump
 *
 * @class EbaraPumpParser
 * @method reset
 */
EbaraPumpParser.prototype.reset = function() {
    this._lines = [];
    this._currentLine = [];
    this._lastByte = null;
};

/**
 * Returns a parser handler for serial port communication
 *
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

                this._logger.debug('Pump data: [%s]', line);

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
