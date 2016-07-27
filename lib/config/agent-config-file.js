'use strict';

const _semver = require('semver');
const ConfigFile = require('./config-file');
const ConfigVersionError = require('./config-version-error');

/**
 * Class that abstracts the configuration file for the iot client agent.
 *
 * @extends {ConfigFile}
 */
class AgentConfigFile extends ConfigFile {

    /**
     * A string that represents normal startup mode value.
     *
     * @type {String}
     */
    static get STARTUP_MODE_NORMAL() {
        return 'normal';
    }

    /**
     * A string that represents provisioning startup mode value.
     *
     * @type {String}
     */
    static get STARTUP_MODE_PROVISION() {
        return 'provision';
    }

    /**
     * @param {String} path The path to the actual file on the file system.
     */
    constructor(path) {
        super(path);
        this._setData({
            version: this.defaultVersion,
            startupMode: AgentConfigFile.STARTUP_MODE_NORMAL,
            connectorTypes: {},
            cnc: {},
            connectors: {}
        });
        this._logger = this._logger.child({
            subGroup: 'agent_config'
        });
    }

    /**
     * Schema validates the configuration object.
     *
     * @private
     * @param {Object} config The configuration object to validate
     */
    _validateSchema(config) {
        this._logger.info('Starting schema validation');
        var error = null;

        if (!_semver.valid(config.version)) {
            error = new Error('Config does not define a valid version (config.version)');

        } else if (!_semver.satisfies(config.version, this.supportedVersion)) {
            error = new ConfigVersionError(this.supportedVersion, config.version);

        } else if (config.startupMode !== AgentConfigFile.STARTUP_MODE_NORMAL &&
            config.startupMode !== AgentConfigFile.STARTUP_MODE_PROVISION) {
            error = new Error('Config does not define a valid startupMode (config.startupMode)');

        } else if (!config.connectorTypes || (config.connectorTypes instanceof Array) ||
            typeof config.connectorTypes !== 'object') {
            error = new Error('Configuration does not define a valid connector types section (config.connectorTypes)');

        } else if (!config.cnc || (config.cnc instanceof Array) ||
            typeof config.cnc !== 'object') {
            error = new Error('Configuration does not define a valid CnC configuration (config.cnc)');

        } else if (!config.connectors || (config.connectors instanceof Array) ||
            typeof config.connectors !== 'object') {
            error = new Error('Configuration does not define a valid connectors section (config.connectors)');
        }

        if (error) {
            this._logger.fatal(error, 'Schema validation failed');
            throw error;
        } else {
            this._logger.info('Schema validation successful');
        }
    }

    /**
     * Overrides the _afterLoad() method of the parent class, and introduces
     * validations to check for required elements in the configuration file.
     *
     * @protected
     * @param {Buffer} data The raw data read from the file system.
     * @return {Object} An object that is a parsed equivalent of the JSON read
     *              from the file system.
     */
    _afterLoad(data) {
        this._logger.debug('Verifying data post load from file');
        if (!(data instanceof Buffer)) {
            throw new Error('Cannot process config data. Data was not a buffer as expected.');
        }
        var config;
        try {
            this._logger.debug('Parsing raw config data');
            config = JSON.parse(data);
        } catch (ex) {
            throw new Error('Error parsing config data. Config must be valid JSON.');
        }
        this._validateSchema(config);
        return config;
    }

    /**
     * Overrides the _beforeSave() method of the parent class, and introduces
     * validations to check for required elements in the configuration file.
     *
     * @protected
     * @param {Object} data The data that will ultimately be saved in the
     *          config file.
     * @return {Object} An object that is a parsed equivalent of the JSON read
     *              from the file system.
     */
    _beforeSave(data) {
        this._logger.debug('Performing pre save transformation');
        if (!data || (data instanceof Array) || typeof data !== 'object') {
            throw new Error('Cannot save config data. Data was not an object as expected.');
        }
        this._validateSchema(data);
        return JSON.stringify(data);
    }

    /**
     * Gets the supported config version for the agent config. This value is
     * a semver string.
     *
     * @type {String}
     */
    get supportedVersion() {
        return '~1.0.0';
    }

    /**
     * Gets the current default version for the agent config. This is a valid
     * version string.
     *
     * @type {String}
     */
    get defaultVersion() {
        return '1.0.0';
    }

    /**
     * Sets the version of the config.
     *
     * @param {String} version A valid version string to set.
     */
    setVersion(version) {
        if (typeof version !== 'string' || version.length <= 0) {
            throw new Error('Invalid version specified (arg #1)');
        }
        if (!_semver.valid(version)) {
            throw new Error(`[${version}] is not a valid semantic versioning string`);
        }
        this.data.version = version;
    }

    /**
     * Sets the startup mode on the config.
     *
     * @param {String} mode A valid startup mode string
     */
    setStartupMode(mode) {
        if (typeof mode !== 'string' || mode.length <= 0) {
            throw new Error('Invalid startup mode specified (arg #1)');
        }
        if (mode !== AgentConfigFile.STARTUP_MODE_NORMAL &&
            mode !== AgentConfigFile.STARTUP_MODE_PROVISION) {
            throw new Error(`[${mode}] mode is not a valid startup mode value`);
        }

        this.data.startupMode = mode;
    }

    /**
     * Updates the module reference for a specific connector type. If the
     * module reference for the type already exists, it will be overwritten.
     * If not, a new connector will be created with the specified type and
     * module path.
     *
     * @param {String} type An id that uniquely identifies the connector
     * @param {String} path The path to the module.
     */
    setConnectorType(type, path) {
        if (typeof type !== 'string' || type.length <= 0) {
            throw new Error('Invalid connector type specified (arg #1)');
        }

        if (typeof path !== 'string' || path.length <= 0) {
            throw new Error('Invalid module path specified (arg #2)');
        }

        this.data.connectorTypes[type] = path;
    }

    /**
     * Updates the configuration section for the connector identified by the
     * specified id. If configuration for this connector already exists, it
     * will be overwritten. If not, a new connector will be created with the
     * specified id and configuration.
     *
     * @param {String} id An id that uniquely identifies the connector
     * @param {Object} definition The configuration object for the connector
     */
    setConnectorDefinition(id, definition) {
        if (typeof id !== 'string' || id.length <= 0) {
            throw new Error('Invalid connector id specified (arg #1)');
        }
        if (!definition || (definition instanceof Array) ||
            typeof definition !== 'object') {
            throw new Error('Invalid connector definition specified (arg #2)');
        }

        this.data.connectors[id] = definition;
    }

    /**
     * Updates the configuration for agent's cnc connector.
     *
     * @param {Object} definition The configuration object for the connector
     */
    setCncDefinition(definition) {
        if (!definition || (definition instanceof Array) ||
            typeof definition !== 'object') {
            throw new Error('Invalid CnC definition specified (arg #1)');
        }
        this.data.cnc = definition;
    }
}


module.exports = AgentConfigFile;
