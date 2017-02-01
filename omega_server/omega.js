'use strict';

var express = require('express');
var app = express();
var fs = require("fs");
var path = require('path');
var crypto = require('crypto');
var request = require('request');
var bodyParser = require('body-parser');

////////////////////////////////////////////////////////////////////////
//
// This script facilitates secure wireless setup and configuration of a 
// headless Onion Omega or Omega2 device. The basic approach is to use
// a preshared secret between the Omega and a cloud server to provide
// a basis for trusting configuration data delivered over a local
// WiFi connection hosted by the Omega's built-in AP. The main point here
// is that there is an initial trust relationship between the factory-configured
// device and a server in the cloud. The particular cryptographic mechanism
// (symmetric secret vs public key) is secondary. The next consideration is
// how to use the initial trust relationship to help set up and provision
// the device into the device owner's domain (configuring it with network
// settings and other settings).
//
// Since the Omega is presumably not connected to a routable network 
// during the setup phase, this provides a degree of protection based on 
// physical isolation from most potential attackers. We assume that
// an attacker may be within range of the Omega's built-in WiFi AP, but 
// actually knowing where and when an Omega is being set up
// is a big practical obstacle to any potential attacker.
// 
////////////////////////////////////////////////////////////////////////


//////////////    Express Server Configuration     /////////////////////

// Configure web server permissions to allow cross-site resource access
//
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Enable parsing of JSON content in HTTP request body
//
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// In addition to the REST interface exposed by this script, serve web 
// content from the directory "public"
//
app.use(express.static('public'));


//////////////    Client request handling        /////////////////////

// Test function to make sure we can communicate with the server.
//
app.get('/ping', function (req, res) {
   res.json({result:"Okay"});
});

// Demo function exposing the ability to shut down the device via an 
// unauthenticated web request. This clearly would not be desirable in any 
// real deployment.  It is for demonstration purposes only.
//
app.post('/haltDevice', function (req, res) {
    console.log ("halt command received"); 
    runCmd( "halt", [], function(text) { console.log (text) });
});

// The connectDevice command is used by the bootstrapping app to send 
// WiFi profile configuration data to the Omega device. The configuration
// data in the body includes:
//
// { "appKey":keyFromApp,"payload":encryptedDataFromCloudServer }
//
// The appKey and payload data fields are hex-encoded binary values. 
// The script next creates a symmetric key from the concatenation of
// deviceId | deviceNonce | serverNonce and crypto.createDecipher().
// The deviceNonce and serverNonce constitute the preshared
// secret between the Omega and the cloud server. These values are read by
// the Omega from a local JSON file named device_[deviceId].json, where the
// [deviceId] is the Omega's id. 
//
// By combining the deviceNonce and serverNonce, this approach avoids some
// of the problems with pure client-side Javascript crypto (e.g., the lack of
// a cryptographically secure random number generator). Ideally, a fresh 
// deviceNonce should be pushed up to the cloud server by the Omega once it 
// successfully connects to the Internet. This way, the device can protect
// itself against replay attacks with old configuration payloads.
//
// Once decrypted, the payload field contains domain-specific configuration
// plus a field called "extra". The "extra" field itself is encrypted, but
// not with the key for payload. Instead, the key to decrypt "extra" is passed
// to the Omega in the "appKey" field of the request body. The "extra" field is
// passed up by the mobile app to the cloud server as part of its request for 
// configuration for this Omega device. The local WiFi settings in the 
// "extra" field are encrypted with appKey and embedded in the payload 
// request. Depending on the particular deployment, the encryption of the
// "extra" field can either be done by the mobile app or by the cloud service.
// If the local WiFi settings should not be shared with the cloud service,
// then the "extra" encryption is done by the mobile app. If the local WiFi
// settings should not be shared with the mobile app, then the "extra"
// encryption is done by the cloud service. The Omega does not have to know
// which of these alternative approaches is taken. It does the same thing 
// in either case.
//
// By encrypting the inner WiFi settings with a key that is shared by the
// setup app, those settings can be protected from an attack where someone
// is able to eavesdrop somehow the encrypted payload, get physical access
// to a factory-reset device, and then replay the setup message to the 
// device.
//
app.post('/connectDevice/:id', function (req, res) {
    console.log ("connect request got " + JSON.stringify(req.body)); 
    var deviceId = req.params.id;

    // check input for required properties
    //
    if (! deviceId || ! req.body.hasOwnProperty("appKey") || 
        ! req.body.hasOwnProperty("payload")) {
        console.log("did " + deviceId + " akey " + req.body["appKey"] +
                    " payl " + req.body["payload"]);
        var notFound = new Error('Invalid request');
        notFound.status = 500;
        return next(notFound);
    }

    var encryptedPayload = req.body["payload"];
    var payload = extractPayload(deviceId, encryptedPayload);
    if (! payload || ! payload.hasOwnProperty("extra")) {
        var notFound = new Error('Invalid encrypted payload');
        notFound.status = 500;
        return next(notFound);
    }

    // Now decrypt the embedded "extra" data in payload. This data
    // contains WiFi settings for the Omega to use for Internet connectivity
    //
    var appKey = req.body["appKey"];
    var extra = payload["extra"];
    var net_to_join = decryptAndParseHexString(appKey, extra);

    var ssid = net_to_join["ssid"];                                        
    var wpa = net_to_join["wpa"];                    
    var encr = net_to_join["encr"];                           

    // Finally, we are ready to create a WiFi profile for the network. Once the
    // profile is created, we enable the profile and reset the Omega's network 
    // service to use this network.
    //
    console.log ("adding profile for " + ssid); 
    runCmd( "wifisetup", ["add","-ssid",ssid,"-encr",encr,"-password",wpa],
      function(text) { 
        console.log (text) 
        runCmd( "wifisetup", ["enable","-ssid",ssid],
          function(text) { 
            console.log (text) 
            console.log ("resetting network configuration") 
            resetNetwork();    
        });  
    });                                
    // For future work... try reaching the Omega via the local WiFi network.
    // If this succeeds, then an organization might want to shutdown this
    // local setup script and transition management and control of the device 
    // to a service in the cloud. 
});


// Decrypt the payload field using preshared keys from a local file. 
//
function extractPayload(id, encryptedPayload) {
    // TODO: replace file with database or otherwise protect this data
    var contents = fs.readFileSync(path.join(__dirname + "/device_" + 
                                   id + ".json"));
    // parse file contents to get the data required to compute the key
    var nonceInfo = JSON.parse(contents);
    var key = id + nonceInfo["deviceNonce"] + nonceInfo["serverNonce"];
    return decryptAndParseHexString(key, encryptedPayload);
}

//////////////    Utility Functions     /////////////////////

// Decrypt and parse data
//
function decryptAndParseHexString(key, encryptedString) {
    var decipher = require('crypto').createDecipher('aes192',key);
    var mydec = decipher.update(encryptedString, 'hex', 'utf8');
    mydec += decipher.final('utf8');
    return JSON.parse(mydec);
}


// Allow this server to run a restricted set of shell commands (only those
// listed in the "commandWhiteList" variable below).
//
function runCmd(cmd, args, callBack ) {
    var commandWhiteList = ["wifi", "wifisetup", "halt", "ls", "echo" ];
    if (commandWhiteList.indexOf(cmd) === -1) { // if not in white list
        callBack("Command not allowed: " + cmd);
        return;
    }
    var spawn = require('child_process').spawn;
    var child = spawn(cmd, args);
    var resp = "";

    child.stdout.on('data', function (buffer) { resp += buffer.toString() });
    child.stdout.on('end', function() { callBack (resp) });
} // ()

// Onion Omega command to reset wifi network connections according to the
// WiFi manager configuration.
//
function resetNetwork() { 
    runCmd( "wifi", [], function(text) { console.log (text) });
}

//////////////    Express Server Startup     /////////////////////

module.exports = app; // export the server object so mocha can test it

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});

