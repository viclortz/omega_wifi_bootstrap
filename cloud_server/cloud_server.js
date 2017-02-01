var express = require('express');
var app = express();
var fs = require("fs");
var path = require('path');
var crypto = require('crypto');
var bodyParser = require('body-parser');

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static('public'));

app.get('/dp/:id', function (req, res) {
  var deviceId = req.params.id;

  console.log('browser checking for ' + deviceId);
  console.log('query.app is ' + req.query.app);
  if (req.query.app == "true") {
      return res.redirect(301, '/?deviceId=' + deviceId);
  } else {
      res.redirect('https://play.google.com/store/apps/details?id=net.lortz.devjoiner&hl=en');
  }
});

app.post('/dp/:id', function (req, res) {
    deviceId = req.params.id;

    console.log('setup requested for ' + deviceId);
    // TODO: replace file with database
    var contents = fs.readFileSync(path.join(__dirname + "/device_" + 
                                   deviceId + ".json"));
    // parse contents to get the two nonces used for encryption key
    var jsonContent = JSON.parse(contents);
    var key = deviceId + jsonContent["deviceNonce"] + jsonContent["serverNonce"];
    var cipher = require('crypto').createCipher('aes192',key);

    // hard code the premises WiFi settings for now
    // TODO: look up the premisesWPA and encr in database from premisesSSID
    var premisesSSID = req.body["premisesSSID"];
    var premisesWPA = "23232323"; // hard code for now
    var encr = "psk2";
    var premisesInfo = { "ssid":premisesSSID, "wpa":premisesWPA, "encr":encr };

    var appKey = req.body["appKey"];
    var appCipher = require('crypto').createCipher('aes192',appKey);
    var extra = appCipher.update(JSON.stringify(premisesInfo), 'utf8', 'hex');
    extra += appCipher.final('hex');
    appKey = "";

    // clear keying material and don't return it
    key = "";
    delete jsonContent["deviceNonce"];
    delete jsonContent["serverNonce"];

    // add the encrypted extra data sent by the app
    jsonContent["extra"] = extra;

    // create encrypted payload of jsonContent with extra data so the app can 
    // connect to the device's AP and pass the payload to the device along 
    // with its own encryption key to decrypt the embedded "extra" part that 
    // contains WiFi settings provided by the app.
    var payload = cipher.update(JSON.stringify(jsonContent), 'utf8', 'hex');
    payload +=  cipher.final('hex');
    delete jsonContent["extra"]; // this data is now inside payload
    jsonContent["payload"] = payload; // payload to pass to the device
    res.send( jsonContent );
});

// body data should include: "deviceNonce", "ssid", "wpa", "ipaddr"
// generate a server-side nonce, save data, return the serverNonce
app.post('/registerDevice/:id', function (req, res) {
    crypto.randomBytes(32, function(ex,buf) {
        var to_save = req.body; // we will be saving this
        to_save["deviceId"] = req.params.id;
        to_save["serverNonce"] = buf.toString('hex');

        fs.writeFile(__dirname + "/device_" + req.params.id + ".json", 
                     JSON.stringify(to_save), function (err) {
            if (err) 
	        return console.log(err);
        });
        res.send({"serverNonce":to_save["serverNonce"]}); 
    });
});

app.get('/nonce', function (req, res) {
  data = crypto.randomBytes(32, function(ex,buf) {
     res.end(buf.toString('hex'));
  });
});

app.listen(9000, function () {
  console.log('Example app listening on port 9000!');
});

