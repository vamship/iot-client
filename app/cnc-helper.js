/* jshint node:true */
'use strict';

var _fs = require('fs');
var _path = require('path');
var _q = require('q');
var _childProcess = require('child_process');
var _touch = require('touch');

var _loggerProvider = require('./logger-provider');
var logger = _loggerProvider.getLogger('app');

var _cncFilePath = _path.resolve(GLOBAL.config.cfg_watch_dir, 'cnc.json'); 

module.exports = {

    /**
     * Reads and parses the cnc file.
     *
     * @module cncHelper
     * @method readLastCncAction
     * @return {Object} A promise that will be rejected or resolved based on 
     *          the read operation.
     */
    readLastCncAction: function() {
        var def = _q.defer();

        logger.debug('Reading cnc info file: [%s]', _cncFilePath);
        _fs.readFile(_cncFilePath, function(err, data) {
            if(err) {
                logger.warn('Error reading cnc file: [%s]', _cncFilePath, err);
                return def.reject('Error reading cnc file: ' + err.toString());
            }
            try {
                logger.info('Parsing contents of cnc file');
                return def.resolve(JSON.parse(data));
            } catch(ex) {
                logger.warn('Unable to parse contents of cnc info', ex);
                return def.reject('Unable to parse contents of cnc info' + ex.toString());
            }
        });

        return def.promise;
    },

    /**
     * Writes data to the cnc file.
     *
     * @module cncHelper
     * @method writeCncAction
     * @param {String} action The action to write
     * @param {String} [requestId] An optional request id
     * @return {Object} A promise that will be rejected or resolved based on 
     *          the write operation.
     */
    writeCncAction: function(action, requestId) {
        var payload = {
            action: action,
            requestId: requestId || '',
            timestamp: Date.now()
        };
        payload = JSON.stringify(payload);

        var def = _q.defer();

        logger.debug('Writing cnc info to file: [%s] [%s]', payload, _cncFilePath);
        _fs.writeFile(_cncFilePath, payload, function(err, data) {
            if(err) {
                logger.warn('Error writing cnc file: [%s]', _cncFilePath, err);
                return def.reject('Error writing cnc file: ' + err.toString());
            }
            logger.info('Cnc file successfully updated');
            def.resolve('Cnc file successfully updated');
        });

        return def.promise;
    },

    /**
     * Runs a command that will upgrade the current package.
     *
     * @module cncHelper
     * @method upgradeProgram
     * @param {String} [requestId] An optional request id
     * @return {Object} A promise that will be rejected or resolved based on 
     *          the write operation.
     */
    upgradeProgram: function(requestId) {
        var def = _q.defer();

        var args = [ 'update', '-g', 'iot-client' ];

        logger.debug('Upgrading iot client program. RequestId: [%s]', requestId);
        var upgradeProcess = _childProcess.spawn('npm', args);

        upgradeProcess.on('error', function(error) {
            logger.error('Error running upgrade process: [%s]. RequestId: [%s]', error, requestId);
            return def.reject('Error running upgrade process: [' + error + ']. RequestId: [' + requestId + ']');
        });

        upgradeProcess.on('close', function(code) {
            if(!code) {
                logger.info('Upgrade process completed successfully, with code: [%s]. RequestId: [%s]', code, requestId);
                return def.resolve();
            }
            logger.error('Upgrade process exited with non zero code: [%s]. RequestId: [%s]', code, requestId);
            return def.reject('Upgrade process exited with non zero code: [' + code + ']. RequestId: [' + requestId + ']');
        });

        return def.promise;
    },

    /**
     * Touches a file that is watched by an externall process, triggering restart.
     * This is a synchronous operation that will block until completed.
     *
     * @module cncHelper
     * @method touchRestartFile
     */
    touchRestartFile: function() {
        _touch.sync(_cncFilePath, { force: true });
    }
};
