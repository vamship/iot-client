/* jshint node:true */
'use strict';
var _path = require('path');
var _fs = require('fs');
var _shortId = require('shortid');
var _spi = require('spi');
var _util = require('util');
var _q = require('q');
var _wiringPi = require('../utils/wiring-pi-wrapper');
var PollingConnector = require('iot-client-lib').PollingConnector;
var spawn = require('child_process').spawn;

var PiCamera = require('../utils/node-picam/lib/Camera').Camera;

var PACKET_SIZE = 164;
var PACKETS_PER_FRAME = 60;
var DEFAULT_MAX_RETRIES = 750;
var DEFAULT_CAMERA_RESET_PIN = 23; //wiring pi pin number
var DEFAULT_CAMERA_LIGHTS_PIN = 4; //wiring pi pin number
var DEFAULT_SCANUPDATE_FREQ = 50;
var DEFAULT_RECAPTURE_MAXTRIES = 20;
var DEFAULT_RECAPTURE_DELAY = 500;
var RGB_MAX_READ_RETRIES = 5;	
var RGB_PATH_PREFIX = '../../data/rgb_';

function Servo( config ) {
   this.config = config;
   this.reset();
};

Servo.prototype.reset = function() {
   this.angle = this.config.minAngle;
   this.target = 0;
   this.direction = 1;
   this.callback = null;
   this.index = 0;
   this.indexIncrement = 1;
   this.rgbRetries = RGB_MAX_READ_RETRIES;
};

Servo.prototype.move = function(angle, callback) {
   this.new = true;
   this.target = angle;
   this.callback = callback;

   if (this.target < this.angle) 
   {
	this.direction = -1;
   }
   else 
   {
	this.direction = 1;
   }

   if (this.angle == this.target && this.callback != null) {
	this.callback();
   }
};

Servo.prototype.update = function() {
   var prevAngle = this.angle;

   if (this.direction < 0) 
   {
	this.angle = Math.max(this.angle - this.config.incAngle, this.target);
   }
   else
   {
	this.angle = Math.min(this.angle + this.config.incAngle, this.target);
   }

   /* write data to the signal pin */
   _wiringPi.pwmWrite( this.config.pin, this.angle );

   /* first time we reach target, fire the callback */
   if (this.angle != prevAngle && this.angle == this.target) 
   {
	if (this.callback != null) 
	{
	    this.callback();
	}
   }
};

/**
 * Connector that interfaces with a the lepton camera over a combination of
 * SPI and I2C, and extracts image data intended for the cloud.
 *
 * @class LeptonPanTiltCameraConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function LeptonPanTiltCameraConnector(id) {
    LeptonPanTiltCameraConnector.super_.call(this, id)

    this._camera = null;
    this._scanning = false;
    this._scan = 0;
    this._row = 0;
    this._col = 0;
    this._scanUpdateTimer = null;
    this._recaptureRetries = 0
    this._tiltServo = null;
    this._panServo = null;

    this._picam = null;
}

_util.inherits(LeptonPanTiltCameraConnector, PollingConnector);

/**
 * Resets the camera.
 * @class LeptonPanTiltCameraConnector
 * @method _resetCamera
 * @private
 */
LeptonPanTiltCameraConnector.prototype._resetCamera = function() {

    var pantilt = this;
    var def = _q.defer();

    this._logger.info('Starting camera reset');
    _wiringPi.digitalWrite(this._config.cameraResetPin, 0);

    setTimeout(function() {
        pantilt._logger.info('Camera reset complete');
        _wiringPi.digitalWrite(pantilt._config.cameraResetPin, 1);

        return def.resolve('reset');

    }.bind(pantilt), pantilt._config.cameraResetTimeout);

    return def.promise;
};

/**
 * @class LeptonPanTiltCameraConnector
 * @method _start
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._start = function() {
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

    if(typeof this._config.cameraLightsPin !== 'number' ||
        this._config.cameraLightsPin <= 0) {
        this._config.cameraLightsPin = DEFAULT_CAMERA_LIGHTS_PIN;
    }

    if(this._config.tiltServo == null) {
        def.reject('tiltServo settings not specified');
        return;
    }
 
    if(this._config.panServo == 0) {
        def.reject('panServo settings not specified');
        return;
    }
 
    if(this._config.moves.length == 0) {
        def.reject('Camera moves not specified');
        return;
    }

    if(typeof this._config.scanUpdateFrequency !== 'number' ||
        this._config.scanUpdateFrequency <= 0) {
        this._config.scanUpdateFrequency = DEFAULT_SCANUPDATE_FREQ;
    }

    try {
        this._stop().fin(function() {

            this._logger.info( this._config.tiltServo );

            /* setup servos */
            this._tiltServo = new Servo( this._config.tiltServo );
            this._panServo = new Servo( this._config.panServo );

            /* setup wiring pi */
            //_wiringPi.setup('wpi');
            _wiringPi.pinMode( this._config.tiltServo.pin, _wiringPi.PWM_OUTPUT );
            _wiringPi.pinMode( this._config.panServo.pin, _wiringPi.PWM_OUTPUT );
            _wiringPi.pinMode( this._config.cameraLightsPin, _wiringPi.OUTPUT );
            _wiringPi.pwmSetMode( _wiringPi.PWM_MODE_MS );
            _wiringPi.pwmSetClock( 375 );
            _wiringPi.pwmSetRange( 1024 );
            _wiringPi.pwmWrite( this._config.tiltServo.pin, this._config.tiltServo.minAngle );
            _wiringPi.pwmWrite( this._config.panServo.pin, this._config.panServo.minAngle );


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
    return def.promise.then(LeptonPanTiltCameraConnector.super_.prototype._start.bind(this));
};

/**
 * @class LeptonPanTiltCameraConnector
 * @method _stop
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._stop = function() {
    this._logger.info('Stopping connector');
    var def = _q.defer();
    try {
	    this._setEnableLights( false );

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
    return def.promise.then(LeptonPanTiltCameraConnector.super_.prototype._stop.bind(this));
};

/**
 * @class LeptonPanTiltCameraConnector
 * @method _tilt
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._tilt = function() {
     
     var angle = this._config.moves[ this._tiltServo.index ].tilt;
     this._tiltServo.move( angle, this._tiltFinished.bind(this));
};

/**
 * @class LeptonPanTiltCameraConnector
 * @method _tiltFinished
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._tiltFinished = function() {
     this._logger.info('_tiltFinished - ' + this._tiltServo.index + '/' + this._tiltServo.angle);

     var nPans = this._config.moves[ this._tiltServo.index ].pans.length;
     if (this._panServo.index > 0) 
     {
	    this._panServo.index = nPans-1;
        this._panServo.indexIncrement = -1;
     }
     else
     {
	    this._panServo.index = 0;
	    this._panServo.indexIncrement = 1;
     }
 
     this._pan();
};

/**
 * @class LeptonPanTiltCameraConnector
 * @method _pan
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._pan = function() {

     var tIndex = this._tiltServo.index;
     var pIndex  = this._panServo.index;

     var angle = this._config.moves[ tIndex ].pans[ pIndex];
     this._panServo.move( angle, this._panFinished.bind(this));

     this._logger.info('_pan - ' + pIndex + '/' + angle);
};

/**
 * @class LeptonPanTiltCameraConnector
 * @method _panFinished
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._panFinished = function() {
    this._logger.info('_panFinished - ' + this._panServo.index + '/' + this._panServo.angle);

    var pantilt = this;

    this._capture();

}

LeptonPanTiltCameraConnector.prototype._capture = function() {

    this._row = this._tiltServo.index;
    this._col = this._panServo.index;
    
    var pantilt = this;
    var payload = pantilt._captureIR();

    if (payload != null) 
    {

            if (!pantilt._config.rgbEnabled) 
            {
                pantilt.emit('data', payload);
                pantilt._captureFinished();
            }
            else 
            {
                pantilt._captureRGB( payload ).then(

                    function success(payload) 
                    {
                        pantilt.emit('data', payload);
                        pantilt._captureFinished();
                    },

                    function fail(results) 
                    {
                        pantilt._abortScan();
                    }
                );
            }
    } 
    else 
    {
        pantilt._resetCamera().then( function() {
            pantilt._abortScan();
        });
    }
}

/**
 * @class LeptonPanTiltCameraConnector
 * @method _captureFinished
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._captureFinished = function() {
    this._logger.info('_captureFinished');

    var tIndex = this._tiltServo.index;
    var pIndex = this._panServo.index;
    var nPans  = this._config.moves[ tIndex ].pans.length;

    var tNext  = tIndex + this._tiltServo.indexIncrement;
    var pNext  = pIndex + this._panServo.indexIncrement;

    /* reached the end of pan-sweep */
    if (pNext < 0 || pNext == nPans) 
    {
        /* reached the end of scan. */
        if (tNext < 0 || tNext == this._config.moves.length) 
        {
            this._scanFinished();
        }
        else 
        {
            this._tiltServo.index += this._tiltServo.indexIncrement;
            this._tilt();
        }
    }
    else 
    {
        this._panServo.index += this._panServo.indexIncrement;
	    this._pan();
    }
}

/**
 * @class LeptonPanTiltCameraConnector
 * @method _startScan
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._startScan = function() {
   this._logger.info('');
   this._logger.info('_startScan');

   this._scanning = true;
   this._scan = _shortId.generate();

   if (this._tiltServo.index > 0)
   {
        this._tiltServo.index = this._config.moves.length -1;
        this._tiltServo.indexIncrement = -1;
   }
   else
   {
        this._tiltServo.index = 0;
        this._tiltServo.indexIncrement = 1;  
   }

   this._tilt();

   if (this._scanUpdateTimer ==  null) 
   {
        this._scanUpdateTimer = setInterval( this._updateScan.bind(this), this._config.scanUpdateFrequency );
   }
}

/**
 * @class LeptonPanTiltCameraConnector
 * @method _abortScan
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._abortScan = function() {
   this._tiltServo.reset();
   this._panServo.reset();
   this._scanning = false;
   this._row = 0;
   this._col = 0;
}

/**
 * @class LeptonPanTiltCameraConnector
 * @method _scanFinished
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._scanFinished = function() {
    this._logger.info('_scanFinished scanid: ' + this._scan);
    this._scanning = false;
}

/**
 * @class LeptonPanTiltCameraConnector
 * @method _updateScan
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._updateScan = function() {

   // update the servos during active scans
   if (this._scanning) 
   {
	   this._tiltServo.update();
	   this._panServo.update();
   }
}

 /**
 * @class LeptonPanTiltCameraConnector
 * @method _process
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._process = function() {

     // do not interrupt active scan.
     if (this._scanning) 
     {
	    return;
     }

     // start a new scan.
     this._startScan();
}

/**
 * @class LeptonPanTiltCameraConnector
 * @method _captureIR
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._captureIR = function() {

    var deferred = _q.defer();

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
            delta: 0,

            col: this._col
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

        if(!abort) 
        {
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
                        lines: packets,
			            rgbdata: null 
                    }
                }
            };

            // save a copy of the thermal image to file
            if (this._config.saveToFile) 
            {
                this._irPacketsToFile( payload.data.camera.lines );
            }

            return payload;

        } 
        else 
        {
            var errorMsg = 'Error reading frame from camera. No data to send';
            this._logger.warn( errorMsg );
        }
    } 
    else 
    {
        this._logger.warn('Camera not initialized and ready');
    }

    return null;
};


LeptonPanTiltCameraConnector.prototype._captureRGB = function(payload) {

    var deferred = _q.defer();
    var pantilt = this;

	this._setEnableLights( true );

    var options = PiCamera.DEFAULT_PROFILE.opts;
    options.controls.flipVertical = false;
    options.settings.width = this._config.rgbWidth;;
    options.settings.height = this._config.rgbHeight;;
    options.settings.timeout = 1;
    options.preview = ['none'];

    if (pantilt._config.saveToFile) {
        var tIndex = pantilt._tiltServo.index;
        var pIndex = pantilt._panServo.index;
        var tAngle = pantilt._config.moves[ tIndex ].tilt;
        var pAngle = pantilt._config.moves[ tIndex ].pans[ pIndex ];
        options.settings.outputPath = "./data/rgb_image_" + tAngle + "_" + pAngle + ".jpg";
    }

    this._picam = new PiCamera( options );

    // take the picture
    pantilt._picam.takeJPG();

    // handle snapped event (i.e when the picture data is fully captured)
    pantilt._picam.on('snapped', function(results) 
    {
        pantilt._setEnableLights( false );
        payload.data.camera.rgbimage = results.image.toString('base64');
        return deferred.resolve(payload);
    }); 

    // handle errors
    pantilt._picam.on('error', function(results) 
    {
        pantilt._setEnableLights( false );
        return deferred.reject(results.error);
    }); 

	return deferred.promise	
};

LeptonPanTiltCameraConnector.prototype._setEnableLights = function( on ) {
  if (on) 
  {
    _wiringPi.digitalWrite(this._config.cameraLightsPin, _wiringPi.HIGH);
  }
  else
  {
    _wiringPi.digitalWrite(this._config.cameraLightsPin, _wiringPi.LOW);
  }
};

LeptonPanTiltCameraConnector.prototype._irPacketsToFile = function( packets ) {

    var tIndex = this._tiltServo.index;
    var pIndex = this._panServo.index;
    var tAngle = this._config.moves[ tIndex ].tilt;
    var pAngle = this._config.moves[ tIndex ].pans[ pIndex ];
    var path   = "./data/ir_image_" + tAngle + "_" + pAngle + ".dat";

    _fs.writeFile(path, JSON.stringify(packets), 
        function(err) 
        {   
           if(err) 
           {   
                console.log( err );
           }
        }
    );
} // packetsToFile


module.exports = LeptonPanTiltCameraConnector;
