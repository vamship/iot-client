/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const CloudConnector = require('../../../lib/connectors/cloud-connector');
const _assertionHelper = require('wysknd-test').assertionHelper;
const _shortId = require('shortid');
const _rewire = require('rewire');
const Promise = require('bluebird').Promise;

let AwsCncConnector = null;

describe('AwsCncConnector', () => {
    const DEFAULT_CONNECTOR_ID = 'aws_cnc_connector';
    const DEFAULT_AGENT_CERT_PATH = '/some/agent/cert';
    const DEFAULT_AGENT_PRIVATE_KEY_PATH = '/some/agent/private/key';
    const DEFAULT_SERVER_CERT_PATH = '/some/server/cert';
    const DEFAULT_THING_NAME = 'thing_name';
    const DEFAULT_AWS_REGION = 'us-east-1';
    let _AwsShadowManagerMock = null;

    function _createConfig(config) {
        config = config || {};
        config.agentCert = config.agentCert || DEFAULT_AGENT_CERT_PATH;
        config.agentPrivateKey = config.agentPrivateKey || DEFAULT_AGENT_PRIVATE_KEY_PATH;
        config.serverCert = config.serverCert || DEFAULT_SERVER_CERT_PATH;
        config.thingName = config.thingName || DEFAULT_THING_NAME;
        config.awsRegion = config.awsRegion || DEFAULT_AWS_REGION;

        return config;
    }

    function _createConnector(id, config) {
        id = id || DEFAULT_CONNECTOR_ID;
        config = _createConfig(config);
        return new AwsCncConnector(id, config);
    }

    beforeEach(() => {
        const shadowManagerObject = {
            start: () => {},
            stop: () => {},
            watchShadow: _sinon.spy(),
            stopWatching: _sinon.spy(),
            updateState: _sinon.spy(),
            _resolveStart: () => {},
            _rejectStart: () => {},
            _resolveStop: () => {},
            _rejectStop: () => {}
        };

        shadowManagerObject.start = _sinon.stub(shadowManagerObject, 'start', () => {
            return new Promise((resolve, reject) => {
                shadowManagerObject._resolveStart = resolve;
                shadowManagerObject._rejectStart = reject;
            });
        });

        shadowManagerObject.stop = _sinon.stub(shadowManagerObject, 'stop', () => {
            return new Promise((resolve, reject) => {
                shadowManagerObject._resolveStop = resolve;
                shadowManagerObject._rejectStop = reject;
            });
        });

        _AwsShadowManagerMock = _sinon.stub().returns(shadowManagerObject);
        _AwsShadowManagerMock._managerInstance = shadowManagerObject;

        AwsCncConnector = _rewire('../../../lib/connectors/aws-cnc-connector');
        AwsCncConnector.__set__('AwsShadowManager', _AwsShadowManagerMock);
    });

    describe('ctor()', () => {
        it('should throw an error if the connector configuration object does not define a valid agent cert path', () => {
            const error = 'Configuration does not define a valid agentCert property';

            function invoke(agentCert) {
                const config = {
                    agentCert: agentCert
                };
                return () => {
                    const id = DEFAULT_CONNECTOR_ID;
                    const connector = new AwsCncConnector(id, config);
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

        it('should throw an error if the connector configuration object does not define a valid private key path', () => {
            const error = 'Configuration does not define a valid agentPrivateKey property';

            function invoke(agentPrivateKey) {
                const config = {
                    agentCert: DEFAULT_AGENT_CERT_PATH,
                    agentPrivateKey: agentPrivateKey
                };
                return () => {
                    const id = DEFAULT_CONNECTOR_ID;
                    const connector = new AwsCncConnector(id, config);
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

        it('should throw an error if the connector configuration object does not define a valid server cert path', () => {
            const error = 'Configuration does not define a valid serverCert property';

            function invoke(serverCert) {
                const config = {
                    agentCert: DEFAULT_AGENT_CERT_PATH,
                    agentPrivateKey: DEFAULT_AGENT_PRIVATE_KEY_PATH,
                    serverCert: serverCert
                };
                return () => {
                    const id = DEFAULT_CONNECTOR_ID;
                    const connector = new AwsCncConnector(id, config);
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

        it('should throw an error if the connector configuration object does not define a valid thing name', () => {
            const error = 'Configuration does not define a valid thingName property';

            function invoke(thingName) {
                const config = {
                    agentCert: DEFAULT_AGENT_CERT_PATH,
                    agentPrivateKey: DEFAULT_AGENT_PRIVATE_KEY_PATH,
                    serverCert: DEFAULT_SERVER_CERT_PATH,
                    thingName: thingName
                };
                return () => {
                    const id = DEFAULT_CONNECTOR_ID;
                    const connector = new AwsCncConnector(id, config);
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

        it('should throw an error if the connector configuration object does not define a valid aws region', () => {
            const error = 'Configuration does not define a valid awsRegion property';

            function invoke(awsRegion) {
                const config = {
                    agentCert: DEFAULT_AGENT_CERT_PATH,
                    agentPrivateKey: DEFAULT_AGENT_PRIVATE_KEY_PATH,
                    serverCert: DEFAULT_SERVER_CERT_PATH,
                    thingName: DEFAULT_THING_NAME,
                    awsRegion: awsRegion
                };
                return () => {
                    const id = DEFAULT_CONNECTOR_ID;
                    const connector = new AwsCncConnector(id, config);
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

        it('should create a cloud connector when invoked with a valid configuration object', () => {
            const id = DEFAULT_CONNECTOR_ID;
            const config = {
                agentCert: DEFAULT_AGENT_CERT_PATH,
                agentPrivateKey: DEFAULT_AGENT_PRIVATE_KEY_PATH,
                serverCert: DEFAULT_SERVER_CERT_PATH,
                thingName: DEFAULT_THING_NAME,
                awsRegion: DEFAULT_AWS_REGION
            };
            const connector = new AwsCncConnector(id, config);

            expect(connector).to.be.an.instanceof(CloudConnector);
        });
    });

    describe('_start()', () => {
        it('should create a new instance of the shadow manager object when started', () => {
            const managerConfig = {
                agentCert: _shortId.generate(),
                agentPrivateKey: _shortId.generate(),
                serverCert: _shortId.generate(),
                thingName: _shortId.generate(),
                awsRegion: _shortId.generate()
            };
            const expectedConfig = {
                certPath: managerConfig.agentCert,
                keyPath: managerConfig.agentPrivateKey,
                caPath: managerConfig.serverCert,
                clientId: managerConfig.thingName,
                region: managerConfig.awsRegion
            };
            const connector = _createConnector(null, managerConfig);
            const managerInstance = _AwsShadowManagerMock._managerInstance;

            expect(_AwsShadowManagerMock).to.not.have.been.called;
            connector.start();
            expect(_AwsShadowManagerMock).to.have.been.calledOnce;
            expect(_AwsShadowManagerMock).to.have.been.calledWithNew;

            const configArg = _AwsShadowManagerMock.args[0][0];
            expect(configArg).to.deep.equal(expectedConfig);
        });

        it('should reject the start promise if the shadow manager fails initialization', (done) => {
            const thingName = _shortId.generate();
            const connector = _createConnector(null, {
                thingName: thingName
            });
            const managerInstance = _AwsShadowManagerMock._managerInstance;

            const ret = connector.start();
            managerInstance._rejectStart();

            expect(ret).to.be.rejected.and.notify(done);
        });

        it('should watch the shadow for the current thing when the shadow manager is initialized successfully', (done) => {
            const thingName = _shortId.generate();
            const connector = _createConnector(null, {
                thingName: thingName
            });
            const managerInstance = _AwsShadowManagerMock._managerInstance;

            const ret = connector.start();

            expect(managerInstance.watchShadow).to.not.have.been.called;
            managerInstance._resolveStart();


            function doTest() {
                expect(managerInstance.watchShadow).to.have.been.calledOnce;
                const thingNameArg = managerInstance.watchShadow.args[0][0];
                const callback = managerInstance.watchShadow.args[0][1];

                expect(thingNameArg).to.equal(thingName);
                expect(callback).to.be.a('function');
            }

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });
    });

    describe('_stop()', () => {
        it('should stop the shadow manager when invoked', (done) => {
            const connector = _createConnector();
            const managerInstance = _AwsShadowManagerMock._managerInstance;

            function doTest() {
                expect(managerInstance.stop).to.not.have.been.called;

                const ret = connector.stop();
                managerInstance._resolveStop();

                expect(managerInstance.stop).to.have.been.calledOnce;
            }

            const ret = connector.start();
            managerInstance._resolveStart();

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should resolve the promise when the shadow manager is stopped successfully', (done) => {
            const connector = _createConnector();
            const managerInstance = _AwsShadowManagerMock._managerInstance;

            const ret = connector.start();
            managerInstance._resolveStart();

            function doTest() {
                const ret = connector.stop();
                managerInstance._resolveStop();

                return ret;
            }

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise when the shadow manager is not stopped successfully', (done) => {
            const connector = _createConnector();
            const managerInstance = _AwsShadowManagerMock._managerInstance;

            const ret = connector.start();
            managerInstance._resolveStart();

            function doTest() {
                const ret = connector.stop();
                managerInstance._rejectStop();

                return ret;
            }

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(() => {
                        throw new Error('Promise was fulfilled when rejection was expected');
                    },
                    () => true)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });
    });

    describe('[shadow messages]', () => {

        class MessageTester {
            constructor() {
                this.connector = _createConnector();
                this.managerInstance = _AwsShadowManagerMock._managerInstance;
                this.dataHandler = _sinon.spy();
                this.watchShadowCallback = {};
            }

            init(resolve) {
                this.connector.on('data', this.dataHandler);
                const ret = this.connector.start();
                if (resolve) {
                    this.managerInstance._resolveStart();
                } else {
                    this.managerInstance._rejectStart();
                }
                return ret;
            }

            checkNoAction() {
                return () => {
                    expect(this.managerInstance.watchShadow).to.not.have.been.called;
                    expect(this.managerInstance.stopWatching).to.not.have.been.called;
                    expect(this.dataHandler).to.not.have.been.called;
                };
            }

            resetWatchShadowSpy() {
                return () => {
                    this.managerInstance.watchShadow.reset();
                };
            }

            captureWatchShadowCallback(methodName) {
                return () => {
                    const spy = this.managerInstance.watchShadow;
                    this.watchShadowCallback = spy.args[0][1];
                };
            }

            testWatchShadow(expectedList) {
                return () => {
                    const watchShadow = this.managerInstance.watchShadow;
                    expect(watchShadow.callCount).to.equal(expectedList.length);
                    expectedList.forEach((item, index) => {
                        const connectorId = watchShadow.args[index][0];
                        expect(connectorId).to.equal(item);
                    });
                };
            }

            testStopWatching(expectedList) {
                return () => {
                    const stopWatching = this.managerInstance.stopWatching;
                    expect(stopWatching.callCount).to.equal(expectedList.length);
                    expectedList.forEach((item, index) => {
                        const connectorId = stopWatching.args[index][0];
                        expect(connectorId).to.equal(item);
                    });
                };
            }

            sendShadowMessage(err, data) {
                return () => {
                    this.watchShadowCallback(err, data);
                };
            }
        }

        describe('[error messages]', () => {

            it('should ignore error messages received from the shadow manager', (done) => {
                const tester = new MessageTester();

                expect(tester.init(true)).to.be.fulfilled
                    .then(tester.captureWatchShadowCallback())
                    .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage('something went wrong'))
                    .then(tester.checkNoAction())
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });

            it('should ignore non error messages without valid data', (done) => {
                const tester = new MessageTester();

                function buildPayload(data) {
                    return data;
                }

                expect(tester.init(true)).to.be.fulfilled
                    .then(tester.captureWatchShadowCallback())
                    .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage(null, buildPayload(undefined)))
                    .then(tester.sendShadowMessage(null, buildPayload(null)))
                    .then(tester.sendShadowMessage(null, buildPayload(123)))
                    .then(tester.sendShadowMessage(null, buildPayload('abc')))
                    .then(tester.sendShadowMessage(null, buildPayload(true)))
                    .then(tester.sendShadowMessage(null, buildPayload([])))
                    .then(tester.sendShadowMessage(null, buildPayload({})))
                    .then(tester.sendShadowMessage(null, buildPayload(() => {})))
                    .then(tester.checkNoAction())
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });

            it('should ignore non error messages that do not have a valid action property', (done) => {
                const tester = new MessageTester();

                function buildPayload(action) {
                    return {
                        action: action
                    };
                }

                expect(tester.init(true)).to.be.fulfilled
                    .then(tester.captureWatchShadowCallback())
                    .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage(null, buildPayload(undefined)))
                    .then(tester.sendShadowMessage(null, buildPayload(null)))
                    .then(tester.sendShadowMessage(null, buildPayload(123)))
                    .then(tester.sendShadowMessage(null, buildPayload('')))
                    .then(tester.sendShadowMessage(null, buildPayload('bad-action')))
                    .then(tester.sendShadowMessage(null, buildPayload(true)))
                    .then(tester.sendShadowMessage(null, buildPayload([])))
                    .then(tester.sendShadowMessage(null, buildPayload({})))
                    .then(tester.sendShadowMessage(null, buildPayload(() => {})))
                    .then(tester.checkNoAction())
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });

            it('should ignore non error messages that do not have a valid state property', (done) => {
                const tester = new MessageTester();

                function buildPayload(state) {
                    return {
                        action: 'get_shadow',
                        state: state
                    };
                }

                expect(tester.init(true)).to.be.fulfilled
                    .then(tester.captureWatchShadowCallback())
                    .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage(null, buildPayload(undefined)))
                    .then(tester.sendShadowMessage(null, buildPayload(null)))
                    .then(tester.sendShadowMessage(null, buildPayload(123)))
                    .then(tester.sendShadowMessage(null, buildPayload('abc')))
                    .then(tester.sendShadowMessage(null, buildPayload(true)))
                    .then(tester.sendShadowMessage(null, buildPayload([])))
                    .then(tester.sendShadowMessage(null, buildPayload(() => {})))
                    .then(tester.checkNoAction())
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });

            it('should ignore non error messages that do not define a connector list within the state', (done) => {
                const tester = new MessageTester();

                function buildPayload(connectors) {
                    return {
                        action: 'get_shadow',
                        state: {
                            connectors: connectors
                        }
                    };
                }

                expect(tester.init(true)).to.be.fulfilled
                    .then(tester.captureWatchShadowCallback())
                    .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage(null, buildPayload(undefined)))
                    .then(tester.sendShadowMessage(null, buildPayload(null)))
                    .then(tester.sendShadowMessage(null, buildPayload(123)))
                    .then(tester.sendShadowMessage(null, buildPayload('abc')))
                    .then(tester.sendShadowMessage(null, buildPayload(true)))
                    .then(tester.sendShadowMessage(null, buildPayload({})))
                    .then(tester.sendShadowMessage(null, buildPayload(() => {})))
                    .then(tester.checkNoAction())
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });

            it('should ignore non error messages that do not define a command list within the state', (done) => {
                const tester = new MessageTester();

                function buildPayload(commands) {
                    return {
                        action: 'get_shadow',
                        state: {
                            connectors: ['foo', 'bar', 'baz'],
                            commands: commands
                        }
                    };
                }

                expect(tester.init(true)).to.be.fulfilled
                    .then(tester.captureWatchShadowCallback())
                    .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage(null, buildPayload(undefined)))
                    .then(tester.sendShadowMessage(null, buildPayload(null)))
                    .then(tester.sendShadowMessage(null, buildPayload(123)))
                    .then(tester.sendShadowMessage(null, buildPayload('abc')))
                    .then(tester.sendShadowMessage(null, buildPayload(true)))
                    .then(tester.sendShadowMessage(null, buildPayload({})))
                    .then(tester.sendShadowMessage(null, buildPayload(() => {})))
                    .then(tester.checkNoAction())
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });
        });

        describe('[connector list messages]', () => {

            function _buildPayload() {
                const conList = Array.prototype.slice.call(arguments);
                return {
                    action: 'get_shadow',
                    state: {
                        connectors: conList,
                        commands: []
                    }
                };
            }

            it('should send start watching every new connector that has been added to the shadow', (done) => {
                const tester = new MessageTester();

                expect(tester.init(true)).to.be.fulfilled
                    .then(tester.captureWatchShadowCallback())
                    .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage(null, _buildPayload('foo', 'bar', 'baz')))
                    .then(tester.testWatchShadow(['foo', 'bar', 'baz']))
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });

            it('should not repeat a watch if a connector is already being watched', (done) => {
                const tester = new MessageTester();

                expect(tester.init(true)).to.be.fulfilled
                    .then(tester.captureWatchShadowCallback())
                    .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage(null, _buildPayload('foo', 'bar', 'baz')))

                .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage(null, _buildPayload('foo', 'bar', 'baz',
                        'goo', 'gar', 'gaz')))
                    .then(tester.testWatchShadow(['goo', 'gar', 'gaz']))

                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
            });

            it('should stop watching connectors if the shadow connector list does not contain a previously watched connector', (done) => {
                const tester = new MessageTester();

                expect(tester.init(true)).to.be.fulfilled
                    .then(tester.captureWatchShadowCallback())
                    .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage(null, _buildPayload('foo', 'bar', 'baz')))

                .then(tester.resetWatchShadowSpy())
                    .then(tester.sendShadowMessage(null, _buildPayload('foo', 'gar', 'gaz')))
                    .then(tester.testWatchShadow(['gar', 'gaz']))
                    .then(tester.testStopWatching(['bar', 'baz']))

                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
            });
        });

        describe('[command messages]', () => {
            xit('should emit a cnc event for every valid command object in the command array', (done) => {});
        });
    });

});
