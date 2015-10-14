/* jshint node:true */
'use strict';

var _util = require('util');
var _q = require('q');
var _spi = require('serialport');
var SerialPort = _spi.SerialPort;
var PollingConnector = require('iot-client-lib').PollingConnector;
var EbaraPumpParser = require('./io/ebara-pump-parser');

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
            this._logger.error('operation failed: [%s]', operation);
            def.reject(err);
        } else {
            this._logger.info('operation succeeded: [%s]', operation);
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
        this._logger.error('Invalid data received from serial port. Expected object, got: [%s]', (typeof data));
        return;
    }

    var payload = {
        id: this._id,
        data: data
    };

    this._logger.info('Emitting sensor data for node');
    this._logger.debug('Sensor data: ', payload);

    this.emit('data', payload);

    this._logger.debug('Resetting request pending flag and auto timeout');
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
    this._logger.error('Error occurred when communicating on the port: ', err);
    this._ebaraPump.reset();
};

/**
 * @class VacuumPumpConnector
 * @method _start
 * @protected
 */
VacuumPumpConnector.prototype._start = function() {
    this._logger.info('Initializing connector');

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
            this._logger.error('Error opening port [%s]. Details: ', this._config.portName, err.toString());
            return def.reject(err);
        }
        this._logger.info('Port open [%s]. Attaching event handlers.', this._config.portName);
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
    this._logger.info('Stopping connector');
    var def = _q.defer();
    var promise = def.promise;
    if(this._port && this._port.isOpen()) {
        this._logger.info('Closing port: [%s]', this._config.portName);
        this._port.drain();
        this._port.close(this._getResolver(def, 'close port: [' + this._config.portName + ']'));
        promise = def.promise.then(function() {
            this._logger.info('Port closed: [%s]', this._config.portName);
            this._port = null;
        }.bind(this));
    } else {
        this._logger.info('Port not open: [%s]', this._config.portName);
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
            this._logger.info('Waiting for response from previous request. No new request will be dispatched');
            return;
        }
        this._port.write(this._connectMessage, function(err, data) {
            if(err) {
                this._logger.error('Error writing data on port: [%s]. Details: ', this._config.portName, err);
            } else {
                this._logger.debug('Command successfully sent to pump. Result: [%s]', data);
            }
        }.bind(this));

        this._requestPending = true;
        this._requestResetHandle = setTimeout(function() {
            this._logger.info('Request sent flag reset (timeout expired)');
            this._requestPending = false;
            this._requestResetHandle = null;
        }.bind(this), this._requestTimeout);
    } else {
        this._logger.warn('Port not initialized and ready');
    }
};

module.exports = VacuumPumpConnector;
