/* jshint node:true */
'use strict';

var _util = require('util');
var _net = require('net');
var _tls = require('tls');
var _q = require('q');
var _mqtt = require('mqtt');
var Connector = require('iot-client-lib').Connector;
var _networkUtils = require('../utils/network');

/**
 * Connector that uses MQTT to communicate with sensors connected to a
 * common MQTT broker.
 *
 * @class MqttConnector
 * @constructor
 * @param {String} id A unique id for the connector
 */
function MqttConnector(id) {
    MqttConnector.super_.call(this, id)

    this._client = null;
}

_util.inherits(MqttConnector, Connector);

/**
 * @class MqttConnector
 * @method _validate
 * @private
 */
MqttConnector.prototype._validate = function() {
    if (typeof this._config.host !== 'string' ||
        this._config.host.length <= 0) {
        return 'Connector configuration does not define a valid mqtt host';
    }

    if (typeof this._config.port !== 'number' ||
               this._config.port <= 0) {
        return 'Connector configuration does not define a valid mqtt port number';
    }
    
    if (typeof this._config.username !== 'string' ||
               this._config.username.length <= 0) {
        return 'Connector configuration does not define a valid mqtt username';
    }
    
    if (typeof this._config.networkInterface !== 'string' ||
               this._config.networkInterface.length <= 0) {
        return 'Connector configuration does not define a valid network interface for mqtt';
    }
    
    if (typeof this._config.password !== 'string' ||
               this._config.password.length <= 0) {
        return 'Connector configuration does not define a valid mqtt password';
    }
    
    if (typeof this._config.topics !== 'string' ||
               this._config.topics.length <= 0) {
        return 'Connector configuration does not define a valid mqtt topics';
    }

    if (typeof this._config.protocol !== 'string' || this._config.protocol.length <= 0) {
        this._config.protocol = 'mqtt';
    }

    return '';
};

/**
 * @class MqttConnector
 * @method _setupSubscriptions
 * @private
 */
MqttConnector.prototype._setupSubscriptions = function() {
    var topics = this._config.topics.split(';');
    topics.forEach(function(topic) {
        this._client.subscribe(topic);
        this._logger.info('Subscribed to topic: [%s]', topic);
    }.bind(this));
};

/**
 * @class MqttConnector
 * @method _publish
 * @private
 */
MqttConnector.prototype._publish = function(topic, message, qos) {
    if(typeof topic !== 'string' || topic.length <= 0) {
        this._logger.error('Invalid topic specified. Message will not be published [%s::%s]', topic, message);
        return;
    }
    if(typeof message !== 'string' || message.length <= 0) {
        this._logger.error('Invalid message specified. Message will not be published [%s::%s]', topic, message);
        return;
    }
    if(typeof qos !== 'number' || qos > 2 || qos < 0) {
        qos = 1;
    }
    if(this._client) {
        this._client.publish(topic, message, {qos: qos});
    }
};


/**
 * @class MqttConnector
 * @method _processBrokerMessage
 * @private
 */
MqttConnector.prototype._processBrokerMessage = function(topic, message) {
    //Do nothing - let inheriting classes override functionality
    //as necessary.
    this._logger.warn('_processBrokerMessage() not implemented');
};


/**
 * @class MqttConnector
 * @method _initClient
 * @private
 */
MqttConnector.prototype._initClient = function() {
    var localAddress = _networkUtils.getIPv4Address(this._config.networkInterface);

    this._logger.debug('Local network interface: [%s:%s]',
                                this._config.networkInterface, localAddress);
    var sockLib = (this._config.protocol === 'mqtt')? _net:_tls;
    this._client = new _mqtt.Client(function() {
        return sockLib.connect({
            host: this._config.host,
            port: this._config.port,
            localAddress: localAddress
        });
    }.bind(this), {
        clientId: this._id,
        username: this._config.username,
        password: this._config.password
    });

    this._client.on('connect', function() {
        this._logger.info('Connected to mqtt broker at: [%s://%s:%s]',
                                            this._config.protocol, this._config.host,
                                            this._config.port);
        this._setupSubscriptions();
    }.bind(this));

    this._client.on('close', function() {
        this._logger.info('Closed connection to mqtt broker at: [%s://%s:%s]',
                                            this._config.protocol, this._config.host,
                                            this._config.port);
    }.bind(this));

    this._client.on('message', function(topic, message) {
        this._logger.info('Message received: [%s:%s]', topic, message.toString());
        this._processBrokerMessage(topic, message);

    }.bind(this));
};

/**
 * @class MqttConnector
 * @method _start
 * @protected
 */
MqttConnector.prototype._start = function() {
    var def = _q.defer();
    var error = this._validate();
    if(error) {
        this._logger.error('Error validating connector configuration: [%s]', error);
        def.reject(error);
    } else {
        this._stop().fin(function() {
            try {
                this._initClient();
                def.resolve();
            } catch(ex) {
                def.reject(ex);
            }
        }.bind(this));
    }
    return def.promise;
};

/**
 * @class MqttConnector
 * @method _stop
 * @protected
 */
MqttConnector.prototype._stop = function() {
    var def = _q.defer();
    if (this._client) {
        this._logger.info('Stopping connector');
        this._client.end(function(err){
            this._logger.info('Client stopped [%s]', err);
            def.resolve();
            this._client = null;
        }.bind(this));
    } else {
        this._logger.info('MQTT client is not running');
        def.resolve();
    }
    return def.promise;
};

module.exports = MqttConnector;
