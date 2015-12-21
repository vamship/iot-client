/* jshint node:true */
'use strict';

var _os = require('os');
var _fs = require('fs');
var _path = require('path');
var _util = require('util');
var _q = require('q');

var _networkUtils = require('../utils/network');

var CONFIG_PATHS = {
    hostapd_conf: {
        linux: '/etc/hostapd/hostapd.conf',
        darwin: _path.resolve('./.tmp/hostapd.conf')
    },
    gateway_agent_conf: {
        linux: GLOBAL.config.cfg_config_file,
        darwin: GLOBAL.config.cfg_config_file
    }
};

/**
 * Helper objects that can be used to generate different configuration files.
 *
 * @class ConfigBuilder
 * @constructor
 * @param {Object} logger Reference to a logger object that can be used
 *          for logging on behalf of the calling module.
 */
function ConfigBuilder(logger) {
    if(!logger || typeof logger !== 'object') {
        throw new Error('Invalid logger specified (arg #1)');
    }
    this._logger = logger;
    this._platform = _os.platform();
    var ifaceInfo = _os.networkInterfaces()[GLOBAL.config.cfg_outbound_network_interface];
    var message = '';
    if(!ifaceInfo) {
        message = _util.format('Outbound network interface [%s] does not exist',
                                            GLOBAL.config.cfg_outbound_network_interface);
        this._logger.error(message);
        throw new Error(message);
    }

    this._gatewayId = ifaceInfo[0].mac.replace(/:/g, '').toUpperCase();
    this._localNetworkIP = _networkUtils.getIPv4Address(GLOBAL.config.cfg_local_network_interface);
    if(typeof this._localNetworkIP !== 'string' || this._localNetworkIP.length <= 0) {
        message = _util.format('Unable to obtain local ip address for interface: [%s]', 
                                            GLOBAL.config.cfg_local_network_interface);
        this._logger.error(message);
        throw new Error(message);
    }
};

/**
 * @class ConfigBuilder
 * @method _getConfigPath
 * @private
 */
ConfigBuilder.prototype._getConfigPath = function(target) {
    var configInfo = CONFIG_PATHS[target];
    if(!configInfo) {
        this._logger.error('Unable to determine config file path for target: [%s]', target);
        return null;
    }
    configInfo = configInfo[this._platform];
    if(!configInfo) {
        this._logger.error('Config target [%s] not defined for current platform: [%s]', target, this._platform);
        return null;
    }

    return configInfo;
};

/**
 * @class ConfigBuilder
 * @method _readExistingConfig
 * @private
 */
ConfigBuilder.prototype._readExistingConfig = function(path, parse) {
    parse = !!parse;
    this._logger.debug('Obtaining existing configuration from: [%s]', path);
    var def = _q.defer();
    _fs.readFile(path, function(err, data) {
        if(err) {
            this._logger.error('Error reading existing configuration file: [%s]', err);
            return def.reject(err);
        }
        if(parse) {
            try {
                var config = JSON.parse(data);
                def.resolve(config);
            } catch(ex) {
                this._logger.error('Error parsing existing configuration file: [%s]', ex);
                def.reject(ex);
            }
        } else {
            def.resolve(data);
        }
    }.bind(this));

    return def.promise;
}

/**
 * @class ConfigBuilder
 * @method _ensureConfig
 * @private
 */
ConfigBuilder.prototype._ensureConfig = function(target) {
    var def = _q.defer();

    var path = this._getConfigPath(target);
    if(!path) {
        def.reject('Config file is not applicable on current platform');
        return def.promise;
    }

    var components = _path.parse(path);
    var dir = components.dir;
    _fs.stat(components.dir, function(err, stats) {
        if(err) {
            var message = _util.format('Unable to find directory: [%s]', components.dir, err);
            this._logger.error(message);
            def.reject(message);
            return;
        }
        this._logger.debug('Parent directory for file exists: [%s]', path);
        def.resolve(path);
    }.bind(this));

    return def.promise;
};

/**
 * @class ConfigBuilder
 * @method _writeConfig
 * @private
 */
ConfigBuilder.prototype._writeConfig = function(target, data) {
    var def = _q.defer();

    this._ensureConfig(target).then(function(path) {
        this._logger.debug('Writing config data to file: [%s]', path);
        _fs.writeFile(path, data, function(err) {
            if(err) {
                var message = _util.format('Error writing to file: [%s]', path, err);
                this._logger.error(message);
                def.reject(message);
            }
            this._logger.info('Config file written successfully: [%s]', path);
            this._logger.debug('Config data: [%s]', data.toString());
            def.resolve();
        }.bind(this))
    }.bind(this));

    return def.promise;
};

/**
 * Generates and writes configuration for the local host ap daemon.
 *
 * @class ConfigBuilder
 * @method generateHostApConfig
 * @param {String} [requestId] An optional request id
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the write operation.
 */
ConfigBuilder.prototype.generateHostApConfig = function(requestId) {
    this._logger.debug('Generating host ap configuration. RequestId: [%s]', requestId);

    var config = [
        'interface=wlan0',
        '',
        'ssid=' + this._gatewayId,
        'wpa_passphrase=whereforeartthou',
        'channel=6',
        '',
        'wmm_enabled=1',
        'wpa=1',
        'wpa_key_mgmt=WPA-PSK',
        'wpa_pairwise=TKIP',
        'rsn_pairwise=CCMP',
        'macaddr_acl=0',
        'auth_algs=1',
    ];

    return this._writeConfig('hostapd_conf', config.join('\n')).then(function() {
        this._logger.info('Host AP configuration updated successfully. RequestId: [%s]', requestId);
    }.bind(this), function(err) {
        this._logger.error('Error updating host ap configuration. RequestId: [%s]', requestId, err);
        throw err;
    }.bind(this));
};

/**
 * Generates and writes configuration for the gateway agent.
 *
 * @class ConfigBuilder
 * @method generateGatewayAgentConfig
 * @param {String} [requestId] An optional request id
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the write operation.
 */
ConfigBuilder.prototype.generateGatewayAgentConfig = function(requestId) {
    this._logger.debug('Generating gateway agent configuration. RequestId: [%s]', requestId);
    return this._readExistingConfig(GLOBAL.config.cfg_baseline_config_file, true)
        .then(function(config) {
            var newConfig = {
                connectorTypes: config.connectorTypes,
                deviceConnectors: {},
                cloudConnectors: {}
            };

            var cloudConnectorName = 'cnc-cloud-' + this._gatewayId;
            newConfig.cloudConnectors[cloudConnectorName] = {
                type: 'CncCloud',
                config: {
                    host: this._localNetworkIP,
                    port: 1883,
                    protocol: 'mqtt',
                    networkInterface: GLOBAL.config.cfg_local_network_interface,
                    gatewayname: this._gatewayId,
                    topics: ''
                }
            };

            var deviceConnectorName = 'cnc-device-' + this._gatewayId;
            newConfig.deviceConnectors[deviceConnectorName] = {
                type: 'CncGateway',
                config: {}
            };

            return newConfig;
        }.bind(this)).then(function(config) {
            var payload = JSON.stringify(config, null, 4);
            this._writeConfig('gateway_agent_conf', payload);
        }.bind(this)).then(function() {
            this._logger.info('Gateway agent configuration updated successfully. RequestId: [%s]', requestId);
        }.bind(this), function(err) {
            this._logger.error('Error updating gateway agent configuration. RequestId: [%s]', requestId, err);
        }.bind(this));
};

module.exports =  ConfigBuilder;
