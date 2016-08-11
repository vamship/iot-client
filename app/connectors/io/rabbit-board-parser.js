/* jshint node:true */
'use strict';

var _loggerProvider = require('../../logger-provider');

var CR = 13;
var LF = 10;
var SENSOR_MAP = {
    '0': 'power',
    '1': 'energy',
    '2': 'voltage'
};

/**
 * Represents a parser object that can receive and process data from a Rabbit
 * Board
 *
 * @class RabbitBoardParser
 * @constructor
 */
function RabbitBoardParser(id, dataTimeout) {
    this.reset();
    this._dataTimeoutDuration = dataTimeout;
    this._logger = _loggerProvider.getLogger(id);
}

/**
 * @class RabbitBoardParser
 * @method _populateTimestamp
 * @private
 */
RabbitBoardParser.prototype._populateTimestamp = function(payload, tokens) {
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
 * @class RabbitBoardParser
 * @method _populateSensorData
 * @private
 */
RabbitBoardParser.prototype._populateSensorData = function(payload, tokens) {
    var sensor = SENSOR_MAP[tokens[0]];
    if(sensor) {
        payload[sensor] = parseFloat(tokens[1]);
    } else {
        this._logger.warn('Unable to find sensor with id: [%s]', tokens[0]);
    }
};

/**
 * @class RabbitBoardParser
 * @method _parseResponse
 * @private
 */
RabbitBoardParser.prototype._parseResponse = function(data) {
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
            //this._populateTimestamp(payload.data, tokens);
            payload.timestamp = Date.now();
            payload.id = tokens[1];
        } else if (index>1 && index<data.length - 1) {
            this._populateSensorData(payload.data, tokens);
        }
    }
    return payload;
};

/**
 * @class RabbitBoardParser
 * @method _clearDataTimeout
 * @private
 */
RabbitBoardParser.prototype._clearDataTimeout = function(startNew) {
    if(this._dataTimeoutHandle) {
        this._logger.info('Clearing data timeout');
        clearTimeout(this._dataTimeoutHandle);
        this._dataTimeoutHandle = null;
    }
    if(startNew) {
        this._logger.info('Initializing data timeout handler: [%s]', this._dataTimeoutDuration);
        this._dataTimeoutHandle = setTimeout(function() {
            this._logger.info('Data flow timed out. Reseting parser');
            this.reset();
            this._clearDataTimeout(false);
        }.bind(this), this._dataTimeoutDuration);
    }
};

/**
 * Resets the parser, discarding any unprocessed data that has been received
 * from the rabbit board.
 *
 * @class RabbitBoardParser
 * @method reset
 */
RabbitBoardParser.prototype.reset = function() {
    this._lines = [];
    this._currentLine = [];
    this._lastByte = null;
};


/**
 * Returns a parser handler for serial port communication
 *
 * @class RabbitBoardParser
 * @method getParser
 * @return {Function} A function that can be used with a node-serialport
 *          port object.
 */
RabbitBoardParser.prototype.getParser = function() {
    return function(emitter, buffer) {
        this._clearDataTimeout(true);

        for(var index=0; index<buffer.length; index++) {
            var nextByte = buffer[index];
            if(this._lastByte === CR && nextByte === LF) {
                var buf = new Buffer(this._currentLine);
                var line = buf.toString('ascii');

                this._logger.debug('Rabbit board data: [%s]', line);

                if(line.indexOf('STX') === 0) {
                    this._logger.info('Start of payload received. Clearing buffers');
                    this.reset();
                    this._lines.push(line);

                } else if (this._lines.length > 0) {
                    // This must be the second line or greater.
                    if(line === 'END') {
                        emitter.emit('data', this._parseResponse(this._lines));
                        this._clearDataTimeout(false);
                        this._lines = [];
                    } else {
                        this._lines.push(line);
                    }

                } else {
                    // Still on first line, but did not get STX yet.
                    this._logger.warn('First line of data did not start with "STX". Ignoring line.');
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

module.exports = RabbitBoardParser;
