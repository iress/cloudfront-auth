const fsPromises = require('fs').promises;
const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fillTemplate = require('es6-dynamic-template');

// Convert the function to an async function
module.exports.getConfig = async function (fileName, functionName) {
  try {
    // Remove the 'us-east-1.' prefix that exists on Lambda@Edge replicas
    const name = functionName.replace(/^us-east-1./, '');

    // Instantiate clients
    const ssmClient = new SSMClient({ region: 'us-east-1' });
    const secretsManagerClient = new SecretsManagerClient({ region: 'us-east-1' });

    // Define promises for all async operations
    const readFilePromise = fsPromises.readFile(fileName, 'utf8');
    // Get parameters from SSM Parameter Store
    const getParametersByPathPromise = ssmClient.send(
      new GetParametersByPathCommand({ Path: `/${name}` })
    );

    // Get key pair from Secrets Manager
    const getSecretValuePromise = secretsManagerClient.send(
      new GetSecretValueCommand({ SecretId: `${name}/key-pair` })
    );

    // Await all promises concurrently
    const [template, ssmResponse, secretResponse] = await Promise.all([
      readFilePromise,
      getParametersByPathPromise,
      getSecretValuePromise,
    ]);

    const ssmParameters = ssmResponse.Parameters;
    const secretString = secretResponse.SecretString;

    // Flatten parameters into name-value pairs
    const parameters = ssmParameters.reduce((map, obj) => {
      map[obj.Name.slice(name.length + 2)] = obj.Value;
      return map;
    }, {});

    // Convert secret to name-value pairs
    const secrets = JSON.parse(secretString);

    // Parse config file, replacing template placeholders with parameters and secrets
    const config = JSON.parse(template, (key, value) =>
      typeof value === 'string' ? fillTemplate(value, { ...parameters, ...secrets }) : value
    );

    // Return the result directly. The caller will use .then() or await.
    return config;
  } catch (err) {
    // Let the calling function handle the error
    console.error("Error fetching configuration:", err);
    throw err;
  }
};
