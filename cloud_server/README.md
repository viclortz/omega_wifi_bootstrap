Provisioning server configuration setup notes
==========================

Solution Considerations
--------------------------

All communication with the provisioning server in the cloud should be sent
across a TLS-protected link. TLS protects the setup URL containing the IoT
device’s identity from any eavesdroppers on the local network. Although the
setup URL should not contain secrets, protecting the content of that URL
from an attacker represents an additional obstacle to them. In some
deployments, knowledge of the setup URL may be used as a contributing
factor in bootstrapping trust for the particular device. Furthermore,
the TLS connection provides assurance that the app is communicating with
the intended server in the cloud. 

There are two main options for securing the NodeJS express server
with TLS: 1) configure the express server itself with a certificate,
or 2) configure a web server with a certificate, terminate the TLS
connection there, and proxy provisioning-related traffic to an express
server running behind the web server (possibly running the node server
on an arbitrary local port like 9000). Either of these options would
be viable, but we will use option 2 since that approach allows clients
to use the normal HTTP and HTTPS ports and also to host other websites
on a full-featured Apache server. Another advantage is that this
approach provides a very simple way to use the certificate management
certbot script provided by the free certificate issuer LetsEncrypt. 

Install Apache and NodeJS
--------------------------

The notes below correspond to configuration on a Ubuntu 14.04 server.
Other OS environments will have some differences, but the same basic
steps should be followed.

To terminate SSL on Apache and proxy it through to a NodeJS express server
running on port 9000:

    sudo apt-get update
    sudo apt-get install apache2

Next configure the apache modules we need

    sudo a2enmod proxy
    sudo a2enmod proxy_http
    sudo a2enmod ssl

Now install NodeJS

    sudo apt-get install python-software-properties
    curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
    sudo apt-get install nodejs

Enable SSL on Your Domain
--------------------------

In the apache configuration file for your virtual site,

/etc/apache2/sites-available/your_domain_com.conf:

Make sure the your_domain_com.conf file is linked to from sites-enabled,
and make sure it exposes the appropriate ServerName and ServerAlias entries
for your domain like:

	ServerName your_domain.com
	ServerAlias *.your_domain.com

Under configuration for port 443, include these lines (using whatever
local port you want to use for your NodeJS server):

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:9000/
    ProxyPassReverse / http://127.0.0.1:9000/

The next step is to make sure your domain name maps to your server. For
example, you might obtain a fixed IP address like an Amazon elastic IP
address for your server and then register that address to your domain
name using a management console from your domain name (setting the
A record accordingly). 


Install Certificates Using the Certbot Script from LetsEncrypt. 
-----------------------------

    wget https://dl.eff.org/certbot-auto
    chmod a+x certbot-auto
    ./certbot-auto --apache

Follow the prompts, and the certbot will install your certificates and
configure the virtual host file. Now we are ready to restart the apache2
service and run the provisioning server NodeJS script "cloud_server.js".


Restart Apache and Run the Provisioning App
-----------------------------
    sudo service apache2 restart
    sudo nohup node cloud_server.js &

To make the provisioning service even more robust, you might want to 
configure the provisioning app to run automatically on startup.


