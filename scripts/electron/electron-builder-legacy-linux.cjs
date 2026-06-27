const packageJson = require("../../package.json");

module.exports = {
  ...packageJson.build,
  electronVersion: "18.3.15",
  appImage: {
    ...packageJson.build.appImage,
    artifactName: "NetHack 3D ${version} (Legacy x86).${ext}",
  },
};
