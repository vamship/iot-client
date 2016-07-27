'use strict';

const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird').Promise;
const ConnectorFactory = require('./connector-factory');
const Connector = require('./connectors/connector');
const CloudConnector = require('./connectors/cloud-connector');
const DeviceConnector = require('./connectors/device-connector');
const CncRequest = require('./cnc-request');

const _loggerProvider = require('./logger-provider');

/**
 * Represents a hub for connectors. Creates and manages device, cloud and CnC
 * connectors.
 *
 * @extends {EventEmitter}
 * @emits {cnc} Emitted when the hub receives a cnc command.
 * @emits {connectorError} Emitted when a connector emits an error.
 */
class Hub extends EventEmitter {
    /**
     * @param {Object} connectorFactory A reference to an initialized connector
     *          factory object that can be used to instantiate connectors.
     */
    constructor(connectorFactory) {
        super();

        if (!(connectorFactory instanceof ConnectorFactory)) {
            throw new Error('Invalid connector factory specified (arg #1)');
        }

        this._logger = _loggerProvider.getLogger('hub');
        this._connectorFactory = connectorFactory;
        this._stopped = false;
        this._connectors = {
            cnc: null,
            connectors: {}
        };
    }

    /**
     * Validates input parameters, and instantiates a connector object.
     *
     * @private
     * @param {String} id A unique id for the connector.
     * @param {Object} definition The definition object for the connector
     * @param {Boolean} [isCnc = false] An optional parameter that indicates
     *          if the connector being created is a CnC connector.
     * @return {Object} A connector object corresponding to the specified
     *          definition.
     */
    _initConnector(id, definition, isCnc) {
        const cnc = (!!isCnc) ? 'CnC ' : '';

        if (typeof id !== 'string' || id.length <= 0) {
            throw new Error(`Invalid ${cnc}connector id specified: [${id}]`);
        }

        if (!definition || (definition instanceof Array) ||
            typeof definition !== 'object') {
            throw new Error(`Invalid ${cnc}connector definition specified: [${definition}]`);
        }

        if (typeof definition.type !== 'string' || definition.type.length <= 0) {
            throw new Error(`Definition has invalid ${cnc}connector type: [${definition.type}]`);
        }

        return this._connectorFactory.createConnector(id, definition.type,
            definition.config);
    }

    /**
     * Stops the CnC connector and clears the cnc reference maintained by this
     * object.
     *
     * @return {Promise<undefined, Error>} A promise that will be
     *          rejected/resolved based on the outcome of the stop operation.
     */
    _stopCnc() {
        return this._connectors.cnc.stop().then(() => {
            this._logger.info(`CnC connector stopped`);
        }, (error) => {
            this._logger.error(error, 'Error stopping CnC connector');
            throw error;
        }).finally(() => {
            this._connectors.cnc = null;
        });
    }

    /**
     * Stops the connector with the specified id and clears the reference
     * to this connector maintained by this object
     *
     * @param {String} id A unique id for the connector.
     * @return {Promise<undefined, Error>} A promise that will be
     *          rejected/resolved based on the outcome of the stop operation.
     */
    _stopConnector(id) {
        const connector = this._connectors.connectors[id];
        if (!(connector instanceof DeviceConnector) &&
            !(connector instanceof CloudConnector)) {
            throw new Error(`A connector with id [${id}] not yet been started.`);
        }

        return connector.stop().then(() => {
            this._logger.info(`CnC connector stopped: [${id}]`);
        }, (error) => {
            this._logger.error(error, `Error stopping CnC connector: [${id}]`);
            throw error;
        }).finally(() => {
            this._connectors.connectors[id] = null;
        });
    }

    /**
     * Sends data to all registered cloud connectors.
     *
     * @private
     * @param {Object} data The data to dispatch to the cloud connectors.
     */
    _dispatchDataToCloud(data) {
        for (let id in this._connectors.connectors) {
            const connector = this._connectors.connectors[id];
            if (connector instanceof CloudConnector) {
                connector.addData(data);
            }
        }
    }

    /**
     * Initializes a CnC connector that can receive and process commands from
     * a cloud server.
     *
     * @param {Object} definition The definition object for the CnC connector.
     * @return {Promise<undefined, Error>} A promise that is resolved or
     *              rejected based on the result of the init operation.
     */
    startCnc(definition) {
        return Promise.try(() => {
            if (this._stopped) {
                throw new Error('Cannot start CnC connector. Hub has been shutdown, or a shutdown is in progress');
            }
            if (this._connectors.cnc instanceof CloudConnector) {
                throw new Error('The CnC connector has already been initialized.');
            }

            const id = '__cnc';
            const connector = this._initConnector(id, definition, true);

            if (!(connector instanceof CloudConnector)) {
                throw new Error(`Cnc connector type does not correspond to a valid cloud connector: [${definition.type}]`);
            }

            connector.on('data', (command) => {
                const request = new CncRequest(command, connector);
                this.emit('cnc', request);
            });

            this._connectors.cnc = connector;

            return connector.start().then(() => {
                this._logger.info(`CnC connector started: [${id} (${definition.type})]`);
            }, (error) => {
                this._logger.error(error, `Error starting CnC connector: [${id} (${definition.type})]`);
                this._connectors.cnc = null;
                throw error;
            });
        });
    }

    /**
     * Stops the current CnC connector if it is running.
     *
     * @return {Promise<undefined, Error>} A promise that is resolved or
     *              rejected based on the result of the stop operation.
     */
    stopCnc() {
        return Promise.try(() => {
            if (this._stopped) {
                throw new Error('Cannot stop CnC connector. Hub has been shutdown, or a shutdown is in progress');
            }
            if (!(this._connectors.cnc instanceof Connector)) {
                throw new Error('The CnC connector has not yet been started.');
            }
            return this._stopCnc();
        });
    }

    /**
     * Creates and initializes a connector object.
     *
     * @param {String} id A unique id for the connector.
     * @param {Object} definition The connector definition.
     * @return {Promise<undefined, Error>} A promise that is resolved or
     *              rejected based on the result of the start operation.
     */
    startConnector(id, definition) {
        return Promise.try(() => {
            if (this._stopped) {
                throw new Error('Cannot start connector. Hub has been shutdown, or a shutdown is in progress');
            }

            let connector = this._connectors.connectors[id];

            if ((connector instanceof CloudConnector) ||
                (connector instanceof DeviceConnector)) {
                throw new Error(`Connector has already been initialized: [${id}]`);
            }

            connector = this._initConnector(id, definition, false);

            if (connector instanceof CloudConnector) {

            } else if (connector instanceof DeviceConnector) {
                connector.on('data', (data) => {
                    this._logger.info('Recieved data from device connector');
                    this._dispatchDataToCloud(data);
                });
            } else {
                throw new Error(`Connector type does not correspond to a valid cloud or device connector: [${definition.type}]`);
            }

            this._connectors.connectors[id] = connector;

            return connector.start().then(() => {
                this._logger.info(`Connector started: [${id} (${definition.type})]`);
            }, (error) => {
                this._logger.error(error, `Error starting connector: [${id} (${definition.type})]`);
                delete this._connectors.connectors[id];
                throw error;
            });

        });
    }

    /**
     * Stops a connector that is currently running.
     *
     * @param {String} id A unique id for the connector.
     * @return {Promise<undefined, Error>} A promise that is resolved or
     *              rejected based on the result of the stop operation.
     */
    stopConnector(id) {
        return Promise.try(() => {
            return this._stopConnector(id);
        });
    }

    /**
     * Shuts the hub down by terminating all active connectors including the
     * CnC connector.
     *
     * @return {Promise<undefined, Error>} A promise that is resolved or
     *              rejected based on the result of the shutdown operation.
     */
    shutdown() {
        return Promise.try(() => {
            if (this._stopped) {
                throw new Error('Cannot shutdown hub. Hub has been shutdown, or a shutdown is in progress');
            }
            this._stopped = true;

            const promises = [];
            for (let connectorId in this._connectors.connectors) {
                const promise = this._stopConnector(connectorId);
                promises.push(promise);
            }

            const finalPromise = Promise.all(promises).then(() => {
                this._logger.info('All connectors successfully stopped');
            }, (err) => {
                this._logger.error(err, 'One or more connectors failed to stop successfully');
            }).then(() => {
                if (this._connectors.cnc instanceof Connector) {
                    this._logger.info('Stopping CnC connector');
                    return this._stopCnc();
                }
            });

            return finalPromise;
        });
    }
}

module.exports = Hub;
