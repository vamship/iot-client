/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _shortId = require('shortid');
const _rewire = require('rewire');
const _clone = require('clone');
let AwsShadowManager = null;

describe('AwsShadowManager', () => {
    const DEFAULT_CERT_PATH = '/some/agent/cert';
    const DEFAULT_KEY_PATH = '/some/agent/private/key';
    const DEFAULT_CA_PATH = '/some/server/cert';
    const DEFAULT_CLIENT_ID = 'client_id';
    const DEFAULT_REGION = 'us-east-1';
    const DEFAULT_THING_NAME = '__thing_name__';
    let _awsIotSdkMock = null;

    function _createShadowManagerConfig(config) {
        config = config || {};
        config.certPath = config.certPath || DEFAULT_CERT_PATH;
        config.keyPath = config.keyPath || DEFAULT_KEY_PATH;
        config.caPath = config.caPath || DEFAULT_CA_PATH;
        config.clientId = config.clientId || DEFAULT_CLIENT_ID;
        config.region = config.region || DEFAULT_REGION;

        return config;
    }

    function _createShadowManager(config) {
        config = _createShadowManagerConfig(config);
        const manager = new AwsShadowManager(config);

        return manager;
    }

    function _createAndConnectManager() {
        const manager = _createShadowManager();
        manager.start();
        _awsIotSdkMock._shadow._connect();
        return manager;
    }

    beforeEach(() => {
        const shadowObject = {
            _handlers: {},
            _lastRequestId: null,
            on: () => {},
            get: () => {},
            update: () => {},
            register: _sinon.spy(),
            unregister: _sinon.spy(),
            end: _sinon.spy()
        };

        shadowObject.on = _sinon.stub(shadowObject, 'on', function(event, handler) {
            shadowObject._handlers[event] = handler;
        });

        shadowObject.get = _sinon.stub(shadowObject, 'get', function(thingName) {
            const id = _shortId.generate();
            shadowObject._lastRequestId = id;
            return id;
        });

        shadowObject.update = _sinon.stub(shadowObject, 'update', function(thingName) {
            const id = _shortId.generate();
            shadowObject._lastRequestId = id;
            return id;
        });

        shadowObject._connect = () => {
            const handler = shadowObject._handlers.connect;
            handler();
        };

        _awsIotSdkMock = {
            _shadow: shadowObject,
            thingShadow: _sinon.stub().returns(shadowObject)
        };

        AwsShadowManager = _rewire('../../../lib/connectors/aws-shadow-manager');
        AwsShadowManager.__set__('_awsIotSdk', _awsIotSdkMock);
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid config object', () => {
            const error = 'Invalid config specified (arg #1)';

            function invoke(config) {
                return () => {
                    const manager = new AwsShadowManager(config);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(0)).to.throw(error);
            expect(invoke(-1)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if the manager configuration object does not define a valid public key path', () => {
            const error = 'Configuration does not define a valid certPath property';

            function invoke(certPath) {
                const config = {
                    certPath: certPath
                };
                return () => {
                    const manager = new AwsShadowManager(config);
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

        it('should throw an error if the manager configuration object does not define a valid private key path', () => {
            const error = 'Configuration does not define a valid keyPath property';

            function invoke(keyPath) {
                const config = {
                    certPath: DEFAULT_CERT_PATH,
                    keyPath: keyPath
                };
                return () => {
                    const manager = new AwsShadowManager(config);
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

        it('should throw an error if the manager configuration object does not define a valid server cert path', () => {
            const error = 'Configuration does not define a valid caPath property';

            function invoke(caPath) {
                const config = {
                    certPath: DEFAULT_CERT_PATH,
                    keyPath: DEFAULT_KEY_PATH,
                    caPath: caPath
                };
                return () => {
                    const manager = new AwsShadowManager(config);
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

        it('should throw an error if the manager configuration object does not define a valid client id', () => {
            const error = 'Configuration does not define a valid clientId property';

            function invoke(clientId) {
                const config = {
                    certPath: DEFAULT_CERT_PATH,
                    keyPath: DEFAULT_KEY_PATH,
                    caPath: DEFAULT_CA_PATH,
                    clientId: clientId
                };
                return () => {
                    const manager = new AwsShadowManager(config);
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

        it('should throw an error if the manager configuration object does not define a valid aws region', () => {
            const error = 'Configuration does not define a valid region property';

            function invoke(region) {
                const config = {
                    certPath: DEFAULT_CERT_PATH,
                    keyPath: DEFAULT_KEY_PATH,
                    caPath: DEFAULT_CA_PATH,
                    clientId: DEFAULT_CLIENT_ID,
                    region: region
                };
                return () => {
                    const manager = new AwsShadowManager(config);
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

        it('should create a shadow manager when invoked with a valid configuration object', () => {
            const config = {
                certPath: DEFAULT_CERT_PATH,
                keyPath: DEFAULT_KEY_PATH,
                caPath: DEFAULT_CA_PATH,
                clientId: DEFAULT_CLIENT_ID,
                region: DEFAULT_REGION
            };
            const manager = new AwsShadowManager(config);

            expect(manager).to.be.an('object');
            expect(manager.start).to.be.a('function');
            expect(manager.stop).to.be.a('function');
            expect(manager.watchShadow).to.be.a('function');
            expect(manager.stopWatching).to.be.a('function');
            expect(manager.updateState).to.be.a('function');
        });
    });

    describe('start()', () => {
        it('should throw an error if the shadow manager has already been started', () => {
            const error = 'Cannot start shadow manager. Shadow manager has already been started';
            const manager = _createShadowManager();

            function doTest() {
                manager.start();
            }

            manager.start();
            expect(doTest).to.throw(error);
        });

        it('should return a promise when invoked', () => {
            const manager = _createShadowManager();
            const ret = manager.start();

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should attempt to initialize a shadow connection when invoked', () => {
            const config = _createShadowManagerConfig();
            const manager = _createShadowManager(config);

            expect(_awsIotSdkMock.thingShadow).to.not.have.been.called;

            const ret = manager.start();
            expect(_awsIotSdkMock.thingShadow).to.have.been.calledOnce;

            const args = _awsIotSdkMock.thingShadow.args[0][0];
            expect(args).to.deep.equal(config);
        });

        it('should resolve the promise once connection to the AWS cloud succeeds', (done) => {
            const manager = _createShadowManager();

            expect(_awsIotSdkMock.thingShadow).to.not.have.been.called;

            const ret = manager.start();

            // The implicit expectation is that the connect handler
            // is a valid function, registered by the manager.
            const connectHandler = _awsIotSdkMock._shadow._handlers.connect;

            expect(ret.isPending()).to.be.true;
            connectHandler();
            expect(ret).to.be.fulfilled.and.notify(done);
        });

        it('should absorb any errors thrown by the client, allowing for retries without program failure', (done) => {
            const manager = _createShadowManager();
            const ret = manager.start();

            const connectHandler = _awsIotSdkMock._shadow._handlers.connect;
            const errorHandler = _awsIotSdkMock._shadow._handlers.error;

            expect(ret.isPending()).to.be.true;
            errorHandler('foo');
            errorHandler('bar');
            errorHandler('baz');
            connectHandler();
            expect(ret).to.be.fulfilled.and.notify(done);
        });
    });

    describe('stop()', () => {
        it('should throw an error if the shadow manager has not already been started', () => {
            const error = 'Cannot stop shadow manager. Shadow manager has not been started';
            const manager = _createShadowManager();

            function doTest() {
                manager.stop();
            }

            expect(doTest).to.throw(error);
        });

        it('should return a promise when invoked', () => {
            const manager = _createShadowManager();
            manager.start();

            const ret = manager.stop();

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should attempt to close connection to the AWS IoT cloud', (done) => {
            const manager = _createShadowManager();
            const shadow = _awsIotSdkMock._shadow;

            manager.start();

            expect(shadow.end).to.not.have.been.called;

            const ret = manager.stop();
            expect(shadow.end).to.have.been.calledOnce;

            // The implicit expectation is that the end callback
            // is a valid function, registered by the manager.
            const endCallback = shadow.end.args[0][1];
            const forceEnd = shadow.end.args[0][0];

            expect(forceEnd).to.be.false;
            expect(ret.isPending()).to.be.true;

            endCallback();
            expect(ret).to.have.been.fulfilled.and.notify(done);
        });
    });

    describe('watchShadow()', () => {
        it('should throw an error if the shadow manager has not already been started', () => {
            const error = 'Cannot watch for shadow changes. Shadow manager has not been started';
            const manager = _createShadowManager();

            function doTest() {
                manager.watchShadow();
            }

            expect(doTest).to.throw(error);
        });

        it('should throw an error if invoked without a valid thing name', () => {
            const error = 'Invalid thing name specified (arg #1)';

            function invoke(thingName) {
                return () => {
                    const manager = _createAndConnectManager();
                    manager.watchShadow(thingName);
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

        it('should throw an error if invoked without a valid handler', () => {
            const error = 'Invalid callback specified (arg #2)';

            function invoke(handler) {
                return () => {
                    const manager = _createAndConnectManager();
                    const thingName = DEFAULT_THING_NAME;
                    manager.watchShadow(thingName, handler);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke([])).to.throw(error);
        });

        it('should register the thing name with the AWS shadow object when invoked with correct parameters', () => {
            const manager = _createAndConnectManager();
            const thingName = DEFAULT_THING_NAME;
            const shadow = _awsIotSdkMock._shadow;

            expect(shadow.register).to.not.have.been.called;
            manager.watchShadow(thingName, () => {});

            expect(shadow.register).to.have.been.calledOnce;

            const registerArg = shadow.register.args[0][0];
            expect(registerArg).to.equal(thingName);
        });

        it('should automatically fetch the shadow for a thing as soon as it is registered for watching', () => {
            const manager = _createAndConnectManager();
            const thingName = DEFAULT_THING_NAME;
            const shadow = _awsIotSdkMock._shadow;

            expect(shadow.get).to.not.have.been.called;

            manager.watchShadow(thingName, () => {});
            expect(shadow.get).to.have.been.calledOnce;
            expect(shadow.get.args[0][0]).to.equal(thingName);
        });

        describe('[request flow]', () => {

            it('should ignore delta messages for things that are not being watched', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const deltaHandler = shadow._handlers.delta;

                const thingName = DEFAULT_THING_NAME;

                manager.watchShadow(thingName, () => {});
                shadow.get.reset();

                expect(shadow.get).to.not.have.been.called;
                deltaHandler('bad-thing-name');
                expect(shadow.get).to.not.have.been.called;
            });

            it('should trigger a shadow fetch if a delta is received from the AWS IoT cloud after registration', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const deltaHandler = shadow._handlers.delta;

                const thingName = DEFAULT_THING_NAME;

                manager.watchShadow(thingName, () => {});
                shadow.get.reset();

                expect(shadow.get).to.not.have.been.called;
                deltaHandler(thingName);
                expect(shadow.get).to.have.been.calledOnce;
            });

            it('should ignore timeout messages with unrecognized request ids', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const timeoutHandler = shadow._handlers.timeout;

                const thingName = DEFAULT_THING_NAME;

                manager.watchShadow(thingName, () => {});
                shadow.get.reset();

                expect(shadow.get).to.not.have.been.called;
                timeoutHandler('bad-thing-name');
                expect(shadow.get).to.not.have.been.called;
            });

            it('should ignore status messages which do not correspond to a previously made request', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const statusHandler = shadow._handlers.status;
                const callback = _sinon.spy();

                const thingName = DEFAULT_THING_NAME;

                manager.watchShadow(thingName, callback);

                expect(callback).to.not.have.been.called;

                statusHandler(thingName, 'accepted', 'bad-client-token', {});
                expect(callback).to.not.have.been.called;

                statusHandler(thingName, 'accepted', 'another-bad-client-token', {});
                expect(callback).to.not.have.been.called;
            });

            it('should notify the thing shadow callback if the status corresponds to a previously made request', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const statusHandler = shadow._handlers.status;
                const callback = _sinon.spy();

                const thingName = DEFAULT_THING_NAME;

                manager.watchShadow(thingName, callback);

                expect(callback).to.not.have.been.called;

                statusHandler(thingName, 'accepted', shadow._lastRequestId, {});
                expect(callback).to.have.been.calledOnce;
            });

            it('should notify the callback with no errors if the status message from the cloud indicates "accepted"', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const callback = _sinon.spy();
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const cloudState = {
                    foo: 'bar'
                };
                const expectedCallbackArg = {
                    action: 'get_shadow',
                    state: _clone(cloudState)
                };

                manager.watchShadow(thingName, callback);

                expect(callback).to.not.have.been.called;

                statusHandler(thingName, 'accepted', shadow._lastRequestId, cloudState);
                expect(callback).to.have.been.calledOnce;

                const errorArg = callback.args[0][0];
                const callbackArg = callback.args[0][1];
                expect(errorArg).to.be.falsy;
                expect(callbackArg).to.deep.equal(expectedCallbackArg);
            });

            it('should notify the callback with errors if the status message from the cloud indicates "rejected"', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const callback = _sinon.spy();
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const expectedError = 'rejected';

                manager.watchShadow(thingName, callback);

                expect(callback).to.not.have.been.called;

                statusHandler(thingName, 'rejected', shadow._lastRequestId, {});
                expect(callback).to.have.been.calledOnce;

                const errorArg = callback.args[0][0];
                const stateArg = callback.args[0][1];
                expect(errorArg).to.equal(expectedError);
                expect(stateArg).to.be.undefined;
            });

            it('should retry timed out requests up to three times, notifying the callback if a retry succeeds', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const callback = _sinon.spy();
                const timeoutHandler = shadow._handlers.timeout;
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const cloudState = {
                    foo: 'bar'
                };
                const expectedCallbackArg = {
                    action: 'get_shadow',
                    state: _clone(cloudState)
                };

                manager.watchShadow(thingName, callback);

                expect(callback).to.not.have.been.called;
                timeoutHandler(thingName, shadow._lastRequestId);
                expect(callback).to.not.have.been.called;

                expect(callback).to.not.have.been.called;
                timeoutHandler(thingName, shadow._lastRequestId);
                expect(callback).to.not.have.been.called;

                expect(callback).to.not.have.been.called;
                statusHandler(thingName, 'accepted', shadow._lastRequestId, cloudState);
                expect(callback).to.have.been.calledOnce;

                const errorArg = callback.args[0][0];
                const callbackArg = callback.args[0][1];
                expect(errorArg).to.be.falsy;
                expect(callbackArg).to.deep.equal(expectedCallbackArg);
            });

            it('should retry timed out requests up to three times, notifying the callback if all retries fail', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const callback = _sinon.spy();
                const timeoutHandler = shadow._handlers.timeout;
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const expectedError = 'timedout';

                manager.watchShadow(thingName, callback);

                expect(callback).to.not.have.been.called;
                timeoutHandler(thingName, shadow._lastRequestId);
                expect(callback).to.not.have.been.called;

                expect(callback).to.not.have.been.called;
                timeoutHandler(thingName, shadow._lastRequestId);
                expect(callback).to.not.have.been.called;

                expect(callback).to.not.have.been.called;
                timeoutHandler(thingName, shadow._lastRequestId);
                expect(callback).to.have.been.calledOnce;
                expect(callback.args[0][0]).to.equal(expectedError);
                expect(callback.args[0][1]).to.be.falsy;
            });
        });
    });

    describe('stopWatching()', () => {
        it('should throw an error if the shadow manager has not already been started', () => {
            const error = 'Cannot stop watching for shadow changes. Shadow manager has not been started';
            const manager = _createShadowManager();

            function doTest() {
                manager.stopWatching();
            }

            expect(doTest).to.throw(error);
        });


        it('should throw an error if invoked without a valid thing name', () => {
            const error = 'Invalid thing name specified (arg #1)';

            function invoke(thingName) {
                return () => {
                    const manager = _createAndConnectManager();
                    manager.stopWatching(thingName);
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

        it('should do nothing if the specified thing name was not previously registered for a watch', () => {
            const manager = _createAndConnectManager();
            const shadow = _awsIotSdkMock._shadow;

            expect(shadow.unregister).to.not.have.been.called;
            manager.stopWatching('bad-thing-name');
            expect(shadow.unregister).to.not.have.been.called;
        });

        it('should un register the watch on the thing if a valid thing name is specified', () => {
            const manager = _createAndConnectManager();
            const shadow = _awsIotSdkMock._shadow;
            const thingName = DEFAULT_THING_NAME;

            manager.watchShadow(thingName, () => {});

            expect(shadow.unregister).to.not.have.been.called;
            manager.stopWatching(thingName);
            expect(shadow.unregister).to.have.been.calledOnce;
        });

        it('should stop triggering callbacks after the thing is not being watched anymore', () => {
            const manager = _createAndConnectManager();
            const shadow = _awsIotSdkMock._shadow;
            const thingName = DEFAULT_THING_NAME;
            const callback = _sinon.spy();

            manager.watchShadow(thingName, callback);
            const deltaHandler = shadow._handlers.delta;
            const statusHandler = shadow._handlers.status;

            // Handle the first callback that is automatically triggered on watch start.
            statusHandler(thingName, 'accepted', shadow._lastRequestId, {});
            expect(callback).to.have.been.calledOnce;
            callback.reset();


            // Now un register and then trigger a delta.
            manager.stopWatching(thingName);
            deltaHandler(thingName);
            statusHandler(thingName, 'accepted', shadow._lastRequestId, {});

            expect(callback).to.not.have.been.called;
        });
    });

    describe('updateState()', () => {
        it('should throw an error if the shadow manager has not already been started', () => {
            const error = 'Cannot stop report updated state. Shadow manager has not been started';
            const manager = _createShadowManager();

            function doTest() {
                manager.updateState();
            }

            expect(doTest).to.throw(error);
        });

        it('should throw an error if invoked without a valid thing name', () => {
            const error = 'Invalid thing name specified (arg #1)';

            function invoke(thingName) {
                return () => {
                    const manager = _createAndConnectManager();
                    manager.updateState(thingName);
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

        it('should throw an error if invoked without a valid thing state', () => {
            const error = 'Invalid thing state specified (arg #2)';

            function invoke(state) {
                return () => {
                    const manager = _createAndConnectManager();
                    const thingName = DEFAULT_THING_NAME;
                    manager.updateState(thingName, state);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(0)).to.throw(error);
            expect(invoke(-1)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if the specified thing name is not being watched', () => {
            function doTest(thingName) {
                const error = `Cannot update thing state. Specified thing is not being watched: [${thingName}]`;
                const wrapper = () => {
                    const manager = _createAndConnectManager();
                    manager.updateState(thingName, {});
                };

                expect(wrapper).to.throw(error);
            }

            doTest('bad-thing-name');
        });

        it('should notify the AWS IoT cloud of the state change when invoked with a valid thing name and state', () => {
            const manager = _createAndConnectManager();
            const shadow = _awsIotSdkMock._shadow;
            const thingName = DEFAULT_THING_NAME;
            const state = {};

            manager.watchShadow(thingName, () => {});

            expect(shadow.update).to.not.have.been.called;
            manager.updateState(thingName, state);
            expect(shadow.update).to.have.been.calledOnce;

            const thingNameArg = shadow.update.args[0][0];
            const stateArg = shadow.update.args[0][1];
            expect(thingNameArg).to.equal(thingName);
            expect(stateArg).to.equal(state);
        });

        describe('[request flow]', () => {

            it('should ignore timeout messages with unrecognized request ids', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const timeoutHandler = shadow._handlers.timeout;
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const state = {};

                const callback = _sinon.spy();

                manager.watchShadow(thingName, callback);
                statusHandler(thingName, 'accepted', shadow._lastRequestId, {});
                callback.reset();

                manager.updateState(thingName, state);

                expect(callback).to.not.have.been.called;
                timeoutHandler('bad-thing-name');
                expect(callback).to.not.have.been.called;
            });

            it('should ignore status messages which do not correspond to a previously made request', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const timeoutHandler = shadow._handlers.timeout;
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const state = {};

                const callback = _sinon.spy();

                manager.watchShadow(thingName, () => {});
                statusHandler(thingName, 'accepted', shadow._lastRequestId, {});
                callback.reset();

                manager.updateState(thingName, state);
                expect(callback).to.not.have.been.called;

                statusHandler(thingName, 'accepted', 'bad-client-token', {});
                expect(callback).to.not.have.been.called;

                statusHandler(thingName, 'accepted', 'another-bad-client-token', {});
                expect(callback).to.not.have.been.called;
            });

            it('should notify the thing shadow callback if the status corresponds to a previously made request', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const timeoutHandler = shadow._handlers.timeout;
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const state = {};

                const callback = _sinon.spy();

                manager.watchShadow(thingName, callback);
                statusHandler(thingName, 'accepted', shadow._lastRequestId, {});
                callback.reset();

                manager.updateState(thingName, state);
                expect(callback).to.not.have.been.called;

                statusHandler(thingName, 'accepted', shadow._lastRequestId, {});
                expect(callback).to.have.been.calledOnce;
            });

            it('should notify the callback with no errors if the status message from the cloud indicates "accepted"', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const timeoutHandler = shadow._handlers.timeout;
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const cloudState = {
                    foo: 'bar'
                };
                const expectedCallbackArg = {
                    action: 'update_shadow',
                    state: _clone(cloudState)
                };

                const callback = _sinon.spy();

                manager.watchShadow(thingName, callback);
                statusHandler(thingName, 'accepted', shadow._lastRequestId, {});
                callback.reset();

                manager.updateState(thingName, {});
                statusHandler(thingName, 'accepted', shadow._lastRequestId, cloudState);
                expect(callback).to.have.been.calledOnce;

                const error = callback.args[0][0];
                const state = callback.args[0][1];
                expect(error).to.be.falsy;
                expect(state).to.deep.equal(expectedCallbackArg);
            });

            it('should notify the callback with errors if the status message from the cloud indicates "rejected"', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const timeoutHandler = shadow._handlers.timeout;
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const expectedError = 'rejected';

                const callback = _sinon.spy();

                manager.watchShadow(thingName, callback);
                statusHandler(thingName, 'accepted', shadow._lastRequestId, {});
                callback.reset();

                manager.updateState(thingName, {});
                statusHandler(thingName, 'rejected', shadow._lastRequestId, {});
                expect(callback).to.have.been.calledOnce;

                const error = callback.args[0][0];
                const state = callback.args[0][1];
                expect(error).to.equal(expectedError);
                expect(state).to.be.undefined;
            });

            it('should retry timed out requests up to three times, notifying the callback if a retry succeeds', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const callback = _sinon.spy();
                const timeoutHandler = shadow._handlers.timeout;
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const cloudState = {
                    foo: 'bar'
                };
                const expectedCallbackArg = {
                    action: 'update_shadow',
                    state: _clone(cloudState)
                };

                manager.watchShadow(thingName, callback);
                statusHandler(thingName, 'accepted', shadow._lastRequestId, {});
                callback.reset();

                manager.updateState(thingName, {});

                expect(callback).to.not.have.been.called;
                timeoutHandler(thingName, shadow._lastRequestId);
                expect(callback).to.not.have.been.called;

                expect(callback).to.not.have.been.called;
                timeoutHandler(thingName, shadow._lastRequestId);
                expect(callback).to.not.have.been.called;

                expect(callback).to.not.have.been.called;
                statusHandler(thingName, 'accepted', shadow._lastRequestId, cloudState);
                expect(callback).to.have.been.calledOnce;

                const errorArg = callback.args[0][0];
                const callbackArg = callback.args[0][1];
                expect(errorArg).to.be.falsy;
                expect(callbackArg).to.deep.equal(expectedCallbackArg);
            });

            it('should retry timed out requests up to three times, notifying the callback if all retries fail', () => {
                const manager = _createAndConnectManager();
                const shadow = _awsIotSdkMock._shadow;

                const callback = _sinon.spy();
                const timeoutHandler = shadow._handlers.timeout;
                const statusHandler = shadow._handlers.status;

                const thingName = DEFAULT_THING_NAME;
                const expectedError = 'timedout';

                manager.watchShadow(thingName, callback);
                statusHandler(thingName, 'accepted', shadow._lastRequestId, {});
                callback.reset();

                manager.updateState(thingName, {});

                expect(callback).to.not.have.been.called;
                timeoutHandler(thingName, shadow._lastRequestId);
                expect(callback).to.not.have.been.called;

                expect(callback).to.not.have.been.called;
                timeoutHandler(thingName, shadow._lastRequestId);
                expect(callback).to.not.have.been.called;

                expect(callback).to.not.have.been.called;
                timeoutHandler(thingName, shadow._lastRequestId);
                expect(callback).to.have.been.calledOnce;
                expect(callback.args[0][0]).to.equal(expectedError);
                expect(callback.args[0][1]).to.be.falsy;
            });
        });
    });
});
