'use strict';

const _clone = require('clone');
// Using "let" to enable testing via rewire
let _awsIotSdk = require('aws-iot-device-sdk');
const Promise = require('bluebird').Promise;

const _loggerProvider = require('../logger-provider');

/**
 * A manager class for device shadows on AWS IoT. Creates and wraps a shadow
 * object, and provides a clean wrapper for request/response over MQTT with
 * retry capabilities.
 */
class AwsShadowManager {
    /**
     * @param {Object} config A configuration object that defines connection
     *          information for the CnC connector.
     */
    constructor(config) {
        if (!config || (config instanceof Array) || typeof config !== 'object') {
            throw new Error('Invalid config specified (arg #1)');
        }
        if (typeof config.certPath !== 'string' || config.certPath.length <= 0) {
            throw new Error('Configuration does not define a valid certPath property');
        }
        if (typeof config.keyPath !== 'string' || config.keyPath.length <= 0) {
            throw new Error('Configuration does not define a valid keyPath property');
        }
        if (typeof config.caPath !== 'string' || config.caPath.length <= 0) {
            throw new Error('Configuration does not define a valid caPath property');
        }
        if (typeof config.clientId !== 'string' || config.clientId.length <= 0) {
            throw new Error('Configuration does not define a valid clientId property');
        }
        if (typeof config.region !== 'string' || config.region.length <= 0) {
            throw new Error('Configuration does not define a valid region property');
        }

        this._config = _clone(config);
        this._shadow = null;
        this._thingMap = null;
        this._requestMap = null;

        this._logger = _loggerProvider.getLogger(`shadow:${this._config.clientId}`);
    }

    /**
     * Looks up a request based on request Id, and returns it. The request object
     * is then removed from the request map.
     *
     * @param {String} requestId The request id for which the request object has
     *          to be looked up.
     * @return {Object|undefined} The request object if a matching one is found,
     *          or undefined if the token does not match the request id.
     */
    _deQueueRequest(requestId) {
        const request = this._requestMap[requestId];
        if (!request) {
            this._logger.warn({
                requestId: requestId
            }, 'Could not find matching request for status message');
            return;
        }

        this._logger.info({
            requestId: requestId
        }, 'Received status message response for request');
        delete this._requestMap[requestId];

        return request;
    }

    /**
     * A handler for shadow deltas received from the AWS IoT cloud.
     *
     * @private
     * @param {String} thingName The name of the thing for which the shadow
     *          delta has been reported
     * @param {Object} delta The shadow delta from the cloud
     */
    _deltaHandler(thingName, delta) {
        this._logger.info({
            thingName: thingName
        }, 'Received delta for thing, fetching full shadow');

        //Prepare and execute the request.
        this._getShadow(thingName);
    }

    /**
     * A handler for status messages received from the AWS IoT cloud.
     *
     * @private
     * @param {String} thingName The name of the thing for which the shadow
     *          delta has been reported
     * @param {String} status The status of the shadow operation
     * @param {String} requestId The request id that corresponds to the original
     *          request from the client.
     * @param {Object} state The state object received from the cloud.
     */
    _statusHandler(thingName, status, requestId, state) {
        this._logger.info({
            thingName: thingName,
            status: status,
            requestId: requestId
        }, 'Received status message from the cloud');
        this._logger.debug({
            requestId: requestId,
            state: state
        }, 'State received from AWS IoT cloud');

        const request = this._deQueueRequest(requestId);
        if (request) {
            if (status === 'accepted') {
                request.callback(null, {
                    action: request.action,
                    state: state
                });
            } else {
                request.callback('rejected');
            }
        } else {
            this._logger.warn({
                thingName: thingName
            }, 'Unsolicited shadow status message received for thing');
        }
    }

    /**
     * A handler for timeout messages received from the AWS IoT cloud.
     *
     * @private
     * @param {String} thingName The name of the thing for which the shadow
     *          delta has been reported
     * @param {String} requestId The request id that corresponds to the original
     *          request from the client.
     */
    _timeoutHandler(thingName, requestId) {
        this._logger.info({
            thingName: thingName,
            requestId: requestId
        }, 'Shadow request to cloud timed out');

        const request = this._deQueueRequest(requestId);
        if (request) {
            if (request.retriesRemaining > 0) {
                request.retriesRemaining--;
                request.execute();
            } else {
                request.callback('timedout');
            }
        } else {
            this._logger.warn({
                thingName: thingName
            }, 'Unsolicited shadow timeout received for thing');
        }
    }

    /**
     * Prepares a request object that can be used to update the shadow state
     * for a thing in the AWS IoT cloud, and executes the request.
     *
     * @private
     * @param {String} thingName The name of the thing for which the shadow
     *          has to be updated.
     * @param {Object} state The updated state object for the thing.
     */
    _updateShadow(thingName, state) {
        this._logger.debug({
            thingName: thingName,
            state: state
        }, 'Creating update shadow request for thing');
        const callback = this._thingMap[thingName];

        if (typeof callback !== 'function') {
            const error = `Cannot update thing state. Specified thing is not being watched: [${thingName}]`;
            this._logger.error({
                thingName: thingName
            }, 'Received request to update shadow for a thing that is not being watched');
            throw new Error(error);
        }

        const request = {
            action: 'update_shadow',
            callback: callback,
            retriesRemaining: 2
        };

        request.execute = () => {
            const requestId = this._shadow.update(thingName, state);
            this._requestMap[requestId] = request;
            this._logger.info({
                requestId: requestId,
                thingName: thingName
            }, 'Thing shadow update state request dispatched');
        };

        request.execute();
    }

    /**
     * Prepares a request object that can be used to fetch the full shadow for
     * a thing from the AWS IoT cloud, and executes the request.
     *
     * @private
     * @param {String} thingName The name of the thing for which the shadow
     *          has to be fetched.
     */
    _getShadow(thingName) {
        this._logger.debug({
            thingName: thingName
        }, 'Creating full shadow get request for thing');
        const callback = this._thingMap[thingName];

        if (typeof callback !== 'function') {
            this._logger.warn({
                thingName: thingName
            }, 'Received request to get shadow for a thing that is not being watched');
            return;
        }

        const request = {
            action: 'get_shadow',
            callback: callback,
            retriesRemaining: 2
        };

        request.execute = () => {
            const requestId = this._shadow.get(thingName);
            this._requestMap[requestId] = request;
            this._logger.info({
                requestId: requestId,
                thingName: thingName
            }, 'Thing shadow get request dispatched');
        };
        request.execute();
    }

    /**
     * Starts up the shadow manager. This method will establish an MQTT
     * connection to the cloud, and makes the shadow manager ready for shaodw
     * requests/responses.
     *
     * @return {Promise<undefined, undefined>} A promise that is resolved as
     *          soon as the client successfully connects to the cloud. The
     *          current implementation will never reject the promise - the
     *          manager will continue to retry connections until it is
     *          successful.
     */
    start() {
        if (this._shadow !== null) {
            throw new Error('Cannot start shadow manager. Shadow manager has already been started');
        }

        return new Promise((resolve, reject) => {
            this._thingMap = {};
            this._requestMap = {};
            this._shadow = _awsIotSdk.thingShadow(this._config);

            this._shadow.on('error', (err) => {
                // Handle any connection errors without aborting connections.
                // This will allow the AWS shadow object to retry connection
                // which is especially important in a provisioning scenario.
                this._logger.debug(err, 'Connection error');
                this._logger.warn('Error connecting to server. Will retry in sometime');
            });

            this._shadow.on('connect', () => {
                this._logger.info('Shadow manager connected to AWS IoT cloud');

                this._logger.info('Registering handler for shadow deltas');
                this._shadow.on('delta', this._deltaHandler.bind(this));

                this._logger.info('Registering handler for shadow status');
                this._shadow.on('status', this._statusHandler.bind(this));

                this._logger.info('Registering handler for shadow timeout');
                this._shadow.on('timeout', this._timeoutHandler.bind(this));

                resolve();
            });
        });
    }


    /**
     * Stops the shadow manager. This method will close the MQTT connection and
     * release all resources held by it.
     *
     * @return {Promise<undefined, undefined>} A promise that is resolved as
     *          soon as the client connection is closed.
     */
    stop() {
        if (this._shadow === null) {
            throw new Error('Cannot stop shadow manager. Shadow manager has not been started');
        }
        return new Promise((resolve, reject) => {
            this._shadow.end(false, () => {
                resolve();
            });
        });
    }


    /**
     * Registers a callback function to watch for changes on a specific shadow.
     *
     * @param {String} thingName The name of the thing whose shadow has to be
     *          watched for changes.
     * @param {Object} callback A callback function that receives and processes
     *          changes and errors for a specific shadow.
     */
    watchShadow(thingName, callback) {
        if (this._shadow === null) {
            throw new Error('Cannot watch for shadow changes. Shadow manager has not been started');
        }
        if (typeof thingName !== 'string' || thingName.length <= 0) {
            throw new Error('Invalid thing name specified (arg #1)');
        }
        if (typeof callback !== 'function') {
            throw new Error('Invalid callback specified (arg #2)');
        }

        this._shadow.register(thingName);
        this._thingMap[thingName] = callback;

        this._logger.info({
            thingName: thingName
        }, 'Requesting initial state object');

        //Prepare and execute the request.
        this._getShadow(thingName);
    }


    /**
     * Stops watching the shadow for the specified thing.
     *
     * @param {String} thingName The thing name for which the shadow will no
     *          longer be watched.
     */
    stopWatching(thingName) {
        if (this._shadow === null) {
            throw new Error('Cannot stop watching for shadow changes. Shadow manager has not been started');
        }
        if (typeof thingName !== 'string' || thingName.length <= 0) {
            throw new Error('Invalid thing name specified (arg #1)');
        }

        const callback = this._thingMap[thingName];
        if (callback) {
            this._shadow.unregister(thingName);
            delete this._thingMap[thingName];
        }
    }


    /**
     * Reports an updated thing state to the AWS IoT cloud.
     *
     * @param {String} thingName The name of the thing for which the updated
     *          state is being reported.
     * @param {Object} state The updated state object
     */
    updateState(thingName, state) {
        if (this._shadow === null) {
            throw new Error('Cannot stop report updated state. Shadow manager has not been started');
        }
        if (typeof thingName !== 'string' || thingName.length <= 0) {
            throw new Error('Invalid thing name specified (arg #1)');
        }
        if (!state || (state instanceof Array) || typeof state !== 'object') {
            throw new Error('Invalid thing state specified (arg #2)');
        }

        this._logger.info({
            thingName: thingName
        }, 'Request to update thing state received');

        //Prepare and execute update request.
        this._updateShadow(thingName, state);
    }
}

module.exports = AwsShadowManager;
