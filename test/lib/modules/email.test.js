/**
 * Copyright (c) 2016 Kinvey Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

const should = require('should');
const EventEmitter = require('events').EventEmitter;
const sinon = require('sinon');
const request = require('request');

describe('modules / email', () => {
  let emailModule = null;
  let emailInstance = null;
  let requestStub = null;
  const emitter = new EventEmitter();
  const fakeProxyURL = 'http://proxy.proxy';
  const appMetadata = {
    _id: 'kid_abcd1234',
    applicationId: 'abc123',
    mastersecret: '12345'
  };
  const taskMetadata = {
    taskId: 'abcd1234'
  };
  const requestMetadata = {
    requestId: 'ea85600029b04a18a754d57629cff62d'
  };
  before((done) => {
    requestStub = {
      post: sinon.stub()
    };
    const requestDefaultsStub = sinon.stub();
    requestDefaultsStub.returns(requestStub);
    require.cache[require.resolve('request')].exports.defaults = requestDefaultsStub;
    emailModule = require('../../../lib/service/modules/email');
    emailInstance = emailModule(fakeProxyURL, appMetadata, taskMetadata, requestMetadata, emitter);
    return done();
  });
  afterEach((done) => {
    requestStub.post.reset();
    return done();
  });

  it('should return a Promise', (done) => {
    (emailInstance.send('from', 'to', 'subject', 'textBody')).should.be.a.Promise(); // eslint-disable-line new-cap
    return done();
  });

  it('should invoke the callback if specified', (done) => {
    requestStub.post.callsArg(1);
    emailInstance.send('from', 'to', 'subject', 'textBody', (err) => {
      should.not.exist(err);
      done();
    });
  });

  it('should invoke the promise handlers if no callback specified', (done) => {
    requestStub.post.callsArg(1);
    const promise = emailInstance.send('from', 'to', 'subject', 'textBody');
    promise.then((res) => {
      done();
    });
  });

  it('appends authorization header details to the request object', (done) => {
    requestStub.post.callsArg(1);
    (() => emailInstance.send('from', 'to', 'subject', 'textBody')).should.not.throw();
    requestStub.post.args[0][0].auth.user.should.eql(appMetadata._id);
    requestStub.post.args[0][0].auth.pass.should.eql(appMetadata.mastersecret);
    return done();
  });

  it('throws if \'from\', \'to\', \'subject\' and \'textBody\' are not all specified', (done) => {
    (() => emailInstance.send()).should.throw();
    (() => emailInstance.send('from')).should.throw();
    (() => emailInstance.send('from', 'to')).should.throw();
    (() => emailInstance.send('from', 'to', 'subject')).should.throw();
    (() => emailInstance.send(null, 'to', 'subject', 'textBody')).should.throw();
    (() => emailInstance.send('from', null, 'subject', 'textBody')).should.throw();
    (() => emailInstance.send('from', 'to', null, 'textBody')).should.throw();
    return done();
  });

  it('can pass a callback instead of replyTo argument', (done) => {
    requestStub.post.callsArgWith(1, 'error!');
    return emailInstance.send('from', 'to', 'subject', 'textBody', (err) => {
      should.exist(err);
      err.should.eql('error!');
      return done();
    });
  });

  it('can pass a callback instead of htmlBody argument', (done) => {
    requestStub.post.callsArgWith(1, 'error!');
    return emailInstance.send('from', 'to', 'subject', 'textBody', 'replyTo', (err) => {
      should.exist(err);
      err.should.eql('error!');
      return done();
    });
  });

  it('can pass a callback instead of cc argument', (done) => {
    requestStub.post.callsArgWith(1, 'error!');
    return emailInstance.send('from', 'to', 'subject', 'textBody', 'replyTo', 'htmlBody', (err) => {
      should.exist(err);
      err.should.eql('error!');
      return done();
    });
  });

  it('can pass a callback instead of bcc argument', (done) => {
    requestStub.post.callsArgWith(1, 'error!');
    return emailInstance.send('from', 'to', 'subject', 'textBody', 'replyTo', 'htmlBody', 'cc', (err) => {
      should.exist(err);
      err.should.eql('error!');
      return done();
    });
  });

  it('can pass a callback as the last argument', (done) => {
    requestStub.post.callsArgWith(1, 'error!');
    return emailInstance.send('from', 'to', 'subject', 'textBody', 'replyTo', 'htmlBody', 'cc', 'bcc', (err) => {
      should.exist(err);
      err.should.eql('error!');
      return done();
    });
  });

  it('calls back an error if one has occurred while communicating with the proxy', (done) => {
    requestStub.post.callsArgWith(1, 'error!');
    return emailInstance.send('from', 'to', 'subject', 'textBody', (err) => {
      should.exist(err);
      err.should.eql('error!');
      return done();
    });
  });

  it('invokes rejection handler if an error has occurred while communicating with the proxy', (done) => {
    requestStub.post.callsArgWith(1, 'error!');
    return emailInstance.send('from', 'to', 'subject', 'textBody')
      .catch((err) => {
        should.exist(err);
        err.should.eql('error!');
        return done();
      });
  });

  it('calls back an error if the proxy returned a status code greater than or equal to 400', (done) => {
    requestStub.post.callsArgWith(1, null, {
      statusCode: 401
    }, 'error!');
    return emailInstance.send('from', 'to', 'subject', 'textBody', (err) => {
      should.exist(err);
      err.should.eql('error!');
      return done();
    });
  });

  it('invokes rejection handler if the proxy returned a status code greater than or equal to 400', (done) => {
    requestStub.post.callsArgWith(1, null, {
      statusCode: 401
    }, 'error!');
    return emailInstance.send('from', 'to', 'subject', 'textBody')
      .catch((err) => {
        should.exist(err);
        err.should.eql('error!');
        return done();
      });
  });

  it('POSTs to the proxy\'s /email/send URL', (done) => {
    requestStub.post.callsArgWith(1, {});
    return emailInstance.send('from', 'to', 'subject', 'textBody', () => {
      requestStub.post.args[0][0].url.should.eql(`${fakeProxyURL}/email/send`);
      return done();
    });
  });

  it('sends a null replyTo parameter if no replyTo argument is specified', (done) => {
    requestStub.post.callsArgWith(1, {});
    return emailInstance.send('from', 'to', 'subject', 'textBody', () => {
      const requestBody = requestStub.post.args[0][0].json;
      (requestBody.replyTo === null).should.be.true;
      return done();
    });
  });

  it('sends a null html parameter if no htmlBody argument is specified', (done) => {
    requestStub.post.callsArgWith(1, {});
    return emailInstance.send('from', 'to', 'subject', 'textBody', () => {
      const requestBody = requestStub.post.args[0][0].json;
      (requestBody.html === null).should.be.true;
      return done();
    });
  });

  it('sends a null cc parameter if no cc argument is specified', (done) => {
    requestStub.post.callsArgWith(1, {});
    return emailInstance.send('from', 'to', 'subject', 'textBody', 'htmlBody', () => {
      const requestBody = requestStub.post.args[0][0].json;
      (requestBody.cc === null).should.be.true;
      return done();
    });
  });

  it('sends a null bcc parameter if no bcc argument is specified', (done) => {
    requestStub.post.callsArgWith(1, {});
    return emailInstance.send('from', 'to', 'subject', 'textBody', 'htmlBody', 'cc', () => {
      const requestBody = requestStub.post.args[0][0].json;
      (requestBody.bcc === null).should.be.true;
      return done();
    });
  });

  it('sends the appropriate arguments to the proxy', (done) => {
    requestStub.post.callsArgWith(1, {});
    return emailInstance.send(
      'fromTest', 'toTest', 'subjectTest', 'textBodyTest', 'replyToTest', 'htmlBodyTest', 'ccTest', 'bccTest'
      , () => {
        const requestBody = requestStub.post.args[0][0].json;
        requestBody.from.should.eql('fromTest');
        requestBody.to.should.eql('toTest');
        requestBody.subject.should.eql('subjectTest');
        requestBody.body.should.eql('textBodyTest');
        requestBody.replyTo.should.eql('replyToTest');
        requestBody.html.should.eql('htmlBodyTest');
        requestBody.cc.should.eql('ccTest');
        requestBody.bcc.should.eql('bccTest');
        const outgoingRequestHeaders = requestStub.post.args[0][0].headers;
        outgoingRequestHeaders.should.have.property('x-kinvey-application-id');
        outgoingRequestHeaders.should.have.property('x-kinvey-task-id');
        outgoingRequestHeaders.should.have.property('x-kinvey-request-id');
        outgoingRequestHeaders['x-kinvey-application-id'].should.equal(appMetadata.applicationId);
        outgoingRequestHeaders['x-kinvey-task-id'].should.equal(taskMetadata.taskId);
        outgoingRequestHeaders['x-kinvey-request-id'].should.equal(requestMetadata.requestId);
        return done();
      });
  });

  return it('returns the response from the mail server if one is returned', (done) => {
    requestStub.post.callsArgWith(1, null, {}, {
      mailServerResponse: 'response!'
    });
    return emailInstance.send('from', 'to', 'subject', 'textBody', (err, response) => {
      should.not.exist(err);
      should.exist(response);
      response.should.eql('response!');
      return done();
    });
  });
});
