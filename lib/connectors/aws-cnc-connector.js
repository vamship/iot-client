'use strict';

const _path = require('path');
const _awsIotSdk = require('aws-iot-device-sdk');
const _clone = require('clone');
const CloudConnector = require('./cloud-connector');
const Promise = require('bluebird').Promise;
let AwsShadowManager = require('./aws-shadow-manager');

/**
 * A connector that is designed to connect to AWS' IoT infrastructure, and
 * use that infrastructure for CNC interactions.
 *
 * @extends {CloudConnector}
 */
class AwsCncConnector extends CloudConnector {
    /**
     * @param {String} id A unique id for the connector.
     * @param {Object} config The configuration associated with the connector.
     */
    constructor(id, config) {
        super(id, config);
        if (typeof config.agentCert !== 'string' || config.agentCert.length <= 0) {
            throw new Error('Configuration does not define a valid agentCert property');
        }
        if (typeof config.agentPrivateKey !== 'string' || config.agentPrivateKey.length <= 0) {
            throw new Error('Configuration does not define a valid agentPrivateKey property');
        }
        if (typeof config.serverCert !== 'string' || config.serverCert.length <= 0) {
            throw new Error('Configuration does not define a valid serverCert property');
        }
        if (typeof config.thingName !== 'string' || config.thingName.length <= 0) {
            throw new Error('Configuration does not define a valid thingName property');
        }
        if (typeof config.awsRegion !== 'string' || config.awsRegion.length <= 0) {
            throw new Error('Configuration does not define a valid awsRegion property');
        }

        this._shadowManager = null;
        this._connectorMap = {};
    }


    /**
     * Handles shadow messages for the core CNC connector. This includes
     * messages indicating changes in connector configuration, and cnc commands
     * received from the AWS IoT cloud.
     *
     * @private
     * @param {Object} err Optional error message. This message being falsy
     *          indicates that there were no errors.
     * @param {Object} data Data received from the the AWS IoT cloud.
     */
    _cncDataHandler(err, data) {
        if (err) {
            this._logger.error(err, 'Error received from shadow manager');
        } else if (!data || typeof data !== 'object') {
            this._logger.warn({
                shadowData: data
            }, 'Received bad shadow data from shadow manager');
        } else {
            const action = data.action;
            const state = data.state;

            if (typeof action !== 'string' || action.length <= 0) {
                this._logger.warn({
                    action: action
                }, 'Bad action received for thing shadow');
                return;
            }

            if (action !== 'get_shadow') {
                this._logger.info({
                    action: action
                }, 'Ignoring action');
                return;
            }

            if (!state || typeof state !== 'object') {
                this._logger.warn({
                    state: state,
                    action: action
                }, 'Bad state received for supported action');
                return;
            }

            if (!(state.connectors instanceof Array)) {
                this._logger.warn({
                    state: state,
                    action: action
                }, 'State does not define a valid connectors property');
                return;
            }

            if (!(state.commands instanceof Array)) {
                this._logger.warn({
                    state: state,
                    action: action
                }, 'State does not define a valid commands property');
                return;
            }

            // Assume that all existing connectors have to be deleted.
            const connectorsToDelete = _clone(this._connectorMap);

            state.connectors.forEach((connectorId, index) => {
                if (!this._connectorMap[connectorId]) {
                    //TODO: Callback needs to be fixed
                    this._shadowManager.watchShadow(connectorId, () => {});
                    this._connectorMap[connectorId] = true;
                } else {
                    // This is an existing connector that is still in the
                    // shadow. Don't delete it.
                    delete connectorsToDelete[connectorId];
                }
            });

            // Delete all connectors that were not in the shadow list.
            for (let connectorId in connectorsToDelete) {
                this._shadowManager.stopWatching(connectorId);
                delete this._connectorMap[connectorId];
            }
        }
    }

    /**
     * Starts up the agent.
     */
    _start() {
        const shadowOptions = {
            certPath: this._config.agentCert,
            keyPath: this._config.agentPrivateKey,
            caPath: this._config.serverCert,
            clientId: this._config.thingName,
            region: this._config.awsRegion
        };

        this._logger.info({
            shadowOptions: shadowOptions
        }, 'Initializing shadow manager');
        this._shadowManager = new AwsShadowManager(shadowOptions);

        return this._shadowManager.start().then(() => {
            this._shadowManager.watchShadow(this._config.thingName,
                this._cncDataHandler.bind(this));
        });
    }

    /**
     * Stops the agent and cleans up any resources.
     */
    _stop() {
        this._logger.info('Stopping connector');
        return this._shadowManager.stop().then(() => {
            this._logger.info('Stopped shadow manager');
        });
    }

}

module.exports = AwsCncConnector;
