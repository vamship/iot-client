/* jshint node:true */
'use strict';

var _util = require('util');
var _q = require('q');
var _spi = require('serialport');
var SerialPort = _spi.SerialPort;
var PollingConnector = require('iot-client-lib').PollingConnector;
var EbaraPumpParser = require('./io/ebara-pump-parser');

var _logger = require('../logger');

/**
 * Connector that interfaces with a vacuum pump over SPI, and
 * extract data intended for the cloud.
 *
 * @class VacuumPumpConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function VacuumPumpConnector(id) {
    VacuumPumpConnector.super_.call(this, id)

    // <ESC> 'A' 'A' 'N' 'E', ',' '3' '0' <CR> <LF>
    this._connectMessage = new Buffer([ 27, 65, 65, 78, 69, 44, 51, 48, 13, 10 ]);
    this._ebaraPump = new EbaraPumpParser(id);
    this._requestPending = false;
    this._requestResetHandle = null;
    this._requestTimeout = 60 * 60 * 1000;

    var logger = _logger.getLogger(id);
    logger.extend(this);
}

_util.inherits(VacuumPumpConnector, PollingConnector);

/**
 * @class VacuumPumpConnector
 * @method _getResolver
 * @private
 */
VacuumPumpConnector.prototype._getResolver = function(def, operation) {
    return function(err) {
        if(err) {
            this.error('operation failed: [%s]', operation);
            def.reject(err);
        } else {
            this.info('operation succeeded: [%s]', operation);
            def.resolve();
        }
    }.bind(this);
};

/**
 * @class VacuumPumpConnector
 * @method _dataHandler
 * @private
 */
VacuumPumpConnector.prototype._dataHandler = function(data) {
    if(!data || typeof data !== 'object') {
        this.error('Invalid data received from serial port. Expected object, got: [%s]', (typeof data));
        return;
    }

    var payload = {
        id: this._id,
        data: data
    };

    this.info('Emitting sensor data for node');
    this.verbose('Sensor data: ', payload);

    this.emit('data', payload);

    this.debug('Resetting request pending flag and auto timeout');
    this._requestPending = false;
    if(this._requestResetHandle) {
        clearTimeout(this._requestResetHandle);
        this._requestResetHandle = null;
    }
};

/**
 * @class VacuumPumpConnector
 * @method _errorHandler
 * @private
 */
VacuumPumpConnector.prototype._errorHandler = function(err) {
    this.error('Error occurred when communicating on the port: ', err);
    this._ebaraPump.reset();
};

/**
 * @class VacuumPumpConnector
 * @method _start
 * @protected
 */
VacuumPumpConnector.prototype._start = function() {
    this.info('Initializing connector');
    this.verbose('Connector config: ', this._config);

    var def = _q.defer();
    this._port = new SerialPort(this._config.portName, {
        baudrate: this._config.baudRate,
        parity: this._config.parity,
        stopbits: this._config.stopBits,
        databits: this._config.dataBits,
        flowControl: this._config.flowControl,
        parser: this._ebaraPump.getParser()
    }, false);

    if(typeof this._config.pumpRequestTimeout !== 'number' ||
        this._config.pumpRequestTimeout <= 0) {
        def.reject('Pump request timeout parameter not valid: ' +
                                        this._config.pumpRequestTimeout);
        return;
    }
    this._requestTimeout = this._config.pumpRequestTimeout;

    this._port.open(function(err) {
        if(err) {
            this.error('Error opening port [%s]. Details: ', this._config.portName, err.toString());
            return def.reject(err);
        }
        this.info('Port open [%s]. Attaching event handlers.', this._config.portName);
        this._port.on('data', this._dataHandler.bind(this));
        this._port.on('error', this._errorHandler.bind(this));
        def.resolve();
    }.bind(this));

    // Allow the super class to do its thing after we are done
    // initializing the port.
    return def.promise.then(VacuumPumpConnector.super_.prototype._start.bind(this));
};

/**
 * @class VacuumPumpConnector
 * @method _stop
 * @protected
 */
VacuumPumpConnector.prototype._stop = function() {
    this.verbose('Stopping connector');
    var def = _q.defer();
    var promise = def.promise;
    if(this._port && this._port.isOpen()) {
        this.info('Closing port: [%s]', this._config.portName);
        this._port.drain();
        this._port.close(this._getResolver(def, 'close port: [' + this._config.portName + ']'));
        promise = def.promise.then(function() {
            this.info('Port closed: [%s]', this._config.portName);
            this._port = null;
        }.bind(this));
    } else {
        this.info('Port not open: [%s]', this._config.portName);
        def.resolve();
    }

    // Allow the super class to do its thing after we are done
    // initializing the port.
    return promise.fin(VacuumPumpConnector.super_.prototype._stop.bind(this));
};

/**
 * @class VacuumPumpConnector
 * @method _process
 * @protected
 */
VacuumPumpConnector.prototype._process = function() {
    if(this._port && this._port.isOpen()) {
        if(this._requestPending) {
            this.info('Waiting for response from previous request. No new request will be dispatched');
            return;
        }
        this._port.write(this._connectMessage, function(err, data) {
            if(err) {
                this.error('Error writing data on port: [%s]. Details: ', this._config.portName, err);
            } else {
                this.verbose('Command successfully sent to pump. Result: [%s]', data);
            }
        }.bind(this));

        this._requestPending = true;
        this._requestResetHandle = setTimeout(function() {
            this.info('Request sent flag reset (timeout expired)');
            this._requestPending = false;
            this._requestResetHandle = null;
        }.bind(this), this._requestTimeout);
    } else {
        this.info('Port not initialized and ready');
    }
};

module.exports = VacuumPumpConnector;
