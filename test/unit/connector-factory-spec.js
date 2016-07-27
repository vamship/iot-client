/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _shortId = require('shortid');
const _clone = require('clone');
const _assertionHelper = require('wysknd-test').assertionHelper;
const _tempFileHelper = require('../utils/temp-file-helper');
const Connector = require('../../lib/connectors/connector');
const ConnectorFactory = require('../../lib/connector-factory');

describe('ConnectorFactory', () => {

    function _createFactory(config, basePath) {
        config = config || {};
        return new ConnectorFactory(config, basePath);
    }

    function _createFactoryConfig() {
        return {
            'Http': _tempFileHelper.createConnectorFile('HttpConnector', 'cloud'),
            'Cnc': _tempFileHelper.createConnectorFile('CncConnector', 'cloud'),
            'ThermalCamera': _tempFileHelper.createConnectorFile('LeptonCameraConnector', 'device'),
            'InternetButton': _tempFileHelper.createConnectorFile('InternetButtonConnector', 'device')
        };
    }

    beforeEach(() => {
        _tempFileHelper.setup();
    });

    afterEach(() => {
        _tempFileHelper.teardown();
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid configuration object', () => {
            const error = 'Invalid type configuration specified (arg #1)';

            function invoke(config) {
                return () => {
                    const factory = new ConnectorFactory(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if the connector module path is invalid', () => {
            function doTest(type, path) {
                const error = `Invalid module path specified for [${type}]`;

                function wrapper() {
                    const config = {
                        'ValidType': _tempFileHelper.createConnectorFile('ValidType', 'cloud')
                    };
                    config[type] = path;
                    const factory = new ConnectorFactory(config);
                }
                expect(wrapper).to.throw(error);
            }

            doTest('Foo', undefined);
            doTest('Foo', null);
            doTest('Foo', 123);
            doTest('Foo', '');
            doTest('Foo', true);
            doTest('Foo', []);
            doTest('Foo', {});
            doTest('Foo', () => {});
        });

        it('should throw an error if any of the connector module path does not reference an accessible file', () => {
            function doTest(type, path) {
                const error = `Cannot find module '${path}'`;

                function wrapper() {
                    const config = {};
                    config[type] = path;
                    const factory = new ConnectorFactory(config);
                }
                expect(wrapper).to.throw(error);
            }
            doTest('Foo', 'some/bad/path');
        });

        it('should return an object that exposes the required methods and properties', () => {
            const basePath = '/some/base/path';
            const factory = new ConnectorFactory({}, basePath);

            expect(factory).to.be.an('object');
            expect(factory.createConnector).to.be.a('function');
        });
    });

    describe('createConnector()', () => {

        it('should throw an error if invoked without a valid connector id', () => {
            const error = 'Invalid connector id specified (arg #2)';

            function invoke(id) {
                return () => {
                    const factory = _createFactory();
                    return factory.createConnector(id);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if invoked without a valid connector type', () => {
            const error = 'Invalid connector type specified (arg #1)';

            function invoke(type) {
                return () => {
                    const factory = _createFactory();
                    const id = 'id1';
                    return factory.createConnector(id, type);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if invoked without a valid connector configuration object', () => {
            const error = 'Invalid connector configuration specified (arg #3)';

            function invoke(config) {
                return () => {
                    const factory = _createFactory();
                    const type = 'type1';
                    const id = 'id1';
                    return factory.createConnector(id, type, config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if the factory does not map a class to the specified type', () => {
            function doTest(type) {
                const error = `Specified type does not map to a valid module: [${type}]`;
                const factory = _createFactory();

                function wrapper() {
                    const id = 'id1';
                    return factory.createConnector(id, type, {});
                }
                expect(wrapper).to.throw(error);
            }

            doTest('bad-type');
            doTest('another-bad-type');
        });

        it('should create and return an instance of the connector type with the specified id and config', () => {
            const factory = _createFactory();
            const CloudConnector = _sinon.stub();
            const DeviceConnector = _sinon.stub();

            const instances = {
                'Cloud1': {
                    type: 'cloud'
                },
                'Device1': {
                    type: 'device'
                }
            };
            CloudConnector.returns(instances.Cloud1);
            DeviceConnector.returns(instances.Device1);

            factory._loader._typeMap = {
                'Cloud1': CloudConnector,
                'Device1': DeviceConnector
            };

            for (let type in factory._typeMap) {
                let spy = factory._typeMap[type];
                let config = {
                    someVal: type,
                    foo: 'bar'
                };
                let id = _shortId.generate();

                expect(spy).to.not.have.been.called;
                var connector = factory.createConnector(id, type, config);
                expect(spy).to.have.been.calledWithNew;
                expect(spy.args[0][0]).to.equal(id);
                expect(spy.args[0][1]).to.equal(config);

                expect(connector).to.equal(instances[type]);
            }
        });
    });
});
