
var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../omega_server/omega.js');
var should = chai.should();

chai.use(chaiHttp);

describe('Test Omega WiFi settings bootstrapping', function() {
  it('should return {"result":"Okay"} from /ping GET', function(done) {
    chai.request(server)
      .get('/ping')
      .end(function(err,res){
        console.log(JSON.stringify(res.body));
        res.should.have.status(200);
        res.body.result.should.equal('Okay');
        done();
      });
  });

  /* 
  This test case doesn't work yet... 

  it('should decrypt fake payload from /connectDevice POST', function(done) {
    // this fake response tests decrypting the payload of the response from
    // the cloud server.
    var fakeCloudServerResponse = '{"ssid":"Omega-2231","wpa":"DevicePSK","ipaddr":"192.168.3.1","port":"3000","deviceId":"Omega-2231","payload":"dde998a5bbd0a8517124958d3bdbdd9d27fccd43410541dd07b11f7ab4e25215a6a82920bdc902359ff37966cbaafbf140ac2c7842e5d07c8c63101d5b0b9723c25d136910173d45b5c351bfa7255760a666640e8c8b4c825082f13affd375b9bf4a0880c3bbf951dfe9c6b32637f53b60192738c825874786db4022f4de279f"}'

    var test_body = { "appKey":"abcd", "payload":"12abc" }; // TODO: add payload
    chai.request(server)
      .post('/connectDevice/Omega-2231')
      .send(test_body)
      .end(function(err,res){
        console.log(JSON.stringify(res.body));
        res.should.have.status(200);
        done();
      });
  });
  */
});

