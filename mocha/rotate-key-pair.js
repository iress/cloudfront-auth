const rotateKeyPair = require('../rotate-key-pair/index.js');
const assert = require('assert');
const { SecretsManagerClient, PutSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { mockClient } = require('aws-sdk-client-mock');

describe('Rotate key pair', function () {
  describe('handler', function () {
    const secretsManagerMock = mockClient(SecretsManagerClient);

    beforeEach(function () {
      secretsManagerMock.reset();
    });

    it('should put secret value when step is createSecret', async function () {
      this.timeout(30000);
      secretsManagerMock.on(PutSecretValueCommand).resolves({});

      // Call Lambda function handler
      const event = {
        Step: 'createSecret',
        SecretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-website-auth/key-pair-ABCDEF',
        ClientRequestToken: '123e4567-e89b-12d3-a456-426614174000'
      };
      await rotateKeyPair.handler(event);

      // Verify that send was called once with the expected payload
      const calls = secretsManagerMock.commandCalls(PutSecretValueCommand);
      assert.strictEqual(calls.length, 1);
      const sentCommand = calls[0].firstArg;
      assert.strictEqual(sentCommand.input.SecretId, event.SecretId);
      assert.strictEqual(sentCommand.input.ClientRequestToken, event.ClientRequestToken);

      // Verify that send was called once with an RSA key pair as the SecretString
      const secret = JSON.parse(sentCommand.input.SecretString);
      assert(/^-----BEGIN RSA PRIVATE KEY-----\n[\s\S]*?-----END RSA PRIVATE KEY-----\n$/.test(secret['private-key']));
      assert(/^-----BEGIN PUBLIC KEY-----\n[\s\S]*?-----END PUBLIC KEY-----\n$/.test(secret['public-key']));
    });

    it('should not put secret value when step is not createSecret', async function () {
      secretsManagerMock.on(PutSecretValueCommand).resolves({});

      // Call Lambda function handler
      const event = {
        Step: 'setSecret',
        SecretId: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-website-auth/key-pair-ABCDEF',
        ClientRequestToken: '123e4567-e89b-12d3-a456-426614174000'
      };
      await rotateKeyPair.handler(event);

      // Verify that send was not called
      const calls = secretsManagerMock.commandCalls(PutSecretValueCommand);
      assert.strictEqual(calls.length, 0);
    });

  });
});
