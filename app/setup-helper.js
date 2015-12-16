/* jshint node:true */
'use strict';

var _q = require('q');
var _fs = require('fs');
var _util = require('util');
var _clone = require('clone');

var _macAddress = require('macaddress');
var _loggerProvider = require('./logger-provider');

var logger = _loggerProvider.getLogger('setup-helper');

function checkIfConfigExists() {
    logger.debug('Checking if config file already exists: [%s]', GLOBAL.config.cfg_config_file);
    var def = _q.defer();
    _fs.stat(GLOBAL.config.cfg_config_file, function(err, data) {
        if(!err) {
            def.resolve();
        } else {
            def.reject();
        }
    });

    return def.promise;
}

function getBaselineConfig(dataBag) {
    logger.debug('Obtaining baseline configuration from: [%s]', GLOBAL.config.cfg_baseline_config_file);
    var def = _q.defer();
    _fs.readFile(GLOBAL.config.cfg_baseline_config_file, function(err, data) {
        if(err) {
            logger.error('Error reading baseline configuration file: [%s]', err);
            return def.reject(err);
        }
        try {
            var config = JSON.parse(data);
            dataBag.config = {
                connectorTypes: _clone(config.connectorTypes),
                deviceConnectors: {},
                cloudConnectors: {}
            };
            def.resolve(dataBag);
        } catch(ex) {
            logger.error('Error parsing baseline configuration file: [%s]', ex);
            def.reject(ex);
        }
    });

    return def.promise;
}

function getMacAddress(dataBag) {
    logger.debug('Obtaining mac address for interface: [%s]', GLOBAL.config.cfg_default_network_interface);
    var def = _q.defer();
    _macAddress.one(GLOBAL.config.cfg_default_network_interface, function(err, mac) {
        var message = '';
        if(err) {
            message = _util.format('Error obtaining mac address for interface [%s]. Details: [%s]', GLOBAL.config.cfg_default_network_interface, err);
            logger.error(message);
            return def.reject(err);
        }
        if(typeof mac !== 'string' || mac.length <= 0) {
            message = _util.format('Unable to read the mac address for interface [%s]', GLOBAL.config.cfg_default_network_interface);
            logger.error(message);
            return def.reject(message);
        }

        dataBag.mac = mac.replace(/:/g, '').toUpperCase();
        def.resolve(dataBag);
    });

    return def.promise;
}

function createConnectorConfig(dataBag) {
    logger.debug('Generating connector configuration');
    var config = dataBag.config;
    //TODO: This condition has been temporarily disabled, pending an updated on 
    //the server. The "&& false" below needs to be removed once the server has
    //been updated.
    var mqttHost = (process.env.NODE_ENV === 'production' && false)? 'api-iot.analoggarage.com':
                                                            'api-iot-dev.analoggarage.com';
    var cloudConnectorName = 'cnc-cloud-' + dataBag.mac;
    config.cloudConnectors[cloudConnectorName] = {
        type: 'CncCloud',
        config: {
            host: mqttHost,
            port: 8443,
            protocol: 'mqtts',
            networkInterface: GLOBAL.config.cfg_default_network_interface,
            gatewayname: dataBag.mac,
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            topics: ''
        }
    };

    var deviceConnectorName = 'cnc-gateway-' + dataBag.mac;
    config.deviceConnectors[deviceConnectorName] = {
        type: 'CncGateway',
        config: {}
    };

    return dataBag;
}

function writeConnectorConfig(dataBag) {
    logger.debug('Writing configuration to file: [%s]', GLOBAL.config.cfg_config_file);
    var def = _q.defer();
    var payload = JSON.stringify(dataBag.config, null, 4);
    _fs.writeFile(GLOBAL.config.cfg_config_file, payload, function(err, data) {
        if(err) {
            logger.error('Error writing configuration to file. Details: [%s]', err);
            return def.reject(err);
        } 

        return def.resolve();
    });

    return def.promise;
}

function createDefaultConfiguration() {
    return getBaselineConfig({})
            .then(getMacAddress)
            .then(createConnectorConfig)
            .then(writeConnectorConfig);
}

module.exports = {
    /**
     * Ensures that a valid configuration file exists for the client program.
     * If a configuration file was not found at the specified path, a new,
     * default configuration file will be generated for the current node.
     *
     * @module setupHelper
     * @method ensureConfig
     * @return {Object} A promise that will be rejected or resolved based on 
     *          the read operation.
     */
    ensureConfig: function() {
        return checkIfConfigExists()
        .then(function() {
            logger.info('Configuration file exists at: [%s]', GLOBAL.config.cfg_config_file);
        }, createDefaultConfiguration);
    }
};
