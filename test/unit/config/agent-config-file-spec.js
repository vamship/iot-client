/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const ConfigFile = require('../../../lib/config/config-file');
const AgentConfigFile = require('../../../lib/config/agent-config-file');
const ConfigVersionError = require('../../../lib/config/config-version-error');

describe('AgentConfigFile', () => {
    const STARTUP_MODE_NORMAL = 'normal';
    const STARTUP_MODE_PROVISION = 'provision';
    const DEFAULT_CONFIG_PATH = 'foo/bar/config.file';
    const SUPPORTED_VERSION = '~1.0.0';
    const DEFAULT_VERSION = '1.0.0';
    const DEFAULT_STARTUP_MODE = STARTUP_MODE_NORMAL;

    function _createAgentConfig(config, path) {
        path = path || DEFAULT_CONFIG_PATH;

        return new AgentConfigFile(path);
    }

    describe('[static members]', () => {
        it('should define required static members', () => {
            expect(AgentConfigFile).to.have.property('STARTUP_MODE_PROVISION', STARTUP_MODE_PROVISION);
            expect(AgentConfigFile).to.have.property('STARTUP_MODE_NORMAL', STARTUP_MODE_NORMAL);
        });
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid file path', () => {
            const error = 'Invalid file path specified (arg #1)';

            function invoke(config) {
                return () => {
                    const file = new AgentConfigFile(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should return an object that exposes the required methods and properties', () => {
            const file = _createAgentConfig();

            expect(file).to.be.an.instanceof(ConfigFile);
            expect(file.load).to.be.a('function');
            expect(file.save).to.be.a('function');
            expect(file._afterLoad).to.be.a('function');
            expect(file._beforeSave).to.be.a('function');
            expect(file.data).to.be.an('object');

            expect(file).to.have.property('defaultVersion', DEFAULT_VERSION);
            expect(file).to.have.property('supportedVersion', SUPPORTED_VERSION);
            expect(file.setVersion).to.be.a('function');
            expect(file.setStartupMode).to.be.a('function');
            expect(file.setConnectorType).to.be.a('function');
            expect(file.setConnectorDefinition).to.be.a('function');
            expect(file.setCncDefinition).to.be.a('function');
        });

        it('should populate the data object with the required schema elements', () => {
            const file = _createAgentConfig();

            expect(file.data.version).to.equal(DEFAULT_VERSION);
            expect(file.data.startupMode).to.equal(STARTUP_MODE_NORMAL);
            expect(file.data.connectorTypes).to.be.an('object').and.to.be.empty;
            expect(file.data.cnc).to.be.an('object').and.to.be.empty;
            expect(file.data.connectors).to.be.an('object').and.to.be.empty;
        });
    });

    describe('_afterLoad()', () => {
        it('should throw an error if the input is not a valid buffer', () => {
            const error = 'Cannot process config data. Data was not a buffer as expected.';

            function invoke(config) {
                return () => {
                    const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                    file._afterLoad(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('foobar')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if the input buffer does not contain a valid JSON string', () => {
            const error = 'Error parsing config data. Config must be valid JSON.';

            function invoke(config) {
                return () => {
                    const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                    const buffer = new Buffer(config);
                    file._afterLoad(buffer);
                };
            }

            expect(invoke('bad config')).to.throw(error);
            expect(invoke('{ value: 123 }')).to.throw(error);
            expect(invoke('{ "non": json}')).to.throw(error);
        });

        it('should throw an error if the config object does not define a valid "version" property', () => {
            const error = 'Config does not define a valid version (config.version)';

            function invoke(version) {
                const buffer = new Buffer(JSON.stringify({
                    version: version
                }));
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file._afterLoad(buffer);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('bad-version-string')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(function() {})).to.throw(error);

            expect(invoke('')).to.throw(error);
            expect(invoke('abcd')).to.throw(error);
            expect(invoke('bad.bad.version')).to.throw(error);
            expect(invoke('~.1.2.3')).to.throw(error);
            expect(invoke('1.2.3.4')).to.throw(error);
        });

        it('should throw an error if the config object defines a version property, but it does not satisfy the expected version', () => {
            function doTest(actualVersion) {
                const buffer = new Buffer(JSON.stringify({
                    version: actualVersion,
                }));
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const error = new ConfigVersionError(file.supportedVersion, actualVersion);

                expect(() => {
                    file._afterLoad(buffer);
                }).to.throw(error.message);
            }

            doTest('9.9.9');
            doTest('0.0.0');
        });

        it('should throw an error if the config object does not define a valid startupMode property', () => {
            const error = 'Config does not define a valid startupMode (config.startupMode)';

            function invoke(startupMode) {
                const buffer = new Buffer(JSON.stringify({
                    version: DEFAULT_VERSION,
                    startupMode: startupMode
                }));
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file._afterLoad(buffer);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('bad-startup-mode')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw an error if the config object does not define a valid connector types section', () => {
            const error = 'Configuration does not define a valid connector types section (config.connectorTypes)';

            function invoke(connectorTypes) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const buffer = new Buffer(JSON.stringify({
                    version: DEFAULT_VERSION,
                    startupMode: DEFAULT_STARTUP_MODE,
                    connectorTypes: connectorTypes
                }));
                return () => {
                    file._afterLoad(buffer);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw an error if the config object does not define a valid CnC configuration', () => {
            const error = 'Configuration does not define a valid CnC configuration (config.cnc)';

            function invoke(cnc) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const buffer = new Buffer(JSON.stringify({
                    version: DEFAULT_VERSION,
                    startupMode: DEFAULT_STARTUP_MODE,
                    connectorTypes: {},
                    cnc: cnc
                }));
                return () => {
                    file._afterLoad(buffer);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw an error if the config object does not define a valid connectors section', () => {
            const error = 'Configuration does not define a valid connectors section (config.connectors)';

            function invoke(connectors) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const buffer = new Buffer(JSON.stringify({
                    version: DEFAULT_VERSION,
                    startupMode: DEFAULT_STARTUP_MODE,
                    connectorTypes: {},
                    cnc: {},
                    connectors: connectors
                }));
                return () => {
                    file._afterLoad(buffer);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw no errors if the config object has all the necessary sections', () => {
            function invoke() {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const buffer = new Buffer(JSON.stringify({
                    version: DEFAULT_VERSION,
                    startupMode: DEFAULT_STARTUP_MODE,
                    connectorTypes: {},
                    cnc: {},
                    connectors: {}
                }));
                return () => {
                    file._afterLoad(buffer);
                };
            }

            expect(invoke()).to.not.throw();
        });
    });

    describe('_beforeSave()', () => {
        it('should throw an error if the input is not a valid object', () => {
            const error = 'Cannot save config data. Data was not an object as expected.';

            function invoke(config) {
                return () => {
                    const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                    file._beforeSave(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('foobar')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if the config object does not define a valid "version" property', () => {
            const error = 'Config does not define a valid version (config.version)';

            function invoke(version) {
                const config = {
                    version: version
                };
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file._beforeSave(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('bad-version-string')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(function() {})).to.throw(error);

            expect(invoke('')).to.throw(error);
            expect(invoke('abcd')).to.throw(error);
            expect(invoke('bad.bad.version')).to.throw(error);
            expect(invoke('~.1.2.3')).to.throw(error);
            expect(invoke('1.2.3.4')).to.throw(error);
        });

        it('should throw an error if the config object defines a version property, but it does not satisfy the expected version', () => {
            function doTest(actualVersion) {
                const config = {
                    version: actualVersion
                };
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const error = new ConfigVersionError(file.supportedVersion, actualVersion);

                expect(() => {
                    file._beforeSave(config);
                }).to.throw(error.message);
            }

            doTest('9.9.9');
            doTest('0.0.0');
        });

        it('should throw an error if the config object does not define a valid startupMode property', () => {
            const error = 'Config does not define a valid startupMode (config.startupMode)';

            function invoke(startupMode) {
                const config = {
                    version: DEFAULT_VERSION,
                    startupMode: startupMode
                };
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file._beforeSave(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('bad-startup-mode')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw an error if the config object does not define a valid connector types section', () => {
            const error = 'Configuration does not define a valid connector types section (config.connectorTypes)';

            function invoke(connectorTypes) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const config = {
                    version: DEFAULT_VERSION,
                    startupMode: DEFAULT_STARTUP_MODE,
                    connectorTypes: connectorTypes
                };
                return () => {
                    file._beforeSave(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw an error if the config object does not define a valid CnC configuration', () => {
            const error = 'Configuration does not define a valid CnC configuration (config.cnc)';

            function invoke(cnc) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const config = {
                    version: DEFAULT_VERSION,
                    startupMode: DEFAULT_STARTUP_MODE,
                    connectorTypes: {},
                    cnc: cnc
                };
                return () => {
                    file._beforeSave(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw an error if the config object does not define a valid connectors section', () => {
            const error = 'Configuration does not define a valid connectors section (config.connectors)';

            function invoke(connectors) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const config = {
                    version: DEFAULT_VERSION,
                    startupMode: DEFAULT_STARTUP_MODE,
                    connectorTypes: {},
                    cnc: {},
                    connectors: connectors
                };
                return () => {
                    file._beforeSave(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should return a string representation of the config if the config has all the necessary sections', () => {
            const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
            const config = {
                version: DEFAULT_VERSION,
                startupMode: DEFAULT_STARTUP_MODE,
                connectorTypes: {},
                cnc: {},
                connectors: {}
            };
            const ret = file._beforeSave(config);

            expect(ret).to.be.a('string');
            expect(JSON.parse(ret)).to.deep.equal(config);
        });
    });

    describe('setVersion()', () => {

        it('should throw an error if a valid version is not specified', () => {
            const error = 'Invalid version specified (arg #1)';

            function invoke(version) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file.setVersion(version);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw an error if the version is not a valid version string', () => {
            function doTest(version) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const error = `[${version}] is not a valid semantic versioning string`;
                const wrapper = () => {
                    file.setVersion(version);
                };

                expect(wrapper).to.throw(error);
            }

            doTest('abcd');
            doTest('bad.bad.version');
            doTest('~.1.2.3');
            doTest('1.2.3.4');
        });

        it('should update the config version if a valid version is specified', () => {
            const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
            const version = '2.1.3';

            expect(file.data.version).to.equal(DEFAULT_VERSION);
            file.setVersion(version);
            expect(file.data.version).to.equal(version);
        });
    });

    describe('setStartupMode()', () => {

        it('should throw an error if a valid startup mode is not specified', () => {
            const error = 'Invalid startup mode specified (arg #1)';

            function invoke(mode) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file.setStartupMode(mode);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw an error if the startup mode is not a supported startup mode value', () => {
            function doTest(mode) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                const error = `[${mode}] mode is not a valid startup mode value`;
                const wrapper = () => {
                    file.setStartupMode(mode);
                };
                expect(wrapper).to.throw(error);
            }

            doTest('abcd');
            doTest('bad_mode');
            doTest('worse_mode');
        });

        it('should update the startup mode if a valid startup mode is specified', () => {
            const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);

            expect(file.data.startupMode).to.equal(DEFAULT_STARTUP_MODE);

            file.setStartupMode(AgentConfigFile.STARTUP_MODE_PROVISION);
            expect(file.data.startupMode).to.equal(AgentConfigFile.STARTUP_MODE_PROVISION);

            file.setStartupMode(AgentConfigFile.STARTUP_MODE_NORMAL);
            expect(file.data.startupMode).to.equal(AgentConfigFile.STARTUP_MODE_NORMAL);
        });
    });

    describe('setConnectorType()', () => {
        const DEFAULT_CONNECTOR_TYPE = 'DummyConnector';
        const DEFAULT_MODULE_PATH = './some/path/to/module';

        it('should throw an error if a valid connector type is not specified', () => {
            const error = 'Invalid connector type specified (arg #1)';

            function invoke(type) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file.setConnectorType(type);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw an error if a valid module path is not specified', () => {
            const error = 'Invalid module path specified (arg #2)';

            function invoke(path) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file.setConnectorType(DEFAULT_CONNECTOR_TYPE, path);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should add a new connector type to the configuration if the specified type does not exist', () => {
            const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
            const type = 'SomeType';
            const path = './module/file/path.js';

            expect(file.data.connectorTypes[type]).to.be.undefined;
            file.setConnectorType(type, path);
            expect(file.data.connectorTypes[type]).to.equal(path);
        });

        it('should update the module path if the specified connector type has already been defined', () => {
            const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
            const type = 'SomeType';
            const oldPath = './old/module/file/path.js';
            const path = './module/file/path.js';

            file.setConnectorType(type, oldPath);
            expect(file.data.connectorTypes[type]).to.equal(oldPath);

            file.setConnectorType(type, path);
            expect(file.data.connectorTypes[type]).to.equal(path);
        });
    });

    describe('setConnectorDefinition()', () => {
        const DEFAULT_CONNECTOR_ID = 'connectorId';
        const DEFAULT_CONNECTOR_DEFINITION = {
            type: 'SomeConnector'
        };

        it('should throw an error if a valid connector id is not specified', () => {
            const error = 'Invalid connector id specified (arg #1)';

            function invoke(id) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file.setConnectorDefinition(id);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should throw an error if a valid connector config is not specified', () => {
            const error = 'Invalid connector definition specified (arg #2)';

            function invoke(definition) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file.setConnectorDefinition(DEFAULT_CONNECTOR_ID, definition);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should add a new connector configuration to the connectors section if the specified id does not exist', () => {
            const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
            const id = DEFAULT_CONNECTOR_ID;
            const definition = {
                type: 'NewConnector'
            };

            expect(file.data.connectors[id]).to.be.undefined;
            file.setConnectorDefinition(id, definition);
            expect(file.data.connectors[id]).to.deep.equal(definition);
        });

        it('should update the connector configuration if the specified connector id has already been defined', () => {
            const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
            const id = DEFAULT_CONNECTOR_ID;
            const oldDefinition = DEFAULT_CONNECTOR_DEFINITION;
            const definition = {
                type: 'NewConnector'
            };

            file.setConnectorDefinition(id, oldDefinition);
            expect(file.data.connectors[id]).to.deep.equal(oldDefinition);

            file.setConnectorDefinition(id, definition);
            expect(file.data.connectors[id]).to.deep.equal(definition);
        });
    });

    describe('setCncDefinition()', () => {
        const DEFAULT_CONNECTOR_DEFINITION = {
            type: 'SomeConnector'
        };

        it('should throw an error if a valid cnc definition is not specified', () => {
            const error = 'Invalid CnC definition specified (arg #1)';

            function invoke(definition) {
                const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
                return () => {
                    file.setCncDefinition(definition);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(function() {})).to.throw(error);
        });

        it('should update the cnc connector configuration with the specified definition', () => {
            const file = new AgentConfigFile(DEFAULT_CONFIG_PATH);
            const definition = {
                type: 'NewConnector'
            };

            expect(file.data.cnc).to.deep.equal({});

            file.setCncDefinition(definition);
            expect(file.data.cnc).to.deep.equal(definition);
        });
    });
});
