const peggy = require("peggy");

module.exports = function peggy_loader(source) {
  const allowedStartRules = this.query?.allowedStartRules || undefined;
  return peggy.generate(source, {
    cache: false,
    format: "es",
    output: "source",
    allowedStartRules,
  });
};
