// Metro resolves `require("crypto")` statically, so the alias target has to
// exist even though Node's crypto does not. Exporting nothing makes the guarded
// Node fast-path in providers/extractors/vidstuck.ts fail its feature check and
// fall through to the pure-JS decryption it already ships.
module.exports = {};
