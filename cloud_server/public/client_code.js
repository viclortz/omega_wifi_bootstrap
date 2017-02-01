'use strict';
var crypto = require('crypto');
var $ = require('jquery');
window.require = require;

function setOmegaConfig (name, value, deviceId) {
  if (deviceId === undefined) { deviceId = readCookie("deviceId")};
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!window.localStorage) return "";
  } catch (_) {
    return "";
  }
  var itemName = deviceId + ":" + name;
  window.localStorage.setItem(itemName, value);
}


function getOmegaConfig (name, deviceId) {
  if (deviceId === undefined) { deviceId = readCookie("deviceId")};
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!window.localStorage) return "";
  } catch (_) {
    return "";
  }
  var itemName = deviceId + ":" + name;
  var val = window.localStorage.getItem(itemName);
  if (null == val) {  // if val is still null, then give up
    return "";
  } 
  return val;
}

var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
};

function tryToReach(url,count) {
    // alert("trying to reach server at " + url  + " " + count);
    if (count == 0) {
        return;
    }
    $.ajax({
        type: 'GET',
        url: url + 'ping',
        success: function(res_data) {
            // alert("got ping from host at " + url);
            window.location = url;
        },
        error: function() { 
            // alert("timed out");
            setTimeout(tryToReach,1000,url,count - 1);
        },
        timeout: 1000      
    });
}

function initOmegaConfig() {
    var deviceId = readCookie("deviceId");
    window.localStorage.setItem(deviceId + ":" + "omegaServerAddress",
        "http://192.168.3.1:3000/");
    window.localStorage.setItem(deviceId + ":" + "omegaAppPath", "");
    window.localStorage.setItem(deviceId + ":" + "provisioningURL",
        "/dp/" + deviceId);
    window.localStorage.setItem(deviceId + ":" + "localSSID",
        "Vics_TripMate");
}

// next push the configuration to the local device
function PushToDevice(url,data) {
    // alert("pushing " + JSON.stringify(data) +  " to device at " + url);
    $.ajax({
        type: 'POST',
        url: url,
        dataType:'json',
        data: data, 
        success: function(res_data) {
            // alert("pushed connect data to device at " + url);
            var address = getOmegaConfig("omegaServerAddress");
            tryToReach(address, 15);
        },
        error: function() { 
            var address = getOmegaConfig("omegaServerAddress");
            tryToReach(address, 15);
        },
        timeout: 20000      
    });
};

// This function is called after the provisioning data is retrieved from
// the provisioning server.
//
// The first step is to ask the wrapper application to connect to the device's 
// built-in WiFi network using profile data from the provisioning server. If 
// that succeeds, then the next step is to push the encrypted configuration 
// data over to the device.
//
function configureDevice(ssid,psk,url,configURL,configInfo) {
    if (window.wrapper != null) { // possibly switch to Device's WiFi first
        // alert("pushing info to " + configURL);
        var res = window.wrapper.connectToWiFi(ssid,psk);
        if (res === "Connected") {
            // alert("connected, pushing " + JSON.stringify(window.devInfo) +  " to device at " + window.devUrl);
            PushToDevice(configURL, configInfo); // give configuration to device
        } 
    } else { // just assume the device is reachable
        PushToDevice(configURL, configInfo); // give configuration to device
    }
}

function createCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name,"",-1);
}

$( document ).ready(function() {

var devId = getUrlParameter("deviceId");
if (devId) {
    createCookie("deviceId",devId);
}

if (window.wrapper == null) {
    alert("Device " + readCookie("deviceId") + ". This page runs only inside a phone app");
} else { // running inside of our Android wrapper
    // alert("checking for device at " + window.omegaServerAddress);
    var address = getOmegaConfig("omegaServerAddress");
    if (address == "") { // need to initialize configuration
        initOmegaConfig();
        address = getOmegaConfig("omegaServerAddress");
    }
    $.ajax({ // see if we are already connected to the device
        type: 'GET',
        url: address + 'ping',
        success: function(res_data) {
            // happy path... connect directly to the device's web app
            var appPath = getOmegaConfig("omegaAppPath");
            window.location = address + appPath;
        },
        error: function() { 
            var provURL = getOmegaConfig("provisioningURL");
            // alert("Device unreachable, get provisioning from " + provURL);
            // for now, get local SSID from config, later from wrapper
            var localSSID = getOmegaConfig("localSSID");

            // alert("unable to ping device");
            // attempt to download configuration 
            getConfig(provURL, localSSID); // , psk);
        },
        timeout: 1000      
    });
}

// create the app's encrypted blob containing the other network's 
// configuration
var appKey = '';

crypto.randomBytes(16, function(ex,buf) {
    appKey = buf.toString('hex'); // assign 16 "random" bytes to appKey
});


// first get configuration data from the cloud server
function getConfig(url,localSSID) {
    // alert("getConfig called with " + url);
    $.ajax({
        type: 'POST',
        url: url,
        dataType:'json',
        data: {"premisesSSID":localSSID,"appKey":appKey}, 
        success: function(res_data) {
            // alert("getConfig succeeded");
            var ipaddr = res_data["ipaddr"];
            var port = res_data["port"]; 
            var serverAddress =  'http://' + ipaddr +":"+ port +'/';
            setOmegaConfig("omegaServerAddress", serverAddress);
            setOmegaConfig("localSSID", localSSID);

            var devConnectUrl = serverAddress + 'connectDevice/' + readCookie("deviceId");
            var devInfo = {"payload":res_data["payload"], "appKey":appKey};
            configureDevice(res_data["ssid"], res_data["wpa"], 
                            serverAddress, devConnectUrl, devInfo);
        }
    });
};

});
