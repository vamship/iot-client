/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const _shortId = require('shortid');
const Promise = require('bluebird').Promise;
const _assertionHelper = require('wysknd-test').assertionHelper;

const Poller = require('../../lib/poller');

describe('Poller', () => {
    const DEFAULT_POLLER_ID = '__poller_id__';
    const DEFAULT_POLLER_FREQUENCY = 100;
    let DEFAULT_POLLER_HANDLER = null;

    function _checkCallCount(spy, count) {
        return () => {
            expect(spy.callCount).to.equal(count);
        };
    }

    function _createPoller(id, frequency, handler) {
        id = id || DEFAULT_POLLER_ID;
        frequency = frequency || DEFAULT_POLLER_FREQUENCY;
        handler = handler || DEFAULT_POLLER_HANDLER;

        return new Poller(id, frequency, handler);
    }

    beforeEach(() => {
        DEFAULT_POLLER_HANDLER = _sinon.spy();
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid id', () => {
            const error = 'Invalid id specified (arg #1)';

            function invoke(id) {
                return () => {
                    const poller = new Poller(id);
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

        it('should throw an error if invoked without a valid polling frequency', () => {
            const error = 'Invalid polling frequency specified (arg #2)';

            function invoke(frequency) {
                return () => {
                    const id = DEFAULT_POLLER_ID;
                    const poller = new Poller(id, frequency);
                };
            }

            expect(invoke(undefined)).to.throw(error);
            expect(invoke(null)).to.throw(error);
            expect(invoke(0)).to.throw(error);
            expect(invoke(-123)).to.throw(error);
            expect(invoke('abc')).to.throw(error);
            expect(invoke(true)).to.throw(error);
            expect(invoke({})).to.throw(error);
            expect(invoke([])).to.throw(error);
            expect(invoke(() => {})).to.throw(error);
        });

        it('should throw an error if invoked without a valid handler', () => {
            const error = 'Invalid handler specified (arg #3)';

            function invoke(handler) {
                return () => {
                    const id = DEFAULT_POLLER_ID;
                    const frequency = DEFAULT_POLLER_FREQUENCY;
                    const poller = new Poller(id, frequency, handler);
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

        it('should return an object with required properties and methods', () => {
            const poller = new Poller(DEFAULT_POLLER_ID, DEFAULT_POLLER_FREQUENCY,
                DEFAULT_POLLER_HANDLER);

            expect(poller).to.be.an('object');
            expect(poller.isActive).to.be.false;
            expect(poller.start).to.be.a('function');
            expect(poller.stop).to.be.a('function');
        });
    });

    describe('start()', () => {
        it('should throw an error if the poller is already active', () => {
            const error = 'Cannot start poller. Poller is already active';

            function invoke() {
                const poller = _createPoller();
                poller._isActive = true;
                return () => {
                    poller.start();
                };
            }

            expect(invoke()).to.throw(error);
        });

        it('should set the poller to active if it is not already active', () => {
            const poller = _createPoller();

            expect(poller.isActive).to.be.false;
            poller.start();
            expect(poller.isActive).to.be.true;
        });

        it('should start the poller, triggering the handler at regular intervals', (done) => {
            const handler = _sinon.spy();
            const poller = _createPoller(undefined, 100, handler);
            const promise = Promise.try(poller.start.bind(poller));

            expect(promise).to.be.fulfilled
                .then(_checkCallCount(handler, 0))
                .then(_assertionHelper.wait(105))
                .then(_checkCallCount(handler, 1))
                .then(_assertionHelper.wait(105))
                .then(_checkCallCount(handler, 2))
                .then(_assertionHelper.wait(105))
                .then(_checkCallCount(handler, 3))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });
    });

    describe('stop()', () => {
        it('should throw an error if the poller is not already active', () => {
            const error = 'Cannot stop poller. Poller is not active';

            function invoke() {
                const poller = _createPoller();
                return () => {
                    poller.stop();
                };
            }

            expect(invoke()).to.throw(error);
        });

        it('should set the poller to not active if it is already active', () => {
            const poller = _createPoller();

            poller.start();
            expect(poller.isActive).to.be.true;
            poller.stop();
            expect(poller.isActive).to.be.false;
        });

        it('should stop polling if the poller was previously active', (done) => {
            const handler = _sinon.spy();
            const poller = _createPoller(undefined, 100, handler);
            const promise = Promise.try(poller.start.bind(poller));

            expect(promise).to.be.fulfilled
                .then(_checkCallCount(handler, 0))
                .then(_assertionHelper.wait(105))
                .then(_checkCallCount(handler, 1))
                .then(_assertionHelper.wait(105))
                .then(_checkCallCount(handler, 2))
                .then(poller.stop.bind(poller))
                .then(_assertionHelper.wait(300))
                .then(_checkCallCount(handler, 2))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });
    });
});
