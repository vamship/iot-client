/* jshint node:true */
'use strict';

var _events = require('events');
var _util = require('util');

var LATENCY_STEP = 10;
var CRLF = String.fromCharCode(13) + String.fromCharCode(10);
var RESPONSE = '2015/10/21 08:12:34,D7' + CRLF +
    '0006986228,09' + CRLF +
    '0,     4.6,74' + CRLF +
    '1,    11.0,7D' + CRLF +
    '2,   125.4,98' + CRLF +
    '3,     6.2,75' + CRLF +
    '4,     3.3,74' + CRLF +
    '5,    26.1,88' + CRLF +
    '6,      .0,52' + CRLF +
    '7,    54.4,8E' + CRLF +
    '8,    82.4,90' + CRLF +
    ';,    35.4,91' + CRLF +
    '0,  D77012,21' + CRLF +
    '1,        ,9D' + CRLF +
    'END' + CRLF;

function SerialPort(port, options) {
    this._isOpen = false;
    this._parser = options.parser;
}

_util.inherits(SerialPort, _events.EventEmitter);

SerialPort.prototype.isOpen = function() {
    return this._isOpen;
};

SerialPort.prototype.open = function(callback) {
    setTimeout(function() {
        this._isOpen = true;
        if(typeof callback === 'function') {
            callback();
        }
    }.bind(this), LATENCY_STEP);
};

SerialPort.prototype.close = function(callback) {
    setTimeout(function() {
        this._isOpen = false;
        if(typeof callback === 'function') {
            callback();
        }
    }.bind(this), LATENCY_STEP);
};


SerialPort.prototype.drain = function() {
};

SerialPort.prototype.write = function() {
    setTimeout(function() {
        if(typeof this._parser === 'function') {
            this._parser(this, new Buffer(RESPONSE));
        }
    }.bind(this), LATENCY_STEP * 2);
};

module.exports = SerialPort;
