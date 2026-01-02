const { generateKeyPairSync } = require('crypto');
const { SecretsManagerClient, PutSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

exports.handler = async (event) => {
  if (event.Step == "createSecret") {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      }
    });

    const secretsManagerClient = new SecretsManagerClient({ region: 'us-east-1' });

    const params = new PutSecretValueCommand({
      SecretId: event.SecretId,
      ClientRequestToken: event.ClientRequestToken,
      SecretString: JSON.stringify({ 'private-key': privateKey, 'public-key': publicKey })
    });

    try {
      await secretsManagerClient.send(params);
      console.log(`Successfully rotated key pair for secret ${event.SecretId}`);
    } catch (err) {
      console.log(`Failed to rotate key pair for secret ${event.SecretId}`);
      console.log(err);
      throw err;
    }
  }
};
