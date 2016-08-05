/* jshint node:true */
'use strict';

var _util = require('util');
var _q = require('q');
var _serialport = require('serialport');
var SerialPort = _serialport.SerialPort;
//SerialPort = require('../../test/mock-serial-port');
var Connector = require('iot-client-lib').Connector;
var RabbitBoardParser = require('./io/rabbit-board-parser');

/**
 * Connector that interfaces with a rabbit board over a serial port (RS232) and
 * extracts data intended for the cloud.
 *
 * @class RabbitBoardConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function RabbitBoardConnector(id) {
    RabbitBoardConnector.super_.call(this, id)

    this._dataParser = null;
    this._requestResetHandle = null;
    this._dataTimeout = 60 * 60 * 1000;
}

_util.inherits(RabbitBoardConnector, Connector);

/**
 * @class RabbitBoardConnector
 * @method _getResolver
 * @private
 */
RabbitBoardConnector.prototype._getResolver = function(def, operation) {
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
 * @class RabbitBoardConnector
 * @method _dataHandler
 * @private
 */
RabbitBoardConnector.prototype._dataHandler = function(payload) {
    if(!payload || typeof payload !== 'object') {
        this._logger.error('Invalid payload received from serial port. Expected object, got: [%s]', (typeof payload));
        return;
    }

    this._logger.info('Emitting sensor data for node');
    this._logger.debug('Sensor data: ', payload);

    this.emit('data', payload);

    this._logger.debug('Resetting request pending flag and auto timeout');
    if(this._requestResetHandle) {
        clearTimeout(this._requestResetHandle);
        this._requestResetHandle = null;
    }
};

/**
 * @class RabbitBoardConnector
 * @method _errorHandler
 * @private
 */
RabbitBoardConnector.prototype._errorHandler = function(err) {
    this._logger.error('Error occurred when communicating on the port: ', err);
    this._dataParser.reset();
};

/**
 * @class RabbitBoardConnector
 * @method _start
 * @protected
 */
RabbitBoardConnector.prototype._start = function() {
    this._logger.info('Initializing connector');

    var def = _q.defer();

    if(typeof this._config.dataTimeout !== 'number' ||
        this._config.dataTimeout <= 0) {
        def.reject('Data timeout parameter not valid: ' +
                                        this._config.dataTimeout);
        return;
    }
    this._dataTimeout = this._config.dataTimeout;

    this._dataParser = new RabbitBoardParser(this._id, this._dataTimeout);

    this._port = new SerialPort(this._config.portName, {
        baudrate: this._config.baudRate,
        parity: this._config.parity,
        stopbits: this._config.stopBits,
        databits: this._config.dataBits,
        flowControl: this._config.flowControl,
        parser: this._dataParser.getParser()
    }, false);

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

    return def.promise;
};

/**
 * @class RabbitBoardConnector
 * @method _stop
 * @protected
 */
RabbitBoardConnector.prototype._stop = function() {
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

    return promise;
};

/**
 * @class RabbitBoardConnector
 * @method _process
 * @protected
 */
// RabbitBoardConnector.prototype._process = function() {
//     if(this._port && this._port.isOpen()) {
//         if(this._requestPending) {
//             this._logger.info('Waiting for response from previous request. No new request will be dispatched');
//             return;
//         }
//         this._port.write(this._dataParser.connectMessage, function(err, data) {
//             if(err) {
//                 this._logger.error('Error writing data on port: [%s]. Details: ', this._config.portName, err);
//             } else {
//                 this._logger.debug('Command successfully sent to pump. Result: [%s]', data);
//             }
//         }.bind(this));

//         this._requestPending = true;
//         this._requestResetHandle = setTimeout(function() {
//             this._logger.info('Request sent flag reset (timeout expired)');
//             this._requestPending = false;
//             this._requestResetHandle = null;
//         }.bind(this), this._requestTimeout);
//     } else {
//         this._logger.warn('Port not initialized and ready');
//     }
// };

module.exports = RabbitBoardConnector;
