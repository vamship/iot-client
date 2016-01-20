/* jshint node:true */
'use strict';

var _spi = require('spi');
var _util = require('util');
var _q = require('q');
var _wiringPi = require('wiring-pi');
var PollingConnector = require('iot-client-lib').PollingConnector;

var PACKET_SIZE = 164;
var PACKETS_PER_FRAME = 60;
var DEFAULT_MAX_RETRIES = 750;
var DEFAULT_CAMERA_RESET_PIN = 23; //wiring pi pin number

/**
 * Connector that interfaces with a the lepton camera over a combination of
 * SPI and I2C, and extracts image data intended for the cloud.
 *
 * @class LeptonCameraConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function LeptonCameraConnector(id) {
    LeptonCameraConnector.super_.call(this, id)

    this._camera = null;
}

_util.inherits(LeptonCameraConnector, PollingConnector);

/**
 * Resets the camera.
 * @class LeptonCameraConnector
 * @method _start
 * @private
 */
LeptonCameraConnector.prototype._resetCamera = function() {
    var camera = this._camera;
    this._camera = null;

    this._logger.info('Starting camera reset');
    _wiringPi.digitalWrite(this._config.cameraResetPin, 0);
    setTimeout(function() {
        this._logger.info('Camera reset complete');
        _wiringPi.digitalWrite(this._config.cameraResetPin, 1);
        this._camera = camera;
    }.bind(this), 500);
};

/**
 * @class LeptonCameraConnector
 * @method _start
 * @protected
 */
LeptonCameraConnector.prototype._start = function() {
    this._logger.info('Initializing connector');

    var def = _q.defer();
    if(typeof this._config.spiDevice !== 'string' ||
        this._config.spiDevice.length <= 0) {
        def.reject('SPI device not specified: ' +
                                        this._config.spiDevice);
        return;
    }
    if(typeof this._config.i2cDevice !== 'string' ||
        this._config.i2cDevice.length <= 0) {
        def.reject('I2C device not specified: ' +
                                        this._config.i2cDevice);
        return;
    }
    if(typeof this._config.maxRetries !== 'number' ||
        this._config.maxRetries <= 0) {
        this._config.maxRetries = DEFAULT_MAX_RETRIES;
    }
    if(typeof this._config.cameraResetPin !== 'number' ||
        this._config.cameraResetPin <= 0) {
        this._config.cameraResetPin = DEFAULT_CAMERA_RESET_PIN;
    }

    try {
        this._stop().fin(function() {
            this._logger.info('Initializing camera reset pin: [%s]', this._config.cameraResetPin);
            _wiringPi.pinMode(this._config.cameraResetPin, _wiringPi.OUTPUT);
            _wiringPi.digitalWrite(this._config.cameraResetPin, 1);

            this._logger.info('Initializing SPI: [%s]', this._config.spiDevice);
            // NOTE: This is a synchronous (blocking) call.
            this._camera = new _spi.Spi(this._config.spiDevice, {
                mode: _spi.MODE.MODE_3,
                size: 8,
                maxSpeed: 10 * 1000 * 1000
            }, function(device){
                this._logger.debug('SPI ready. Opening connection to camera');

                device.open();
                this._logger.info('Successfully connected to camera');

                def.resolve();
            }.bind(this));
        }.bind(this));
    } catch(ex) {
        this._logger.error('Unable to connect to camera: [%s]', ex.toString(), ex);
        def.reject(ex);
    }

    // Allow the super class to do its thing after we are done
    // initializing the port.
    return def.promise.then(LeptonCameraConnector.super_.prototype._start.bind(this));
};

/**
 * @class LeptonCameraConnector
 * @method _stop
 * @protected
 */
LeptonCameraConnector.prototype._stop = function() {
    this._logger.info('Stopping connector');
    var def = _q.defer();
    try {
        if(this._camera) {
            this._logger.info('Closing camera on: [%s]', this._config.spiDevice);
            // NOTE: This is a synchronous (blocking) call.
            this._camera.close();
            this._camera = null;
            def.resolve();
        } else {
            this._logger.info('Not connected to camera: [%s]', this._config.spiDevice);
            def.resolve();
        }
    } catch(ex) {
        this._logger.error('Error closing connection to camera: [%s]', ex.toString(), ex);
        def.reject(ex);
    }

    // Allow the super class to do its thing after we are done
    // initializing the port.
    return def.promise.then(LeptonCameraConnector.super_.prototype._stop.bind(this));
};

/**
 * @class LeptonCameraConnector
 * @method _process
 * @protected
 */
LeptonCameraConnector.prototype._process = function() {
    if(this._camera) {
        this._logger.info('Reading image from camera');

        // NOTE: This is a synchronous (blocking) call.
        var retriesRemaining = this._config.maxRetries;
        var abort = false;
        var packets = [];
        var metadata = {
            minValue: Number.MAX_VALUE,
            maxValue: 0,
            rows: 0,
            cols: 0,
            delta: 0
        };
        do {
            var txBuf = new Buffer(PACKET_SIZE);
            /// TODO: It appears that the camera does not care about these bytes.
            //txBuf[0] = 0x00;
            //txBuf[1] = 0x6B;
            //txBuf[2] = 0x20;
            //txBuf[3] = 0x40;

            var rxBuf = new Buffer(PACKET_SIZE);
            this._camera.transfer(txBuf, rxBuf, function(dev, data) {
                if(data[1] < 60) {
                    var packetNumber = data[1];
                    if(packets.length != packetNumber) {
                        this._logger.warn('Missed packet: [%s] [%s]', packets.length, packetNumber);
                        retriesRemaining--;
                        packets = [];

                        if(retriesRemaining <= 0) {
                            this._logger.error('Max retries exceeded. Aborting');
                            abort = true;
                        }
                    } else {
                        var packet = data.slice(4);
                        var rowValues = [];

                        for(var index=0; index<packet.length; index+=2) {
                            var value = packet.readUInt16BE(index);
                            if(value > metadata.maxValue) {
                                metadata.maxValue = value;
                            }
                            if(value < metadata.minValue) {
                                metadata.minValue = value;
                            }

                            if(packet.length > metadata.cols) {
                                metadata.cols = packet.length;
                            }

                            rowValues.push(value);
                        }

                        packets.push(rowValues);
                    }
                }
            }.bind(this));
        } while(packets.length < 60 && !abort);

        if(!abort) {
            // Two bytes per column value.
            metadata.cols = metadata.cols/2;
            metadata.rows = packets.length;
            metadata.delta = metadata.maxValue - metadata.minValue;

            var payload = {
                id: this._id,
                data: {
                    timestamp: Date.now(),
                    camera: {
                        metadata: metadata,
                        lines: packets
                    }
                }
            };

            this._logger.info('Emitting sensor data for node');
            this.emit('data', payload);
        } else {
            this._logger.warn('Error reading frame from camera. No data to send');
            this._resetCamera();
        }
    } else {
        this._logger.warn('Camera not initialized and ready');
    }
};

module.exports = LeptonCameraConnector;
