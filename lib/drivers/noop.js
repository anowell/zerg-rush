var
util = require('util')
;

/*
 * As the NOOP name suggests, I don't actually run a test.
 * I do, however, print the test options
 */
exports.run = function(test, callback){
  console.log("noop test driver doing no op");
  console.log(util.inspect(test));
  callback();
}