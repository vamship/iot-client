/* jshint node:true */
'use strict';

var _os = require('os');
var _childProcess = require('child_process');
var _q = require('q');

var COMMAND_MAP = {
    update_gateway: {
        linux: {  command: 'npm', args: [ 'update', '-g', '--unsafe-perm', 'iot-client' ] },
        darwin: { command: 'npm', args: [ 'update', '-g', 'iot-client' ] }
    },
    reboot: {
        linux: { command: 'shutdown', args: [ '-r', '+1' ] },
        darwin: { command: 'echo', args: [ 'mock: reboot' ] }
    },
    enable_hostapd: {
        linux: { command: 'update-rc.d', args: [ 'hostapd', 'enable' ] },
        darwin: { command: 'echo', args: [ 'mock: hostapd enable' ] }
    },
    disable_hostapd: {
        linux: { command: 'update-rc.d', args: [ 'hostapd', 'disable' ] },
        darwin: { command: 'echo', args: [ 'mock: hostapd disable' ] }
    },
    enable_dhcpd: {
        linux: { command: 'update-rc.d', args: [ 'isc-dhcp-server', 'enable' ] },
        darwin: { command: 'echo', args: [ 'mock: dhcp enable' ] }
    },
    disable_dhcpd: {
        linux: { command: 'update-rc.d', args: [ 'isc-dhcp-server', 'disable' ] },
        darwin: { command: 'echo', args: [ 'mock: dhcp disable' ] }
    }
};

/**
 * Executor object that can be used to execute shell commands for specific
 * actions, in a platform agnostic way.
 *
 * @class CommandExecutor
 * @constructor
 * @param {Object} logger Reference to a logger object that can be used
 *          for logging on behalf of the calling module.
 */
function CommandExecutor(logger) {
    if(!logger || typeof logger !== 'object') {
        throw new Error('Invalid logger specified (arg #1)');
    }
    this._logger = logger;
    this._platform = _os.platform();
};

/**
 * @class CommandExecutor
 * @method _getCommandInfo
 * @private
 */
CommandExecutor.prototype._getCommandInfo = function(command) {
    var cmdInfo = COMMAND_MAP[command];
    if(!cmdInfo) {
        this._logger.error('Unable to locate command: [%s]', command);
        return null;
    }
    cmdInfo = cmdInfo[this._platform];
    if(!cmdInfo) {
        this._logger.error('Command [%s] not defined for current platform: [%s]', command, this._platform);
        return null;
    }

    return cmdInfo;
};

/**
 * @class CommandExecutor
 * @method _runCommand
 * @private
 */
CommandExecutor.prototype._runCommand = function(command, suppressLogs) {
    suppressLogs = !!suppressLogs;
    var commandInfo = this._getCommandInfo(command);

    var def = _q.defer();
    if(!commandInfo) {
        def.reject('Command not supported on current platform');
        return def.promise;
    }

    var command = commandInfo.command;
    var args = commandInfo.args;
    if(!(args instanceof Array)) {
        args = [];
    }

    this._logger.info('Executing command: [%s][%s]', command, args);
    var proc = _childProcess.spawn(command, args);

    if(!suppressLogs) {
        this._logger.debug('Enabling output/error logs for command: [%s][%s]', command, args);
        proc.stdout.on('data', function(data) {
            this._logger.info('[%s] [STDOUT]', data.toString());
        }.bind(this));

        proc.stderr.on('data', function(data) {
            this._logger.error('[%s] [STDERR]', data.toString());
        }.bind(this));
    }

    proc.on('error', function(error) {
        var message = _util.format('Error running command: [%s] [%s]. Error: [%s]', command, args, error)
        this._logger.error(message);
        return def.reject(message);
    }.bind(this));

    proc.on('close', function(code) {
        if(!code) {
            this._logger.info('Command completed successfully: [%s] [%s]. Exit code: [%s]', command, args, code);
            return def.resolve();
        }
        var message = _util.format('Command exited with non zero code: [%s] [%s]. Exit code: [%s]', command, args, code);
        this._logger.error(message);
        return def.reject(message);
    }.bind(this));

    return def.promise;
};

/**
 * Runs a command that will upgrade the current gateway agent program.
 *
 * @class CommandExecutor
 * @method upgradeAgent
 * @param {String} [requestId] An optional request id
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the write operation.
 */
CommandExecutor.prototype.upgradeAgent = function(requestId) {
    this._logger.info('Upgrading iot client program. RequestId: [%s]', requestId);

    return this._runCommand('update_gateway').then(function() {
        this._logger.info('Agent upgrade completed successfully. RequestId: [%s]', requestId);
    }.bind(this), function(err) {
        this._logger.error('Agent upgrade failed. RequestId: [%s]', requestId, err);
        throw err;
    }.bind(this));
};

/**
 * Reboots the system.
 *
 * @class CommandExecutor
 * @method reboot
 * @param {String} [requestId] An optional request id
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the write operation.
 */
CommandExecutor.prototype.reboot = function(requestId) {
    this._logger.info('Rebooting current system. RequestId: [%s]', requestId);

    return this._runCommand('reboot').then(function() {
        this._logger.info('Reboot command issued successfully. RequestId: [%s]', requestId);
    }.bind(this), function(err) {
        this._logger.error('Failed issuing reboot command. RequestId: [%s]', requestId, err);
        throw err;
    }.bind(this));
};

/**
 * Enables auto start of the local access point daemon on boot.
 *
 * @class CommandExecutor
 * @method enableHostAP
 * @param {String} [requestId] An optional request id
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the write operation.
 */
CommandExecutor.prototype.enableHostAP = function(requestId) {
    this._logger.info('Enabling auto start of host ap daemon. RequestId: [%s]', requestId);

    return this._runCommand('enable_hostapd').then(function() {
        this._logger.info('Host AP daemon successfully enabled for auto start or boot. RequestId: [%s]', requestId);
    }.bind(this), function(err) {
        this._logger.error('Error enabling host AP daemon for auto start on boot. RequestId: [%s]', requestId, err);
        throw err;
    }.bind(this));
};

/**
 * Disables auto start of the local access point daemon on boot.
 *
 * @class CommandExecutor
 * @method disableHostAP
 * @param {String} [requestId] An optional request id
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the write operation.
 */
CommandExecutor.prototype.disableHostAP = function(requestId) {
    this._logger.info('Disabling auto start of host ap daemon. RequestId: [%s]', requestId);

    return this._runCommand('disable_hostapd').then(function() {
        this._logger.info('Host AP daemon successfully disabled from auto starting or boot. RequestId: [%s]', requestId);
    }.bind(this), function(err) {
        this._logger.error('Error disabling host AP daemon from auto starting on boot. RequestId: [%s]', requestId, err);
        throw err;
    }.bind(this));
};

/**
 * Enables auto start of the local dhcp daemon on boot.
 *
 * @class CommandExecutor
 * @method enableDhcp
 * @param {String} [requestId] An optional request id
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the write operation.
 */
CommandExecutor.prototype.enableDhcp = function(requestId) {
    this._logger.info('Enabling auto start of dhcp daemon. RequestId: [%s]', requestId);

    return this._runCommand('enable_dhcpd').then(function() {
        this._logger.info('DHCP daemon successfully enabled for auto start or boot. RequestId: [%s]', requestId);
    }.bind(this), function(err) {
        this._logger.error('Error enabling dhcp daemon for auto start on boot. RequestId: [%s]', requestId, err);
        throw err;
    }.bind(this));
};

/**
 * Disables auto start of the local dhcp daemon on boot.
 *
 * @class CommandExecutor
 * @method disableDhcp
 * @param {String} [requestId] An optional request id
 * @return {Object} A promise that will be rejected or resolved based on 
 *          the write operation.
 */
CommandExecutor.prototype.disableDhcp = function(requestId) {
    this._logger.info('Disabling auto start of dhcp daemon. RequestId: [%s]', requestId);

    return this._runCommand('disable_dhcpd').then(function() {
        this._logger.info('DHCP daemon successfully disabled from auto starting or boot. RequestId: [%s]', requestId);
    }.bind(this), function(err) {
        this._logger.error('Error disabling dhcp daemon from auto starting on boot. RequestId: [%s]', requestId, err);
        throw err;
    }.bind(this));
};

module.exports =  CommandExecutor;
