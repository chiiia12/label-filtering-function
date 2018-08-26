/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const functions = require('firebase-functions');
const rp = require('request-promise');
const crypto = require('crypto');
const secureCompare = require('secure-compare');
const config = require('./config.json');

/**
 * Webhook that will be called each time there is a new GitHub commit and will post a message to
 * Slack.
 */
exports.githubWebhook = functions.https.onRequest((req, res) => {
  const cipher = 'sha1';
  const signature = req.headers['x-hub-signature'];

  // TODO: Configure the `github.secret` Google Cloud environment variables.
  const hmac = crypto.createHmac(cipher, functions.config().github.secret)
    .update(JSON.stringify(req.body, null, 0))
    .digest('hex');
  const expectedSignature = `${cipher}=${hmac}`;

  // Check that the body of the request has been signed with the GitHub Secret.
  if (!secureCompare(signature, expectedSignature)) {
    console.error('x-hub-signature', signature, 'did not match', expectedSignature);
    return res.status(403).send('Your x-hub-signature\'s bad and you should feel bad!');
  }

  let message = '';
  console.log(`req header is ${req.header['x-github-event']}`)
  let array = req.body.issue.labels;
  console.log(array);
  array = array.map(x => x.name);
  let filterArray = array.filter(x => config.label.includes(x));
  if (filterArray.length !== config.label.length) {
    return res.status(200).send('label don\'t match')
  }
  switch (req.body.action) {
    // opened issue
    case 'opened':
      {
        const url = req.body.issue.url
        const title = req.body.issue.title
        const body = req.body.issue.body
        const username = req.body.issue.user.login
        message += `${username} ${req.body.action} issue.\n>${title}\n>${body}\n ${url}`
        break;
      }
    // edited issue
    case 'edited':
      {
        const url = req.body.issue.url
        const title = req.body.issue.title
        const body = req.body.issue.body
        const username = req.body.issue.user.login
        message += `${username} ${req.body.action} issue.\n>${title}\n>${body}\n ${url}`
        break;
      }
    //add comment
    case 'created':
      {
        const url = req.body.comment.html_url
        const title = req.body.issue.title
        const comementbody = req.body.comment.body
        const username = req.body.comment.user.login
        message += `${username} commented to ${title}.\n>${commentbody}\n ${url}`
        break;
      }
    //close issue
    case 'closed':
     {
        const url = req.body.issue.url
        const title = req.body.issue.title
        const body = req.body.issue.body
        const username = req.body.issue.user.login
        message += `${username} closed issue.\n>${title}\n>${body}\n ${url}`
        break;
     }
    //reopen issue
    case 'reopen':
     {
        const url = req.body.issue.url
        const title = req.body.issue.title
        const body = req.body.issue.body
        const username = req.body.issue.user.login
        message += `${username} reopen issue.\n>${title}\n>${body}\n ${url}`
        break;
     }
  }
  if (message === "") {
    return res.status(200).send("action don't match")
  }

  return postToSlack(message).then(() => {
    return res.end();
  }).catch((error) => {
    console.error(error);
    return res.status(500).send('Something went wrong while posting the message to Slack.');
  });
});

function postToSlack(message) {
  return rp({
    method: 'POST',
    // TODO: Configure the `slack.webhook_url` Google Cloud environment variables.
    uri: functions.config().slack.webhook_url,
    body: {
      text: `${message}`,
    },
    json: true,
  });
}
