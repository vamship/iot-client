/* jshint expr:true */
'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const Promise = require('bluebird').Promise;
const _assertionHelper = require('wysknd-test').assertionHelper;
const _rewire = require('rewire');
let Command = null;

describe('Command', () => {
    const DEFAULT_COMMAND_NAME = 'test_command';
    let _childProcess = null;

    function _createConfig(config) {
        config = config || {};
        config.darwin = config.darwin || {
            command: 'echo',
            args: ['test command']
        };
        config.linux = config.linux || {
            command: 'echo',
            args: ['test command']
        };
        config.dummy = config.dummy || {
            command: 'echo',
            args: ['test command']
        };

        return config;
    }

    function _createCommand(name, config) {
        name = name || DEFAULT_COMMAND_NAME;
        config = _createConfig(config);

        return new Command(name, config);
    }

    beforeEach(() => {
        const stdout = {
            on: _sinon.spy()
        };
        const stderr = {
            on: _sinon.spy()
        };
        const proc = {
            on: _sinon.spy(),
            stdout: stdout,
            stderr: stderr
        };
        _childProcess = {
            _proc: proc,
            spawn: _sinon.stub().returns(proc)
        };

        Command = _rewire('../../../lib/commands/command');
        Command.__set__('_childProcess', _childProcess);
    });

    describe('ctor()', () => {

        it('should throw an error if invoked without a valid command name', () => {
            const error = 'Invalid command name specified (arg #1)';

            function invoke(name) {
                return () => {
                    return new Command(name);
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

        it('should throw an error if invoked without a valid configuration object', () => {
            const error = 'Invalid command configuration specified (arg #2)';

            function invoke(config) {
                return () => {
                    const name = DEFAULT_COMMAND_NAME;
                    return new Command(name, config);
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

        it('should return an object with the expected properties and methods', () => {
            const command = new Command(DEFAULT_COMMAND_NAME, _createConfig());

            expect(command).to.be.an('object');
            expect(command.platform).to.be.a('string').and.to.not.be.empty;
            expect(command.name).to.be.a('string').and.to.equal(DEFAULT_COMMAND_NAME);
            expect(command.run).to.be.a('function');
        });
    });

    describe('run()', () => {
        it('should return a promise when invoked', () => {
            const command = _createCommand();
            const promise = command.run();

            expect(promise).to.be.an('object');
            expect(promise.then).to.be.a('function');
        });

        it('should reject the promise if command configuration has not been defined for the current platform', (done) => {
            function doTest(config) {
                const command = _createCommand(null, {
                    unknown_platform: config
                });
                command._platform = 'unknown_platform';
                const error = `Command [${command.name}] does not define a valid configuration for the platform [${command.platform}]`;
                return () => {
                    return expect(command.run()).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(undefined))
                .then(doTest(null))
                .then(doTest(123))
                .then(doTest('abcd'))
                .then(doTest([]))
                .then(doTest(() => {}))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if the command config for the current platform does not define a valid command', (done) => {
            function doTest(commandName) {
                const command = _createCommand(null, {
                    dummy: {
                        command: commandName
                    }
                });
                command._platform = 'dummy';
                const error = `Command configuration [${command.name}] does not define a valid command [${commandName}]`;
                return () => {
                    return expect(command.run()).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(undefined))
                .then(doTest(null))
                .then(doTest(123))
                .then(doTest(''))
                .then(doTest([]))
                .then(doTest({}))
                .then(doTest(() => {}))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should reject the promise if the command config for the current platform does not define valid arguments', (done) => {
            function doTest(args) {
                const command = _createCommand(null, {
                    dummy: {
                        command: DEFAULT_COMMAND_NAME,
                        args: args
                    }
                });
                command._platform = 'dummy';
                const error = `Command configuration [${command.name}] does not define valid arguments [${args}]`;
                return () => {
                    return expect(command.run()).to.be.rejectedWith(error);
                };
            }
            expect(Promise.resolve(true)).to.be.fulfilled
                .then(doTest(undefined))
                .then(doTest(null))
                .then(doTest(123))
                .then(doTest('abcd'))
                .then(doTest({}))
                .then(doTest(() => {}))
                .then(_assertionHelper.getNotifySuccessHandler(done),
                    _assertionHelper.getNotifyFailureHandler(done));
        });

        it('should spawn a child process using the command name and args', () => {
            const config = _createConfig();
            const command = _createCommand(null, config);

            command._platform = 'dummy';

            expect(_childProcess.spawn).to.not.have.been.called;
            command.run();
            expect(_childProcess.spawn).to.have.been.calledOnce;
            expect(_childProcess.spawn).to.have.been.calledWith(config.dummy.command, config.dummy.args);
        });

        it('should setup event handlers for logging the process output from stdout and stderr', () => {
            const command = _createCommand();
            command._platform = 'dummy';

            function verifyArgs(spy) {
                const eventName = spy.args[0][0];
                const handler = spy.args[0][1];

                expect(eventName).to.equal('data');
                expect(handler).to.be.a('function');

                // Call this to ensure code coverage.
                handler('dummy');
            }

            expect(_childProcess._proc.stdout.on).to.not.have.been.called;
            expect(_childProcess._proc.stderr.on).to.not.have.been.called;
            command.run();
            expect(_childProcess._proc.stdout.on).to.have.been.calledOnce;
            verifyArgs(_childProcess._proc.stdout.on);

            expect(_childProcess._proc.stderr.on).to.have.been.calledOnce;
            verifyArgs(_childProcess._proc.stderr.on);
        });

        it('should setup event handlers to handle process error and completion events', () => {
            const command = _createCommand();
            command._platform = 'dummy';

            function verifyArgs(spy) {
                expect(spy.args[0][0]).to.equal('error');
                expect(spy.args[0][1]).to.be.a('function');

                expect(spy.args[1][0]).to.equal('close');
                expect(spy.args[1][1]).to.be.a('function');
            }

            expect(_childProcess._proc.on).to.not.have.been.called;
            command.run();
            expect(_childProcess._proc.on).to.have.been.calledTwice;
            verifyArgs(_childProcess._proc.on);
        });

        it('should reject the promise if the process reports an error during execution', (done) => {
            const command = _createCommand();
            command._platform = 'dummy';

            const promise = command.run();
            const handler = _childProcess._proc.on.args[0][1];
            const error = 'something went wrong';

            handler(error);
            expect(promise).to.be.rejectedWith(error).and.notify(done);
        });

        it('should reject the promise if the process completes with a non zero error code', (done) => {
            const config = _createConfig();
            const command = _createCommand(null, config);
            command._platform = 'dummy';

            const commandName = config.dummy.command;
            const args = config.dummy.args;

            const promise = command.run();
            const handler = _childProcess._proc.on.args[1][1];
            const code = 0x80;
            const error = `Command exited with non zero code [${command.name}]: [${commandName}] [${args}]. Code: [${code}]`;

            handler(code);
            expect(promise).to.be.rejectedWith(error).and.notify(done);
        });

        it('should resolve the promise if the process completes with a zero error code', (done) => {
            const command = _createCommand();
            command._platform = 'dummy';

            const promise = command.run();
            const handler = _childProcess._proc.on.args[1][1];
            const code = 0;

            handler(code);
            expect(promise).to.be.fulfilled.and.notify(done);
        });
    });
});
