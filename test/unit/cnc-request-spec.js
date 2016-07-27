/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _shortId = require('shortid');
const CncRequest = require('../../lib/cnc-request');
const CloudConnector = require('../../lib/connectors/cloud-connector');

describe('CncRequest', () => {
    const DEFAULT_COMMAND_ID = '__cnc_request_id__';
    const DEFAULT_COMMAND_ACTION = '__cnc_command_action__';

    class DummyCnc extends CloudConnector {
        constructor() {
            super(_shortId.generate(), {});
        }
    }

    function _createCommand(command) {
        command = command || {};
        command.id = command.id || DEFAULT_COMMAND_ID;
        command.action = command.action || DEFAULT_COMMAND_ACTION;
        command.params = command.params || {
            foo: 'bar',
            abc: 123,
            baz: true
        };
        return command;
    }

    function _createRequest(command, connector) {
        command = _createCommand(command);
        connector = connector || new DummyCnc();

        return new CncRequest(command, connector);
    }

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid command', () => {
            const error = 'Invalid command specified (arg #1)';

            function invoke(command) {
                return () => {
                    const request = new CncRequest(command);
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

        it('should throw an error if the command does not define a valid id', () => {
            const error = 'Command does not define a valid id (command.id)';

            function invoke(id) {
                return () => {
                    const command = {
                        id: id
                    };
                    const request = new CncRequest(command);
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

        it('should throw an error if the command does not define a valid action', () => {
            const error = 'Command does not define a valid action (command.action)';

            function invoke(action) {
                return () => {
                    const command = {
                        id: DEFAULT_COMMAND_ID,
                        action: action
                    };
                    const request = new CncRequest(command);
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

        it('should throw an error if invoked without a cloud connector reference', () => {
            const error = 'Invalid connector reference specified (arg #2)';

            function invoke(connector) {
                return () => {
                    const request = new CncRequest({
                        id: DEFAULT_COMMAND_ID,
                        action: DEFAULT_COMMAND_ACTION
                    }, connector);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should return an object with required methods and properties', () => {
            const id = _shortId.generate();
            const action = 'some_action';
            const connector = new DummyCnc();
            const request = new CncRequest({
                id: id,
                action: action
            }, connector);

            expect(request).to.be.an('object');
            expect(request.id).to.be.a('string').and.to.equal(id);
            expect(request.action).to.be.a('string').and.to.equal(action);

            expect(request.getParam).to.be.a('function');
            expect(request.log).to.be.a('function');
            expect(request.acknowledge).to.be.a('function');
            expect(request.finish).to.be.a('function');
            expect(request.fail).to.be.a('function');
        });
    });

    describe('getParam()', () => {
        it('should return undefined if an invalid key is specified', () => {
            function doTest(key) {
                const request = _createRequest();
                expect(request.getParam(key)).to.be.undefined;
            }

            doTest(undefined);
            doTest(null);
            doTest(123);
            doTest('');
            doTest(true);
            doTest({});
            doTest([]);
            doTest(() => {});
        });

        it('should return undefined if a valid key is specified, but no parameter with the defined key exists', () => {
            function doTest(key) {
                const request = _createRequest();
                expect(request.getParam(key)).to.be.undefined;
            }

            doTest('bad key');
            doTest('another bad key');
            doTest('yet another bad key');
        });

        it('should return the parameter associated with the key if a valid key is specified', () => {
            const params = {
                key1: 'value1',
                key2: 1234,
                key3: {
                    foo: 'bar'
                },
                key4: [1, 2, 3]
            };
            const request = _createRequest({
                params: params
            });

            expect(request.getParam('key1')).to.equal(params.key1);
            expect(request.getParam('key2')).to.equal(params.key2);
            expect(request.getParam('key3')).to.be.an('object');
            expect(request.getParam('key3')).to.deep.equal(params.key3);
            expect(request.getParam('key4')).to.be.an('Array');
            expect(request.getParam('key4')).to.deep.equal(params.key4);
        });
    });

    describe('log()', () => {
        it('should throw an error if invoked without a valid message', () => {
            const error = 'Invalid message specified (arg #1)';

            function invoke(message) {
                const request = _createRequest();
                return () => {
                    return request.log(message);
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

        it('should prepare and add a message to the connector\'s message queue', () => {
            const id = _shortId.generate();
            const connector = new DummyCnc();
            const request = _createRequest({
                id: id
            }, connector);
            const message = 'some log message';

            const spy = _sinon.stub(connector, 'addData');

            expect(spy).to.not.have.been.called;
            request.log(message);
            expect(spy).to.have.been.calledOnce;

            const payload = spy.args[0][0];
            expect(payload).to.be.an('object');
            expect(payload.requestId).to.equal(id);
            expect(payload.type).to.equal('log');
            expect(payload.message).to.equal(message);
        });
    });

    describe('acknowledge()', () => {
        it('should prepare and add a message to the connector\'s message queue', () => {
            const id = _shortId.generate();
            const connector = new DummyCnc();
            const request = _createRequest({
                id: id
            }, connector);
            const message = 'acknowledgement message';

            const spy = _sinon.stub(connector, 'addData');

            expect(spy).to.not.have.been.called;
            request.acknowledge(message);
            expect(spy).to.have.been.calledOnce;

            const payload = spy.args[0][0];
            expect(payload).to.be.an('object');
            expect(payload.requestId).to.equal(id);
            expect(payload.type).to.equal('acknowledge');
            expect(payload.message).to.equal(message);
        });

        it('should default the acknowledge message to an empty string if a valid message is not specified', () => {
            function doTest(message) {
                const id = _shortId.generate();
                const connector = new DummyCnc();
                const request = _createRequest({
                    id: id
                }, connector);
                const spy = _sinon.stub(connector, 'addData');

                request.acknowledge(message);
                const payload = spy.args[0][0];
                expect(payload.message).to.be.a('string').and.to.be.empty;
            }

            doTest(undefined);
            doTest(null);
            doTest(123);
            doTest('');
            doTest(true);
            doTest({});
            doTest([]);
            doTest(() => {});
        });
    });

    describe('finish()', () => {
        it('should prepare and add a message to the connector\'s message queue', () => {
            const id = _shortId.generate();
            const connector = new DummyCnc();
            const request = _createRequest({
                id: id
            }, connector);
            const message = 'completion message';

            const spy = _sinon.stub(connector, 'addData');

            expect(spy).to.not.have.been.called;
            request.finish(message);
            expect(spy).to.have.been.calledOnce;

            const payload = spy.args[0][0];
            expect(payload).to.be.an('object');
            expect(payload.requestId).to.equal(id);
            expect(payload.type).to.equal('finish');
            expect(payload.message).to.equal(message);
        });

        it('should default the finish message to an empty string if a valid message is not specified', () => {
            function doTest(message) {
                const id = _shortId.generate();
                const connector = new DummyCnc();
                const request = _createRequest({
                    id: id
                }, connector);
                const spy = _sinon.stub(connector, 'addData');

                request.finish(message);
                const payload = spy.args[0][0];
                expect(payload.message).to.be.a('string').and.to.be.empty;
            }

            doTest(undefined);
            doTest(null);
            doTest(123);
            doTest('');
            doTest(true);
            doTest({});
            doTest([]);
            doTest(() => {});
        });
    });

    describe('fail()', () => {
        it('should throw an error if invoked without a valid message or Error object', () => {
            const error = 'Invalid error specified (arg #1)';

            function invoke(message) {
                const request = _createRequest();
                return () => {
                    return request.fail(message);
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

        it('should prepare and add a message to the connector\'s message queue', () => {
            const id = _shortId.generate();
            const connector = new DummyCnc();
            const request = _createRequest({
                id: id
            }, connector);
            const message = 'request failed';

            const spy = _sinon.stub(connector, 'addData');

            expect(spy).to.not.have.been.called;
            request.fail(message);
            expect(spy).to.have.been.calledOnce;

            const payload = spy.args[0][0];
            expect(payload).to.be.an('object');
            expect(payload.requestId).to.equal(id);
            expect(payload.type).to.equal('fail');
            expect(payload.message).to.equal(message);
        });

        it('should use the error object\'s message property of the message if an error object is specified', () => {
            const id = _shortId.generate();
            const connector = new DummyCnc();
            const request = _createRequest({
                id: id
            }, connector);
            const message = new Error('something went wrong');

            const spy = _sinon.stub(connector, 'addData');
            request.fail(message);
            const payload = spy.args[0][0];

            expect(payload.message).to.be.a('string').and.to.equal(message.message);
        });
    });
});
