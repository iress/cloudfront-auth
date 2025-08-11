const genericConfig = require('../config/generic.config.js');
const assert = require('assert');
const { mockClient } = require('aws-sdk-client-mock');
const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

describe('Generic configuration', function () {
  const ssmMock = mockClient(SSMClient);
  const secretsManagerMock = mockClient(SecretsManagerClient);

  afterEach(() => {
    ssmMock.reset();
    secretsManagerMock.reset();
  });

  it('should return an object that has placeholders replaced with values from Parameter Store and Secrets Manager', async function () {
    ssmMock.on(GetParametersByPathCommand).resolves({
      Parameters: [
        {
          Name: '/my-website-auth/domain-name',
          Value: 'my-website.com'
        },
        {
          Name: '/my-website-auth/callback-path',
          Value: '/_callback'
        }
      ]
    });

    secretsManagerMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({ 'private-key': 'my-private-key', 'public-key': 'my-public-key' })
    });

    const config = await genericConfig.getConfig('./mocha/generic-config.json', 'us-east-1.my-website-auth');
    assert.equal(config.AUTH_REQUEST.redirect_uri, 'https://my-website.com/_callback');
    assert.equal(config.PRIVATE_KEY, 'my-private-key');
    assert.equal(config.PUBLIC_KEY, 'my-public-key');
  });

  it('should return an error when the file is not present', async function () {
    await assert.rejects(
      async () => {
        await genericConfig.getConfig('./mocha/missing.json', 'us-east-1.my-website-auth');
      },
      (err) => {
        assert.strictEqual(err.code, 'ENOENT');
        return true;
      }
    );
  });
});
