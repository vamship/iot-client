/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _assertionHelper = require('wysknd-test').assertionHelper;
const Promise = require('bluebird').Promise;
const EventEmitter = require('events').EventEmitter;

const Connector = require('../../../lib/connectors/connector');

describe('Connector', () => {
    const DEFAULT_CONNECTOR_ID = '__connector_id__';
    const DEFAULT_CONNECTOR_TYPE = '__connector_type__';

    const CONNECTOR_STATE_INIT = 'init';
    const CONNECTOR_STATE_STARTED = 'started';
    const CONNECTOR_STATE_STOPPED = 'stopped';
    const CONNECTOR_STATE_STARTING_UP = 'starting_up';
    const CONNECTOR_STATE_SHUTTING_DOWN = 'shutting_down';
    const CONNECTOR_STATE_ERROR = 'error';

    function _createConnector(id, type) {
        id = id || DEFAULT_CONNECTOR_ID;
        type = type || DEFAULT_CONNECTOR_TYPE;
        const connector = new Connector(id, type, {});

        // Handle the error event so that tests don't throw
        // unexpected errors.
        connector.on('error', () => {});

        return connector;
    }

    describe('[static members]', () => {
        it('should define required static members', () => {
            expect(Connector).to.have.property('CONNECTOR_STATE_INIT', CONNECTOR_STATE_INIT);
            expect(Connector).to.have.property('CONNECTOR_STATE_STARTING_UP', CONNECTOR_STATE_STARTING_UP);
            expect(Connector).to.have.property('CONNECTOR_STATE_STARTED', CONNECTOR_STATE_STARTED);
            expect(Connector).to.have.property('CONNECTOR_STATE_SHUTTING_DOWN', CONNECTOR_STATE_SHUTTING_DOWN);
            expect(Connector).to.have.property('CONNECTOR_STATE_STOPPED', CONNECTOR_STATE_STOPPED);
            expect(Connector).to.have.property('CONNECTOR_STATE_ERROR', CONNECTOR_STATE_ERROR);
        });
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid connector id', () => {
            const error = 'Invalid connector id specified (arg #1)';

            function invoke(id) {
                return () => {
                    const connector = new Connector(id);
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

        it('should throw an error if invoked without a valid connector type', () => {
            const error = 'Invalid connector type specified (arg #2)';

            function invoke(type) {
                return () => {
                    const id = DEFAULT_CONNECTOR_ID;
                    const connector = new Connector(id, type);
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

        it('should throw an error if invoked without a valid configuration object', () => {
            const error = 'Invalid configuration specified (arg #3)';

            function invoke(config) {
                return () => {
                    const id = DEFAULT_CONNECTOR_ID;
                    const type = DEFAULT_CONNECTOR_TYPE;
                    const connector = new Connector(id, type, config);
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

        it('should return an object that exposes the required methods and properties', () => {
            const id = 'some_connector_id';
            const type = 'some_connector_type';
            const connector = _createConnector(id, type);

            expect(connector).to.be.an('object');
            expect(connector).to.be.an.instanceof(EventEmitter);
            expect(connector.id).to.be.a('string').and.to.equal(id);
            expect(connector.type).to.be.a('string').and.to.equal(type);
            expect(connector.config).to.be.an('object');
            expect(connector.state).to.be.a('string').and.to.equal(CONNECTOR_STATE_INIT);

            expect(connector._configure).to.be.a('function');
            expect(connector._start).to.be.a('function');
            expect(connector._stop).to.be.a('function');

            expect(connector.start).to.be.a('function');
            expect(connector.stop).to.be.a('function');
        });

        it('should create a clone of the config, and expose it via the "config" property', () => {
            const id = 'some_connector_id';
            const type = 'some_connector_type';
            const config = {
                thingId: 'some_thing_id',
                foo: 'bar'
            };
            const connector = new Connector(id, type, config);

            expect(connector.config).to.deep.equal(config);
            expect(connector.config).to.not.equal(config);
        });
    });

    describe('start()', () => {
        it('should return a promise when invoked', () => {
            const connector = _createConnector();
            connector._start = () => {};

            const ret = connector.start();

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should reject the promise if the connector is not in a valid state to start', (done) => {
            function doTest(initialState) {
                return () => {
                    const connector = _createConnector();
                    connector._state = initialState;
                    const error = `Connector cannot be started when in [${initialState}] state`;

                    return expect(connector.start()).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(CONNECTOR_STATE_STOPPED))
                .then(doTest(CONNECTOR_STATE_SHUTTING_DOWN))
                .then(doTest(CONNECTOR_STATE_STARTED))
                .then(doTest(CONNECTOR_STATE_STARTING_UP))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should invoke the "_configure()" method, and then the "_start()" method', () => {
            const connector = _createConnector();
            var callIndex = 1;
            var configCallIndex = 0;
            var startCallIndex = 0;

            const configureSpy = _sinon.stub(connector, '_configure', () => {
                configCallIndex = callIndex;
                callIndex++;
            });
            const startSpy = _sinon.stub(connector, '_start', () => {
                startCallIndex = callIndex;
                callIndex++;
            });

            expect(configureSpy).to.not.have.been.called;
            expect(startSpy).to.not.have.been.called;

            const ret = connector.start();

            expect(configureSpy).to.have.been.calledOnce;
            expect(startSpy).to.have.been.calledOnce;
            expect(configCallIndex).to.equal(1);
            expect(startCallIndex).to.equal(2);
        });

        it('should reject the promise if the "_configure()" method throws an error', (done) => {
            const error = 'something went wrong';
            const connector = _createConnector();

            const spy = _sinon.stub(connector, '_configure', () => {
                throw new Error(error);
            });

            const ret = connector.start();
            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });

        it('should reject the promise if the "_start()" method throws an error', (done) => {
            const error = 'something went wrong';
            const connector = _createConnector();

            const spy = _sinon.stub(connector, '_start', () => {
                throw new Error(error);
            });

            const ret = connector.start();
            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });

        it('should resolve the promise if no errors are thrown by "_configure()" and "_start()"', (done) => {
            const connector = _createConnector();

            const configureSpy = _sinon.stub(connector, '_configure');
            const startSpy = _sinon.stub(connector, '_start');

            const ret = connector.start();
            expect(ret).to.be.fulfilled.and.notify(done);
        });

        it('should wait for resolution if the "_start()" method returns a promise, and is resolved', (done) => {
            const connector = _createConnector();
            var _resolve = null;
            var _reject = null;

            const spy = _sinon.stub(connector, '_start', () => {
                return new Promise((resolve, reject) => {
                    _resolve = resolve;
                    _reject = reject;
                });
            });

            const ret = connector.start();
            expect(ret.isFulfilled()).to.be.false;

            _resolve();
            expect(ret).to.be.fulfilled
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should wait for rejection if the "_start()" method returns a promise, and is rejected', (done) => {
            const error = 'something went wrong';
            const connector = _createConnector();
            var _resolve = null;
            var _reject = null;

            const spy = _sinon.stub(connector, '_start', () => {
                return new Promise((resolve, reject) => {
                    _resolve = resolve;
                    _reject = reject;
                });
            });

            const ret = connector.start();
            expect(ret.isFulfilled()).to.be.false;

            _reject(new Error(error));
            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });

        describe('[state transitions]', () => {
            it('should go through correct state transitions for a successful startup', (done) => {
                const connector = _createConnector();
                var _resolve = null;
                var _reject = null;

                const spy = _sinon.stub(connector, '_start', () => {
                    return new Promise((resolve, reject) => {
                        _resolve = resolve;
                        _reject = reject;
                    });
                });

                function doTest() {
                    expect(connector.state).to.equal(Connector.CONNECTOR_STATE_STARTED);
                }

                const ret = connector.start();
                expect(connector.state).to.equal(Connector.CONNECTOR_STATE_STARTING_UP);

                _resolve();
                expect(ret).to.be.fulfilled
                    .then(doTest)
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });

            it('should go through correct state transitions for a failed startup', (done) => {
                const error = 'something went wrong';
                const connector = _createConnector();
                var _resolve = null;
                var _reject = null;

                const spy = _sinon.stub(connector, '_start', () => {
                    return new Promise((resolve, reject) => {
                        _resolve = resolve;
                        _reject = reject;
                    });
                });

                function doTest() {
                    expect(connector.state).to.equal(Connector.CONNECTOR_STATE_ERROR);
                }

                const ret = connector.start();
                expect(connector.state).to.equal(Connector.CONNECTOR_STATE_STARTING_UP);

                _reject(new Error(error));
                expect(ret).to.be.rejectedWith(error)
                    .then(doTest)
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });
        });
    });

    describe('stop()', () => {
        it('should return a promise when invoked', () => {
            const connector = _createConnector();
            connector._state = CONNECTOR_STATE_STARTED;
            connector._stop = () => {};

            const ret = connector.stop();

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should reject the promise if the connector is not in a valid state to start', (done) => {
            function doTest(initialState) {
                return () => {
                    const connector = _createConnector();
                    connector._state = initialState;
                    const error = `Connector cannot be stopped when in [${initialState}] state`;

                    return expect(connector.stop()).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(CONNECTOR_STATE_INIT))
                .then(doTest(CONNECTOR_STATE_STARTING_UP))
                .then(doTest(CONNECTOR_STATE_SHUTTING_DOWN))
                .then(doTest(CONNECTOR_STATE_STOPPED))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should invoke the "_stop()" method', () => {
            const connector = _createConnector();
            connector._state = CONNECTOR_STATE_STARTED;

            const spy = _sinon.stub(connector, '_stop', () => {});

            expect(spy).to.not.have.been.called;

            const ret = connector.stop();

            expect(spy).to.have.been.calledOnce;
        });

        it('should reject the promise if the "_stop()" method throws an error', (done) => {
            const error = 'something went wrong';
            const connector = _createConnector();
            connector._state = CONNECTOR_STATE_STARTED;

            const spy = _sinon.stub(connector, '_stop', () => {
                throw new Error(error);
            });

            const ret = connector.stop();
            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });

        it('should resolve the promise if no errors are thrown by "_stop()"', (done) => {
            const connector = _createConnector();
            connector._state = CONNECTOR_STATE_STARTED;

            const startSpy = _sinon.stub(connector, '_stop');

            const ret = connector.stop();
            expect(ret).to.be.fulfilled.and.notify(done);
        });

        it('should wait for resolution if the "_stop()" method returns a promise, and is resolved', (done) => {
            const connector = _createConnector();
            connector._state = CONNECTOR_STATE_STARTED;
            var _resolve = null;
            var _reject = null;

            const spy = _sinon.stub(connector, '_stop', () => {
                return new Promise((resolve, reject) => {
                    _resolve = resolve;
                    _reject = reject;
                });
            });

            const ret = connector.stop();
            expect(ret.isFulfilled()).to.be.false;

            _resolve();
            expect(ret).to.be.fulfilled
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should wait for rejection if the "_stop()" method returns a promise, and is rejected', (done) => {
            const error = 'something went wrong';
            const connector = _createConnector();
            connector._state = CONNECTOR_STATE_STARTED;
            var _resolve = null;
            var _reject = null;

            const spy = _sinon.stub(connector, '_stop', () => {
                return new Promise((resolve, reject) => {
                    _resolve = resolve;
                    _reject = reject;
                });
            });

            const ret = connector.stop();
            expect(ret.isFulfilled()).to.be.false;

            _reject(new Error(error));
            expect(ret).to.be.rejectedWith(error).and.notify(done);
        });

        describe('[state transitions]', () => {
            it('should go through correct state transitions for a successful shutdown', (done) => {
                const connector = _createConnector();
                connector._state = CONNECTOR_STATE_STARTED;
                var _resolve = null;
                var _reject = null;

                const spy = _sinon.stub(connector, '_stop', () => {
                    return new Promise((resolve, reject) => {
                        _resolve = resolve;
                        _reject = reject;
                    });
                });

                function doTest() {
                    expect(connector.state).to.equal(Connector.CONNECTOR_STATE_STOPPED);
                }

                const ret = connector.stop();
                expect(connector.state).to.equal(Connector.CONNECTOR_STATE_SHUTTING_DOWN);

                _resolve();
                expect(ret).to.be.fulfilled
                    .then(doTest)
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });

            it('should go through correct state transitions for a failed shutdown', (done) => {
                const error = 'something went wrong';
                const connector = _createConnector();
                connector._state = CONNECTOR_STATE_STARTED;
                var _resolve = null;
                var _reject = null;

                const spy = _sinon.stub(connector, '_stop', () => {
                    return new Promise((resolve, reject) => {
                        _resolve = resolve;
                        _reject = reject;
                    });
                });

                function doTest() {
                    expect(connector.state).to.equal(Connector.CONNECTOR_STATE_ERROR);
                }

                const ret = connector.stop();
                expect(connector.state).to.equal(Connector.CONNECTOR_STATE_SHUTTING_DOWN);

                _reject(new Error(error));
                expect(ret).to.be.rejectedWith(error)
                    .then(doTest)
                    .then(_assertionHelper.getNotifySuccessHandler(done),
                        _assertionHelper.getNotifyFailureHandler(done));
            });
        });
    });

    describe('_start()', () => {
        it('should throw an error when invoked', () => {
            const error = 'The _start() method has not been implemented.';

            function invoke() {
                return () => {
                    const connector = _createConnector();
                    connector._start();
                };
            }

            expect(invoke()).to.throw(error);
        });
    });

    describe('_stop()', () => {
        it('should throw an error when invoked', () => {
            const error = 'The _stop() method has not been implemented.';

            function invoke() {
                return () => {
                    const connector = _createConnector();
                    connector._stop();
                };
            }

            expect(invoke()).to.throw(error);
        });
    });

});
