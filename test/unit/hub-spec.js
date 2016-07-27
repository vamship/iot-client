/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _clone = require('clone');
const _shortId = require('shortid');
const _assertionHelper = require('wysknd-test').assertionHelper;

const EventEmitter = require('events').EventEmitter;
const Promise = require('bluebird').Promise;
const ConnectorFactory = require('../../lib/connector-factory');
const CloudConnector = require('../../lib/connectors/cloud-connector');
const DeviceConnector = require('../../lib/connectors/device-connector');
const CncRequest = require('../../lib/cnc-request');
const Hub = require('../../lib/hub');

describe('Hub', () => {

    function _buildConnectorClass(BaseType) {
        class Connector extends BaseType {
            constructor(id, config) {
                id = id || _shortId.generate();
                config = config || {};
                super(id, config);
                this._resetPromises();
                this._setupSpies();
            }

            _resetPromises() {
                this._startPromise = new Promise((resolve, reject) => {
                    this.resolveStart = resolve;
                    this.rejectStart = reject;
                });
                this._stopPromise = new Promise((resolve, reject) => {
                    this.resolveStop = resolve;
                    this.rejectStop = reject;
                });
            }

            _setupSpies() {
                this.start = _sinon.stub(this, 'start', () => {
                    return this._startPromise;
                });
                this.stop = _sinon.stub(this, 'stop', () => {
                    return this._stopPromise;
                });
            }

            _emit(event, data) {
                this.emit(event, data);
            }
        }

        return Connector;
    }

    function _initFactory(baseType) {
        baseType = baseType || 'cloud';
        let BaseClass = CloudConnector;
        if (baseType === 'device') {
            BaseClass = DeviceConnector;
        } else if (baseType === 'invalid') {
            BaseClass = class {
                start() {}
                stop() {}
            };
        }
        const ConnectorClass = _buildConnectorClass(BaseClass);
        const info = {
            factory: new ConnectorFactory({}),
            definition: {
                type: 'ConnectorClass',
                config: {
                    foo: 'bar',
                    abc: 123
                }
            },
            connector: new ConnectorClass()
        };

        info.createSpy = _sinon.stub(info.factory, 'createConnector', function(id, type, config) {
            return info.connector;
        });
        return info;
    }

    function _createHub(factory) {
        factory = factory || new ConnectorFactory({});
        return new Hub(factory);
    }

    function _initConnectors() {
        const typeMap = {
            DeviceConnector1: _buildConnectorClass(DeviceConnector),
            DeviceConnector2: _buildConnectorClass(DeviceConnector),
            CloudConnector1: _buildConnectorClass(CloudConnector),
            CloudConnector2: _buildConnectorClass(CloudConnector)
        };
        const factory = new ConnectorFactory({});
        factory._loader._typeMap = _clone(typeMap);
        factory._loader._typeMap.CncConnector = _buildConnectorClass(CloudConnector);

        const hub = new Hub(factory);

        hub.startCnc({
            type: 'CncConnector',
            config: {}
        });
        const cncConnector = hub._connectors.cnc;
        cncConnector.resolveStart();

        const cloudConnectors = [];
        const deviceConnectors = [];

        for (let type in typeMap) {
            const id = `${type}_id`;
            hub.startConnector(id, {
                type: type,
                config: {}
            });
            const connector = hub._connectors.connectors[id];
            connector.resolveStart();

            const info = {
                type: type,
                id: id,
                connector: connector
            };

            if (connector instanceof CloudConnector) {
                info.addDataSpy = _sinon.stub(connector, 'addData');
                cloudConnectors.push(info);
            } else {
                deviceConnectors.push(info);
            }
        }

        return {
            hub: hub,
            cncConnector: cncConnector,
            cloudConnectors: cloudConnectors,
            deviceConnectors: deviceConnectors
        };
    }

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid connctor factory', () => {
            const error = 'Invalid connector factory specified (arg #1)';

            function invoke(factory) {
                return () => {
                    const hub = new Hub(factory);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should return an object that exposes the required properties and methods', () => {
            const hub = new Hub(new ConnectorFactory({}));

            expect(hub).to.be.an('object');
            expect(hub).to.be.an.instanceof(EventEmitter);
            expect(hub.startCnc).to.be.a('function');
            expect(hub.stopCnc).to.be.a('function');
            expect(hub.startConnector).to.be.a('function');
            expect(hub.stopConnector).to.be.a('function');
            expect(hub.shutdown).to.be.a('function');
        });
    });

    describe('startCnc()', () => {

        it('should return a promise when invoked with a valid definition', () => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const ret = hub.startCnc(info.definition);

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should reject the promise if the hub has already been shutdown', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);
            const error = 'Cannot start CnC connector. Hub has been shutdown, or a shutdown is in progress';

            function doTest() {
                return hub.startCnc().then(() => {
                    throw new Error(`Expected hub to throw an error: [${error}]`);
                }, (err) => {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.equal(error);
                });
            }

            const ret = hub.shutdown();

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if invoked without valid CnC connector definition', (done) => {
            function doTest(definition) {
                return () => {
                    const hub = _createHub();
                    const error = `Invalid CnC connector definition specified: [${definition}]`;

                    return expect(hub.startCnc(definition)).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(undefined))
                .then(doTest(null))
                .then(doTest(123))
                .then(doTest('abc'))
                .then(doTest([]))
                .then(doTest(() => {}))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if the CnC connector definition does not define a valid "type" property', (done) => {
            function doTest(type) {
                return () => {
                    const hub = _createHub();
                    const error = `Definition has invalid CnC connector type: [${type}]`;

                    return expect(hub.startCnc({
                        type: type
                    })).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(undefined))
                .then(doTest(null))
                .then(doTest(123))
                .then(doTest(''))
                .then(doTest({}))
                .then(doTest([]))
                .then(doTest(() => {}))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should use the connector factory to create a new CnC connector using the specified definition', () => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            expect(info.createSpy).to.not.have.been.called;
            hub.startCnc(info.definition);
            expect(info.createSpy).to.have.been.calledOnce;
            const args = info.createSpy.args[0];
            expect(args[0]).to.equal('__cnc');
            expect(args[1]).to.equal(info.definition.type);
            expect(args[2]).to.equal(info.definition.config);
        });

        it('should reject the promise if the created connector is not a valid cloud connector', (done) => {
            function doTest() {
                return () => {
                    const info = _initFactory('device');
                    const hub = _createHub(info.factory);
                    const error = `Cnc connector type does not correspond to a valid cloud connector: [${info.definition.type}]`;

                    return expect(hub.startCnc(info.definition)).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(true))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should start the newly created CnC connector if it is a valid cloud connector', () => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            expect(info.connector.start).to.not.have.been.called;
            hub.startCnc(info.definition);
            expect(info.connector.start).to.have.been.calledOnce;
        });

        it('should resolve the promise if the cnc connector is successfully initialized', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const ret = hub.startCnc(info.definition);
            info.connector.resolveStart();
            expect(ret).to.be.fulfilled.and.notify(done);
        });

        it('should reject the promise if the cnc connector initialization fails', (done) => {
            const error = 'something went wrong';
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const ret = hub.startCnc(info.definition);
            info.connector.rejectStart(error);
            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });

        it('should reject the promise if a cnc connector has not already been initialized', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const ret = hub.startCnc(info.definition);
            info.connector.resolveStart();

            const error = 'The CnC connector has already been initialized.';

            expect(ret).to.be.fulfilled
                .then(hub.startCnc.bind(hub, info.definition))
                .then(() => {
                    throw new Error(`Expected hub to throw an error: [${error}]`);
                }, (err) => {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.equal(error);
                })
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should allow a new cnc connector to be initialized if the current connector fails initialization', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const error = 'something went wrong';
            const ret = hub.startCnc(info.definition);
            info.connector.rejectStart(error);

            function doTest() {
                info.connector._resetPromises();
                const ret = hub.startCnc(info.definition);
                info.connector.resolveStart();
                return ret;
            }

            expect(ret).to.be.rejectedWith(error)
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        describe('[events]', () => {
            function _createCommand(action, params) {
                action = action || '__cnc_action__';
                params = params || {};
                return {
                    id: _shortId.generate(),
                    action: action,
                    params: params
                };
            }

            it('should emit a "cnc" event if the cnc connector emits a data event', (done) => {
                const info = _initFactory();
                const hub = _createHub(info.factory);

                const spy = _sinon.spy();
                hub.on('cnc', spy);

                const ret = hub.startCnc(info.definition);
                info.connector.resolveStart();

                function doTest() {
                    expect(spy).to.not.have.been.called;
                    info.connector._emit('data', _createCommand());
                    expect(spy).to.have.been.calledOnce;
                }

                expect(ret).to.be.fulfilled
                    .then(doTest)
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });

            it('should pass a CncRequest object as an argument of the cnc event', (done) => {
                const info = _initFactory();
                const hub = _createHub(info.factory);

                const spy = _sinon.spy();
                hub.on('cnc', spy);

                const ret = hub.startCnc(info.definition);
                info.connector.resolveStart();

                function doTest() {
                    const action = 'some_cnc_action';
                    const params = {
                        connectorId: 'bar',
                        config: {
                            pollFrequency: 1000
                        }
                    };
                    const command = _createCommand(action, params);
                    info.connector._emit('data', command);

                    const arg = spy.args[0][0];
                    expect(arg).to.be.an.instanceof(CncRequest);
                    expect(arg.action).to.equal(action);
                    expect(arg.getParam('connectorId')).to.equal(params.connectorId);
                    expect(arg.getParam('config')).to.deep.equal(params.config);
                }

                expect(ret).to.be.fulfilled
                    .then(doTest)
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });
        });
    });

    describe('stopCnc()', () => {
        function _startCnc() {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const ret = hub.startCnc(info.definition);
            info.connector.resolveStart();

            return {
                hub: hub,
                info: info,
                startComplete: ret
            };
        }

        it('should return a promise when invoked', (done) => {
            const hubInfo = _startCnc();
            const hub = hubInfo.hub;
            const info = hubInfo.info;
            const startComplete = hubInfo.startComplete;

            function doTest() {
                const ret = hub.stopCnc();
                expect(ret).to.be.an('object');
                expect(ret.then).to.be.a('function');
            }

            expect(startComplete).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if the hub has already been shutdown', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);
            const error = 'Cannot stop CnC connector. Hub has been shutdown, or a shutdown is in progress';

            function doTest() {
                return hub.stopCnc().then(() => {
                    throw new Error(`Expected hub to throw an error: [${error}]`);
                }, (err) => {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.equal(error);
                });
            }

            const ret = hub.shutdown();

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if a cnc connector has not been initialized', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const error = 'The CnC connector has not yet been started.';
            const ret = hub.stopCnc();
            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });

        it('should stop the CnC connector if one has been initialized', (done) => {
            const hubInfo = _startCnc();
            const hub = hubInfo.hub;
            const info = hubInfo.info;
            const startComplete = hubInfo.startComplete;

            function doTest() {
                expect(info.connector.stop).to.not.have.been.called;
                hub.stopCnc();
                expect(info.connector.stop).to.have.been.calledOnce;
            }

            expect(startComplete).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should resolve the promise if the cnc connector is successfully stopped', (done) => {
            const hubInfo = _startCnc();
            const hub = hubInfo.hub;
            const info = hubInfo.info;
            const startComplete = hubInfo.startComplete;

            function doTest() {
                const promise = hub.stopCnc();
                info.connector.resolveStop();
                return promise;
            }

            expect(startComplete).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if the cnc connector fails during stop', (done) => {
            const hubInfo = _startCnc();
            const hub = hubInfo.hub;
            const info = hubInfo.info;
            const startComplete = hubInfo.startComplete;

            const error = 'something went wrong';

            function doTest() {
                const promise = hub.stopCnc();
                info.connector.rejectStop(new Error(error));
                return promise.then(() => {
                    throw new Error(`Expected connector to throw an error: [${error}]`);
                }, () => {
                    expect(promise.isRejected()).to.be.true;
                    const err = promise.reason();
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.equal(error);
                });
            }

            expect(startComplete).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should allow a new cnc connector to be initialized after the current connector has been stopped', (done) => {
            const hubInfo = _startCnc();
            const info = hubInfo.info;
            const hub = hubInfo.hub;

            function stopCnc() {
                const ret = hub.stopCnc();
                info.connector.resolveStop();
                return ret;
            }

            function doTest() {
                //This should already be resolved, but resolving again should
                //not cause any problems.
                const promise = hub.startCnc(info.definition);
                info.connector.resolveStart();
            }

            expect(hubInfo.startComplete).to.be.fulfilled
                .then(stopCnc)
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });
    });

    describe('startConnector()', () => {
        it('should return a promise when invoked with a valid id and definition', () => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const ret = hub.startConnector(_shortId.generate(), info.definition);

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should reject the promise if the hub has already been shutdown', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);
            const error = 'Cannot start connector. Hub has been shutdown, or a shutdown is in progress';

            function doTest() {
                return hub.startConnector().then(() => {
                    throw new Error(`Expected hub to throw an error: [${error}]`);
                }, (err) => {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.equal(error);
                });
            }

            const ret = hub.shutdown();

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if invoked without valid connector id', (done) => {
            function doTest(id) {
                return () => {
                    const hub = _createHub();
                    const error = `Invalid connector id specified: [${id}]`;

                    return expect(hub.startConnector(id)).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(undefined))
                .then(doTest(null))
                .then(doTest(123))
                .then(doTest(''))
                .then(doTest([]))
                .then(doTest(() => {}))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if invoked without valid connector definition', (done) => {
            function doTest(definition) {
                return () => {
                    const hub = _createHub();
                    const error = `Invalid connector definition specified: [${definition}]`;
                    const id = _shortId.generate();

                    return expect(hub.startConnector(id, definition)).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(undefined))
                .then(doTest(null))
                .then(doTest(123))
                .then(doTest('abc'))
                .then(doTest([]))
                .then(doTest(() => {}))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if the connector definition does not define a valid "type" property', (done) => {
            function doTest(type) {
                return () => {
                    const hub = _createHub();
                    const error = `Definition has invalid connector type: [${type}]`;
                    const id = _shortId.generate();

                    return expect(hub.startConnector(id, {
                        type: type
                    })).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(undefined))
                .then(doTest(null))
                .then(doTest(123))
                .then(doTest(''))
                .then(doTest({}))
                .then(doTest([]))
                .then(doTest(() => {}))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should use the connector factory to create a new connector using the specified definition', () => {
            const info = _initFactory();
            const hub = _createHub(info.factory);
            const id = _shortId.generate();

            expect(info.createSpy).to.not.have.been.called;
            hub.startConnector(id, info.definition);
            expect(info.createSpy).to.have.been.calledOnce;

            const args = info.createSpy.args[0];
            expect(args[0]).to.equal(id);
            expect(args[1]).to.equal(info.definition.type);
            expect(args[2]).to.equal(info.definition.config);
        });

        it('should reject the promise if the created connector is not a valid cloud or device connector', (done) => {
            function doTest() {
                return () => {
                    const info = _initFactory('invalid');
                    const hub = _createHub(info.factory);
                    const error = `Connector type does not correspond to a valid cloud or device connector: [${info.definition.type}]`;
                    const id = _shortId.generate();

                    return expect(hub.startConnector(id, info.definition)).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(true))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should start the newly created connector if it is a valid connector', () => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            expect(info.connector.start).to.not.have.been.called;
            hub.startConnector(_shortId.generate(), info.definition);
            expect(info.connector.start).to.have.been.calledOnce;
        });

        it('should resolve the promise if the connector is successfully initialized', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const ret = hub.startConnector(_shortId.generate(), info.definition);
            info.connector.resolveStart();
            expect(ret).to.be.fulfilled.and.notify(done);
        });

        it('should reject the promise if the connector initialization fails', (done) => {
            const error = 'something went wrong';
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const ret = hub.startConnector(_shortId.generate(), info.definition);
            info.connector.rejectStart(error);
            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });

        it('should reject the promise if a connector with the specified id has already been initialized', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const id = _shortId.generate();
            const ret = hub.startConnector(id, info.definition);

            info.connector.resolveStart();

            const error = `Connector has already been initialized: [${id}]`;

            expect(ret).to.be.fulfilled
                .then(hub.startConnector.bind(hub, id, info.definition))
                .then(() => {
                    throw new Error(`Expected hub to throw an error: [${error}]`);
                }, (err) => {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.equal(error);
                })
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should allow a new connector to be initialized if the current connector fails initialization', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);
            const id = _shortId.generate();

            const error = 'something went wrong';
            const ret = hub.startConnector(id, info.definition);
            info.connector.rejectStart(error);

            function doTest() {
                info.connector._resetPromises();
                const ret = hub.startConnector(id, info.definition);
                info.connector.resolveStart();
                return ret;
            }

            expect(ret).to.be.rejectedWith(error)
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        describe('[events]', () => {

            it('should capture data emitted by device connectors and add the data to all cloud connectors', () => {
                const info = _initConnectors();
                const hub = info.hub;
                const cloudConnectors = info.cloudConnectors;
                const deviceConnectors = info.deviceConnectors;

                cloudConnectors.forEach((info) => {
                    expect(info.addDataSpy).to.not.have.been.called;
                });

                deviceConnectors.forEach((info) => {
                    info.connector._emit('data', {
                        id: info.id
                    });
                });

                cloudConnectors.forEach((info) => {
                    expect(info.addDataSpy).to.have.been.called;
                    expect(info.addDataSpy.callCount).to.equal(deviceConnectors.length);
                    info.addDataSpy.args.forEach((args, index) => {
                        expect(args[0]).to.be.an('object');
                        expect(args[0].id).to.equal(deviceConnectors[index].id);
                    });
                });
            });

            it('should not capture any "data" events from cloud connectors', () => {
                const info = _initConnectors();
                const hub = info.hub;
                const cloudConnectors = info.cloudConnectors;
                const deviceConnectors = info.deviceConnectors;

                cloudConnectors.forEach((info) => {
                    expect(info.addDataSpy).to.not.have.been.called;
                });

                cloudConnectors.forEach((info) => {
                    info.connector._emit('data', {
                        id: info.id
                    });
                });

                cloudConnectors.forEach((info) => {
                    expect(info.addDataSpy).to.not.have.been.called;
                });
            });
        });
    });

    describe('stopConnector()', () => {
        it('should return a promise when invoked', (done) => {
            const info = _initConnectors();
            const hub = info.hub;
            const cloudConnectors = info.cloudConnectors;
            const deviceConnectors = info.deviceConnectors;

            function doTest() {
                deviceConnectors.concat(cloudConnectors).forEach((info) => {
                    const ret = hub.stopConnector(info.id);
                    expect(ret).to.be.an('object');
                    expect(ret.then).to.be.a('function');
                });
            }

            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if a connector with the specified id has not been initialized', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);

            const id = 'bad-connector-id';
            const error = `A connector with id [${id}] not yet been started.`;
            const ret = hub.stopConnector(id);
            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });

        it('should stop the connector if one has been initialized', (done) => {
            const info = _initConnectors();
            const hub = info.hub;
            const cloudConnectors = info.cloudConnectors;
            const deviceConnectors = info.deviceConnectors;

            function doTest() {
                deviceConnectors.concat(cloudConnectors).forEach((info) => {
                    expect(info.connector.stop).to.not.have.been.called;
                    const ret = hub.stopConnector(info.id);
                    expect(info.connector.stop).to.have.been.calledOnce;
                });
            }

            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should resolve the promise if the connector is successfully stopped', (done) => {
            const info = _initConnectors();
            const hub = info.hub;
            const cloudConnectors = info.cloudConnectors;
            const deviceConnectors = info.deviceConnectors;

            function doTest() {
                const promises = [];
                deviceConnectors.concat(cloudConnectors).forEach((info) => {
                    const promise = hub.stopConnector(info.id);
                    promises.push(promise);
                    info.connector.resolveStop();
                });

                return Promise.all(promises);
            }

            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if the connector fails during stop', (done) => {
            const info = _initConnectors();
            const hub = info.hub;
            const cloudConnectors = info.cloudConnectors;
            const deviceConnectors = info.deviceConnectors;

            const error = 'something went wrong';

            function doTest() {
                const promises = [];
                deviceConnectors.concat(cloudConnectors).forEach((info) => {
                    const promise = hub.stopConnector(info.id);
                    promises.push(promise);
                    info.connector.rejectStop(new Error(error));
                });

                return Promise.all(promises).then(() => {
                    throw new Error(`Expected connector to throw an error: [${error}]`);
                }, () => {
                    promises.forEach((promise) => {
                        expect(promise.isRejected()).to.be.true;
                        const err = promise.reason();
                        expect(err).to.be.an.instanceof(Error);
                        expect(err.message).to.equal(error);
                    });
                });
            }

            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should allow a new connector to be initialized after the connector has been stopped', (done) => {
            const info = _initConnectors();
            const hub = info.hub;
            const cloudConnectors = info.cloudConnectors;
            const deviceConnectors = info.deviceConnectors;

            function stopConnectors() {
                const promises = [];
                deviceConnectors.concat(cloudConnectors).forEach((info) => {
                    const promise = hub.stopConnector(info.id);
                    promises.push(promise);
                    info.connector.resolveStop();
                });

                return Promise.all(promises);
            }

            function doTest() {
                const promises = [];
                deviceConnectors.concat(cloudConnectors).forEach((info) => {
                    const config = {
                        type: info.type,
                        config: {}
                    };
                    const promise = hub.startConnector(info.id, config);
                    //This should already be resolved, but resolving again should
                    //not cause any problems.
                    info.connector.resolveStart();
                    promises.push(promise);
                });

                return promises;
            }

            expect(Promise.resolve(true)).to.be.fulfilled
                .then(stopConnectors)
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });
    });

    describe('shutdown()', () => {
        it('should return a promise when invoked', (done) => {
            const info = _initConnectors();
            const hub = info.hub;
            const cloudConnectors = info.cloudConnectors;
            const deviceConnectors = info.deviceConnectors;

            function doTest() {
                const ret = hub.shutdown();
                expect(ret).to.be.an('object');
                expect(ret.then).to.be.a('function');
            }

            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if the hub has already been shutdown', (done) => {
            const info = _initFactory();
            const hub = _createHub(info.factory);
            const error = 'Cannot shutdown hub. Hub has been shutdown, or a shutdown is in progress';

            function doTest() {
                return hub.shutdown().then(() => {
                    throw new Error(`Expected hub to throw an error: [${error}]`);
                }, (err) => {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.equal(error);
                });
            }

            const ret = hub.shutdown();

            expect(ret).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should stop all connectors that have been initialized', (done) => {
            const info = _initConnectors();
            const hub = info.hub;
            const cloudConnectors = info.cloudConnectors;
            const deviceConnectors = info.deviceConnectors;

            function doTest() {
                deviceConnectors.concat(cloudConnectors).forEach((info) => {
                    expect(info.connector.stop).to.not.have.been.called;
                });

                const promise = hub.shutdown();

                deviceConnectors.concat(cloudConnectors).forEach((info) => {
                    expect(info.connector.stop).to.have.been.calledOnce;
                });
            }

            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should stop the CNC connector after all of the other connectors have been stopped', (done) => {
            const info = _initConnectors();
            const hub = info.hub;
            const cloudConnectors = info.cloudConnectors;
            const deviceConnectors = info.deviceConnectors;

            const shutdownPromise = hub.shutdown();

            function checkCncNotStopped() {
                expect(info.cncConnector.stop).to.not.have.been.called;
            }

            function fulfillConnectors() {
                deviceConnectors.concat(cloudConnectors).forEach((info, index) => {
                    if (index % 2 === 0) {
                        info.connector.resolveStop();
                    } else {
                        info.connector.rejectStop('some error');
                    }
                });
            }

            function checkCncStopCalled() {
                expect(info.cncConnector.stop).to.have.been.calledOnce;
            }

            expect(Promise.resolve(true)).to.be.fulfilled
                .then(_assertionHelper.wait(10))
                .then(checkCncNotStopped)
                .then(fulfillConnectors)
                .then(_assertionHelper.wait(10))
                .then(checkCncStopCalled)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should resolve the promise after all connectors and the CNC connector have been stopped', (done) => {
            const info = _initConnectors();
            const hub = info.hub;
            const cloudConnectors = info.cloudConnectors;
            const deviceConnectors = info.deviceConnectors;

            const shutdownPromise = hub.shutdown();

            function checkNotResolved() {
                expect(shutdownPromise.isPending()).to.be.true;
            }

            function fulfillConnectorsAndCnc() {
                deviceConnectors.concat(cloudConnectors).forEach((info, index) => {
                    if (index % 2 === 0) {
                        info.connector.resolveStop();
                    } else {
                        info.connector.rejectStop('some error');
                    }
                });
                info.cncConnector.resolveStop();
                info.cncConnector.stop();
            }

            function checkResolved() {
                return shutdownPromise;
            }

            expect(Promise.resolve(true)).to.be.fulfilled
                .then(_assertionHelper.wait(10))
                .then(checkNotResolved)
                .then(fulfillConnectorsAndCnc)
                .then(_assertionHelper.wait(10))
                .then(checkResolved)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });
    });

});
