'use strict';

const Connector = require('./connector');

/**
 * Base class that represents a connector object that is specifically designed
 * to communicate with one or more devices.
 *
 * @extends {Connector}
 *
 * @emits {error} When the connector enters an error state
 * @emits {data} When the connector has data to report
 */
class DeviceConnector extends Connector {

    /**
     * @param {String} id A unique id for the connector.
     * @param {Object} config A configuration object for the connector.
     */
    constructor(id, config) {
        super(id, 'device', config);

        this._buffer = [];
    }
}

module.exports = DeviceConnector;
