'use strict';

const Hub = require('./hub');
const _loggerProvider = require('./logger-provider');

/**
 * Handles commands emitted by the connector hub, and takes necessary action
 * based on the command payload.
 */
class CommandHandler {
    /**
     * @param {Object} hub Reference to a properly initialized connector hub
     *          object.
     */
    constructor(hub) {
        if (!(hub instanceof Hub)) {
            throw new Error('Invalid connector hub specified (arg #1)');
        }
        this._hub = hub;
        this._hub.on('cnc', this._commandHandler.bind(this));
        this._logger = _loggerProvider.getLogger(`command_handler`);
    }


    /**
     * Wraps up request execution based on the fulfillment/rejection of the
     * specified promise.
     * 
     * @private
     * @param {Object} request A reference to the request object.
     * @param {Promise<any, any>} promise A promise that represents a command
     *          execution.
     */
    _completeRequest(request, promise) {
        promise.then((data) => {
            this._logger.info('CnC command completed successfully');
            request.finish('Request completed successfully');
        }, (err) => {
            this._logger.error(err, 'Error executing Cnc command');
            request.fail(err);
        });

    }

    /**
     * Handler for CNC commands emitted by the hub.
     *
     * @private
     * @param {Object} request An object that represents the CNC request.
     */
    _commandHandler(request) {
        request.acknowledge();
        switch (request.action) {
            case 'start_connector':
                this._startConnector(request);
                break;
            case 'stop_connector':
                this._stopConnector(request);
                break;
            default:
                this._logger.error(`Unrecognized action: [${request.action}]`);
                request.fail(new Error(`Unrecognized action: [${request.action}]`));
                break;
        }
    }

    /**
     * Starts a connector using the specified id and definition.
     * 
     * @private
     * @param {Object} request An object that represents the CNC request
     */
    _startConnector(request) {
        const connectorId = request.getParam('connectorId');
        const definition = request.getParam('definition');
        const promise = this._hub.startConnector(connectorId, definition);

        this._completeRequest(request, promise);
    }

    /**
     * Stops a connector using the specified id and definition.
     * 
     * @private
     * @param {Object} request An object that represents the CNC request
     */
    _stopConnector(request) {
        const connectorId = request.getParam('connectorId');
        const promise = this._hub.stopConnector(connectorId);

        this._completeRequest(request, promise);
    }
}

module.exports = CommandHandler;
