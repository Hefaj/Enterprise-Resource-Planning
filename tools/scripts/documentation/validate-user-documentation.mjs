import { generateUserDocumentation } from './generate-user-documentation.mjs';

generateUserDocumentation({ check: true })
  .then(() => console.log('Validated user documentation manifests, localized articles and generated files.'))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
