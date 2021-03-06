
var http  = require("http"),
    https = require("https"),
    url   = require("url"),
    _     = require("lodash"),
    fs    = require("fs"),
    logger= require("../logger.js"),
    Timer = require("../timer.js")

var firstRun = true;
var responsePerfFile = fs.createWriteStream(
  "logs/perf/responsePerf.tsv",
  { flags: 'a'}
)

exports.run = function(testUrl, options, callback){
  var options = options || {}
  var urlOptions = url.parse(testUrl)
  urlOptions.rejectUnauthorized = false // useful for dev environment
  var transport = urlOptions.protocol === "https:" ? https : http

  urlOptions.method = options.method || "GET"
  urlOptions.headers = options.headers
  if(options.auth) {
    urlOptions.auth = options.auth
  }

  // logger.debug("REQUEST:")
  // logger.debug(urlOptions)
  // logger.debug(options.data)
  // logger.debug("-------------------------")

  var timer = new Timer()

  var req = transport.request(urlOptions, function(response){
    timer.log("first_byte")
    response.setEncoding('utf8')
    var chunks = []

    response.on('data', function(chunk){
      chunks.push(chunk)
    })

    response.on('end', function(){
      timer.log("last_byte")
      var responseTime = timer.sinceStart('last_byte')
      var body = chunks.join('')
      if (options.logResponse) {
        var outputFile = "logs/response_content/"
          + encodeURIComponent(testUrl) + new Date().getTime() + ".txt"
        fs.writeFile(outputFile, body)
      }

      if (responsePerfFile){
        var keys = timer.keys()
        if (firstRun) {
          var columnTitles = timer.keys()
          columnTitles.push('response_time')
          columnTitles.push('content_length')
          columnTitles.push('response_code')
          columnTitles.push('url')
          if (options.tag) columnTitles.push('tag')
          responsePerfFile.write(columnTitles.join('\t'))
          responsePerfFile.write('\n')
          firstRun = false
        }
        for (key in keys) {
          responsePerfFile.write(timer.clock(keys[key]) + '\t')
        }
        responsePerfFile.write(responseTime + '\t')
        responsePerfFile.write(body.length + '\t')
        responsePerfFile.write(response.statusCode + '\t')
        responsePerfFile.write(testUrl + '\t')
        if (options.tag) responsePerfFile.write(options.tag)
        responsePerfFile.write('\n')
      }
      callback({
        statusCode: response.statusCode,
        headers : response.headers,
        body : body,
        responseTime: responseTime
      })
    })

    response.on('close', function(){
      logger.error("connection closed unexpectedly")
      callback({
        statusCode: -1,
        body: "connection closed unexpectedly"
      })
    })

    response.on("error", function(err){
      logger.error(err);
    });
  })


  // Data may be specified directly or in file
  var data = options.data
  if(_.isEmpty(data) && options.dataFile) {
    data = fs.readFileSync(options.dataFile)
  }

  if(data) {
    // Coerce Objects/Arrays to JSON, but not Strings/Buffers
    if(_.isArray(data) || _.isPlainObject(data) || _.isNumber(data) || data===null) {
      req.write(JSON.stringify(data))
    } else {
      req.write(data)
    }
  }

  req.on('error', function(err){
    logger.error("client-side request error: " + err);
    callback({
      statusCode: -1,
      body: "client side error"
    });
  });

  if (options.timeout){
    req.setTimeout(options.timeout, req.abort);
  }

  req.end();

}
