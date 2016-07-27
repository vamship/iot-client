/* jshint node:true, expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _assertionHelper = require('wysknd-test').assertionHelper;
const _shortId = require('shortid');
const Promise = require('bluebird').Promise;

const CloudConnector = require('../../lib/connectors/cloud-connector');
const ConnectorFactory = require('../../lib/connector-factory');
const Hub = require('../../lib/hub');
const CommandHandler = require('../../lib/command-handler');
const CncRequest = require('../../lib/cnc-request');

describe('CommandHandler', () => {

    class CncConnector extends CloudConnector {
        constructor() {
            super(_shortId.generate(), {});
        }

        start() {
            return new Promise((resolve, reject) => {
                resolve();
            });
        }
    }

    function _createHub(factoryConfig) {
        factoryConfig = factoryConfig || {};

        const connector = new CncConnector();
        connector.addData = _sinon.stub(connector, 'addData');

        const factory = new ConnectorFactory(factoryConfig);
        factory.createConnector = _sinon.stub(factory, 'createConnector').returns(connector);

        const hub = new Hub(factory);
        hub.startCnc({
            type: 'cnc',
            config: {}
        });

        const promise = new Promise((resolve, reject) => {
            hub._resolve = resolve;
            hub._reject = reject;
        });
        hub._promise = promise;
        // Suppress any rejections
        hub._promise.then(() => {}, () => {});

        hub.startCnc = _sinon.stub(hub, 'startCnc').returns(promise);
        hub.stopCnc = _sinon.stub(hub, 'stopCnc').returns(promise);
        hub.startConnector = _sinon.stub(hub, 'startConnector').returns(promise);
        hub.stopConnector = _sinon.stub(hub, 'stopConnector').returns(promise);
        hub.shutdown = _sinon.stub(hub, 'shutdown').returns(promise);

        hub._prepareRequest = function(command, params) {
            let action = '';
            if (typeof command === 'string') {
                action = command;
                command = null;
            }
            command = command || {};
            command.id = command.id || _shortId.generate();
            command.action = command.action || action;
            command.params = command.params || params;

            const request = new CncRequest(command, new CncConnector());
            request.log = _sinon.stub(request, 'log');
            request.acknowledge = _sinon.stub(request, 'acknowledge');
            request.finish = _sinon.stub(request, 'finish');
            request.fail = _sinon.stub(request, 'fail');

            return {
                emit: this.emit.bind(this, 'cnc', request),
                _request: request
            };
        };

        return hub;
    }

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid hub object', () => {
            const error = 'Invalid connector hub specified (arg #1)';

            function invoke(hub) {
                return () => {
                    const handler = new CommandHandler(hub);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(0)).to.throw(error);
            expect(invoke(-1)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should return an object with required methods and properties', () => {
            const factory = new ConnectorFactory({});
            const hub = new Hub(factory);
            const handler = new CommandHandler(hub);

            expect(handler).to.be.an('object');
        });
    });

    describe('[commands]', () => {
        function _checkAck(commandName) {
            const hub = _createHub();
            const handler = new CommandHandler(hub);
            const info = hub._prepareRequest(commandName);
            const request = info._request;

            expect(request.acknowledge).to.not.have.been.called;
            info.emit();
            expect(request.acknowledge).to.have.been.calledOnce;
        }

        function _checkFail(commandName, error, done) {
            const hub = _createHub();
            const handler = new CommandHandler(hub);
            const info = hub._prepareRequest(commandName);
            const request = info._request;

            function init() {
                expect(request.fail).to.not.have.been.called;
                info.emit();

                hub._reject(error);
                return hub._promise;
            }

            function doTest() {
                expect(request.fail).to.have.been.calledOnce;

                const arg = request.fail.args[0][0];
                expect(arg).to.equal(error);
            }

            expect(init()).to.be.rejected
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        }

        function _checkSuccess(commandName, done) {
            const hub = _createHub();
            const handler = new CommandHandler(hub);
            const info = hub._prepareRequest(commandName);
            const request = info._request;

            function init() {
                expect(request.finish).to.not.have.been.called;
                info.emit();

                hub._resolve();
                return hub._promise;
            }

            function doTest() {
                expect(request.finish).to.have.been.calledOnce;
            }

            expect(init()).to.be.fulfilled
                .then(doTest)
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        }

        describe('[<BAD COMMAND>]', () => {
            const commandName = 'BAD COMMAND';

            it('should acknowledge the request when received', () => {
                _checkAck(commandName);
            });

            it('should complete the request with failure when an unrecognized command is received', () => {
                const error = `Unrecognized action: [${commandName}]`;
                const hub = _createHub();
                const handler = new CommandHandler(hub);
                const info = hub._prepareRequest(commandName);
                const request = info._request;

                expect(request.fail).to.not.have.been.called;
                info.emit();
                expect(request.fail).to.have.been.calledOnce;

                const arg = request.fail.args[0][0];
                expect(arg).to.be.an.instanceof(Error);
                expect(arg.message).to.equal(error);
            });
        });

        describe('[command: start_connector]', () => {
            const commandName = 'start_connector';

            it('should acknowledge the request when received', () => {
                _checkAck(commandName);
            });

            it('should complete the request with failure when the start_connector command fails', (done) => {
                const error = 'something went wrong';
                _checkFail(commandName, error, done);
            });

            it('should complete the request with success when the start_connector command succeeds', (done) => {
                _checkSuccess(commandName, done);
            });

            it('should initialize a connector on the hub when the start_connector command is received', () => {
                const hub = _createHub();
                const handler = new CommandHandler(hub);
                const params = {
                    connectorId: _shortId.generate(),
                    definition: {
                        type: 'Type1',
                        config: {}
                    }
                };
                const info = hub._prepareRequest(commandName, params);
                const request = info._request;

                expect(hub.startConnector).to.not.have.been.called;
                info.emit();
                expect(hub.startConnector).to.have.been.calledOnce;
                const args = hub.startConnector.args[0];
                expect(args[0]).to.equal(params.connectorId);
                expect(args[1]).to.deep.equal(params.definition);
            });
        });

        describe('[command: stop_connector]', () => {
            const commandName = 'stop_connector';

            it('should acknowledge the request when received', () => {
                _checkAck(commandName);
            });

            it('should complete the request with failure when the stop_connector command fails', (done) => {
                const error = 'something went wrong';
                _checkFail(commandName, error, done);
            });

            it('should complete the request with success when the stop_connector command succeeds', (done) => {
                _checkSuccess(commandName, done);
            });

            it('should initialize a connector on the hub when the stop_connector command is received', () => {
                const hub = _createHub();
                const handler = new CommandHandler(hub);
                const params = {
                    connectorId: _shortId.generate()
                };
                const info = hub._prepareRequest(commandName, params);
                const request = info._request;

                expect(hub.stopConnector).to.not.have.been.called;
                info.emit();
                expect(hub.stopConnector).to.have.been.calledOnce;
                const args = hub.stopConnector.args[0];
                expect(args[0]).to.equal(params.connectorId);
            });
        });
    });
});
