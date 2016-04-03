/* jshint node:true */
'use strict';

var _util = require('util');
var _q = require('q');
var _wiringPi = require('../utils/wiring-pi-wrapper');
var PollingConnector = require('iot-client-lib').PollingConnector;

/**
 * Connector that can be used to demonstrate the concept of the connector
 * architecture, along with the effects of cloud based command and control.
 *
 * @class DemoConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function DemoConnector(id) {
    DemoConnector.super_.call(this, id)
    this._outputPins = [];
}

_util.inherits(DemoConnector, PollingConnector);

/**
 * @class DemoConnector
 * @method _start
 * @protected
 */
DemoConnector.prototype._start = function() {
    this._logger.info('Initializing connector');

    var def = _q.defer();
    if(typeof this._config.redLedPin !== 'number' ||
        this._config.redLedPin <= 0) {
        def.reject('Invalid red LED pin specified: ' +
                                        this._config.redLedPin);
        return;
    }
    if(typeof this._config.redLedBlinkRate !== 'number' ||
        this._config.redLedBlinkRate <= 0) {
        def.reject('Invalid red LED blink rate specified: ' +
                                        this._config.redLedBlinkRate);
        return;
    }
    if(typeof this._config.greenLedPin !== 'number' ||
        this._config.greenLedPin <= 0) {
        def.reject('Invalid green LED pin specified: ' +
                                        this._config.greenLedPin);
        return;
    }
    if(typeof this._config.greenLedBlinkRate !== 'number' ||
        this._config.greenLedBlinkRate <= 0) {
        def.reject('Invalid green LED blink rate specified: ' +
                                        this._config.greenLedBlinkRate);
        return;
    }

    this._outputPins.splice(0);
    this._outputPins.push({
        title: 'red led (blink)',
        pin: this._config.redLedPin,
        rate: this._config.redLedBlinkRate,
        counter: 0
    }, {
        title: 'green led (blink)',
        pin: this._config.greenLedPin,
        rate: this._config.greenLedBlinkRate,
        counter: 0
    });

    try {
        this._stop().fin(function() {

            this._outputPins.forEach(function(pinInfo) {
                this._logger.info('Initializing pin: [%s]', pinInfo.title);
                _wiringPi.pinMode(pinInfo.pin, _wiringPi.OUTPUT);
                _wiringPi.digitalWrite(pinInfo.pin, 0);
            }.bind(this));
        }.bind(this));
        def.resolve();
    } catch(ex) {
        this._logger.error('Unable to connect to camera: [%s]', ex.toString(), ex);
        def.reject(ex);
    }

    // Allow the super class to do its thing after we are done
    // initializing the port.
    return def.promise.then(DemoConnector.super_.prototype._start.bind(this));
};

/**
 * @class DemoConnector
 * @method _process
 * @protected
 */
DemoConnector.prototype._process = function() {
    this._outputPins.forEach(function(pinInfo) {
        this._logger.info('Updating pin: [%s]', pinInfo.title);
        pinInfo.counter = (pinInfo.counter+1) % pinInfo.rate;
        var output = (pinInfo.counter === 0)? 1:0;
        _wiringPi.digitalWrite(pinInfo.pin, output);
    }.bind(this));
};

module.exports = DemoConnector;
