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
//var PiCameraOptions = require('../utils/node-picam/lib/StillOptions').Options;

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
   this.angle = 0;
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
   //console.log('writing angle: ' + this.angle + ' to pin: ' + this.config.pin);

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

    this._updateCount = 0;
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
    //var camera = this._camera;
    //this._camera = null;

    this._logger.info('Starting camera reset');
    _wiringPi.digitalWrite(this._config.cameraResetPin, 0);
    setTimeout(function() {
        this._logger.info('Camera reset complete');
        _wiringPi.digitalWrite(this._config.cameraResetPin, 1);
        //this._camera = camera;
    }.bind(this), this._config.cameraResetTimeout);
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

    if(typeof this._config.recaptureMaxRetries !== 'number' ||
        this._config.recaptureMaxRetries <= 0) {
        this._config.recaptureMaxRetries = DEFAULT_RECAPTURE_MAXTRIES;
    }

    if(typeof this._config.recaptureTime !== 'number' ||
        this._config.recaptureTime <= 0) {
        this._config.recaptureTime = DEFAULT_RECAPTURE_DELAY;
    }

    try {
        this._stop().fin(function() {

            this._logger.info( this._config.tiltServo );

	    /* setup servos */
	    console.log('----iinitializing servos...');
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

     this._logger.info('_tilt - ' +  this._tiltServo.index + '/' + angle);
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

    //this._tryCapture();
    this._capture();
}

/**
 * @class LeptonPanTiltCameraConnector
 * @method _tryCapture
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._capture = function() {

    var pantilt = this;

    if (this._camera == null) return;

    var tIndex = this._tiltServo.index;
    var pIndex = this._panServo.index;
    var tAngle = this._tiltServo.angle;
    var pAngle = this._panServo.angle;

    this._logger.info('_capture - tilt: '+ tIndex + '/' + tAngle + ' pan: ' + pIndex + '/' + pAngle );

    this._row = tIndex;
    this._col = pIndex;

    // First capture the IR Image.
    var payload = pantilt._doIRCapture();
    
    if (payload == null) 
    {
        pantilt._abortScan();
        return;
    }
    else if (!pantilt._config.rgbEnabled)
    {
        pantilt._logger.info('Emitting sensor data for node');
        pantilt.emit('data', payload);
        pantilt._captureFinished();
        return;
    }

    var rgbPromise = pantilt._doRGBCapture();

    rgbPromise.then(
        function success(image) {
            pantilt._logger.info('Emitting sensor data for node');
            payload.data.camera.rgbimage = image;
            pantilt.emit('data', payload);
            pantilt._captureFinished();
        },
        function fail(error) {
            pantilt._logger.info('Fail to capture RGB image.  Error: ' + error);
            pantilt._abortScan();
        }
    );
};

/**
 * @class LeptonPanTiltCameraConnector
 * @method _captureFinished
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._captureFinished = function() {
    this._logger.info('_captureFinished');

    var tIndex = this._tiltServo.index;
    var pIndex = this._panServo.index;
    var nPans = this._config.moves[ tIndex ].pans.length;

    var tNext = tIndex + this._tiltServo.indexIncrement;
    var pNext = pIndex + this._panServo.indexIncrement;

    /* reached the end of pan-sweep */
    if (pNext < 0 || pNext == nPans) {
	
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
   this._logger.info('---------------------');
   this._logger.info('_startScan');

   this._scanning = true;
   this._scan = _shortId.generate();

   this._logger.info('tilt: ' + this._tiltServo.index + '/' + this._tiltServo.angle);
   this._logger.info('pan: ' + this._panServo.index + '/' + this._panServo.angle);

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

   if (this._scanUpdateTimer ==  null) {
   	this._scanUpdateTimer = setInterval( this._updateScan.bind(this), this._config.scanUpdateFrequency );
   }
}

/**
 * @class LeptonPanTiltCameraConnector
 * @method _abortScan
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._abortScan = function() {
   this._logger.info('_abortScan');

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

   this._updateCount += 1;

   if (this._scanning) 
   {
	   this._tiltServo.update();
	   this._panServo.update();
   }

   //this._scanUpdateTimer = setTimeout( this._updateScan.bind(this), this._config.scanUpdateFrequency );
}

 /**
 * @class LeptonPanTiltCameraConnector
 * @method _process
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._process = function() {

     this._logger.info('_process scanning: ' + this._scanning + ' updatecounts: ' + this._updateCount);
     this._updateCount = 0;

     if (this._scanning) 
     {
	return;
     }

     // start scan process
     this._startScan();
}

 /**
 * @class LeptonPanTiltCameraConnector
 * @method __doIRCapture
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._doIRCapture = function() {

     this._logger.info("_doIRCapture");

     var data = null;
     while(true)
     {
        data = this._captureIR();
        if (data != null) {
            break;
        }

        if (this._captureRetries == this._config.recaptureMaxRetries) {
            this._logger.info('Maximum recapture retries reached - aborting scan.');
            break;
        }

        console.log('trying ...', this._captureRetries);
        setTimeout(this._doIRCapture.bind(this), this._config.recaptureTime);
        this._captureRetries += 1;
     }

     return data;
};


/**
 * @class LeptonPanTiltCameraConnector
 * @method _process
 * @protected
 */
LeptonPanTiltCameraConnector.prototype._captureIR = function() {

    this._logger.info('_captureIR scan: '+ this._scan + ' row: '+ this._row + ' col: ' + this._col);

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
	    scan: this._scan,
            row: this._row,
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
                        lines: packets,
			rgbdata: null 
                    }
                }
            };

            //this._logger.info('Emitting sensor data for node');
            //this.emit('data', payload);

            return payload;

        } else {
            this._logger.warn('Error reading frame from camera. No data to send');
            this._resetCamera();
        }
    } else {
        this._logger.warn('Camera not initialized and ready');
    }

    return null;
};


LeptonPanTiltCameraConnector.prototype._doRGBCapture = function() {

	this._logger.info("_doRGBCapture()");

    var deferred = _q.defer();
    var pantilt = this;

	this._setEnableLights( true );

    var options = PiCamera.DEFAULT_PROFILE.opts;
    options.controls.flipVertical = false;
    options.settings.width = this._config.rgbWidth;;
    options.settings.height = this._config.rgbHeight;;
    this._picam = new PiCamera( options );

    // take the picture
    pantilt._picam.takeJPG();

    // handle snapped event (i.e when the picture data is fully captured)
    pantilt._picam.on('snapped', function(results) 
    {
        pantilt._setEnableLights( false );
        return deferred.resolve(results.image);
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

module.exports = LeptonPanTiltCameraConnector;
