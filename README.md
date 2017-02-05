# omega_wifi_bootstrap

Secure Headless IoT Device WiFi Bootstrapping
=================================

IoT market growth is being driven by many factors, including a precipitous
drop in hardware costs for Internet-capable devices, near ubiquitous
coverage with low-cost wireless networks, and cloud computing for scalable
management and analytics. 

![Solution](./images/GoodNews.png)

However, there are significant challenges in the
area of secure enrollment and connection of headless devices to services
on the Internet. 

![Solution](./images/BadNews.png)

So, what was this problem exactly? According to welivesecurity.com:

"The 10/21 attacks were made possible by the large number of unsecured
internet-connected digital devices, such as home routers and surveillance
cameras ... The DDoS-enabling infections were made possible by the use of
default passwords on these devices. Because the default passwords for most
devices are widely known, anyone placing such a device on the internet
without first changing the default password is, in effect,
enabling attacks of the type witnessed on October 21, even if they
are doing so unwittingly. Recent ESET research suggests at least
15% of home routers are unsecured (and the total number of home
routers on the internet is probably on the order of several hundred million)."
http://www.welivesecurity.com/2016/10/24/10-things-know-october-21-iot-ddos-attacks/

So, why were all these devices shipped with well-known default passwords? There
are many reasons, but the most significant factors are that more secure 
alternatives are difficult to deploy with headless devices and are
too expensive and/or too difficult for most consumers to use.

The industry is moving forward to fill this gap, and many
solutions have been proposed and are being deployed. This project represents
one such approach. My purpose in releasing this code is to advocate for
solutions having similar characteristics, considering this example as a
kind of software pattern. 

Although the overall approach is generic, this particular project uses
the impressive Onion Omega (and Omega2) device. The Omega
has built-in WiFi and runs the OpenWRT Linux OS. It is a perfect example
of the amazingly powerful and inexpensive new generation of embedded IoT
platforms. The kickstarter price of an Omega2 was $5 or $9, depending on 
the version of the module.

Motivation
--------------------------------
Over the years, I have greatly appreciated the hard work of many open
source developers who have done great work and shared the fruit of their labor
with the world. It is an inspiring and powerful approach with undeniable
impact. I hope others who study this project will gain insight and practical
benefit, ultimately improving the security and usability of the products they
in turn produce. We all share a common responsibility to solve these problems
together.

Vic Lortz


Solution Components
=================================

![Solution](./images/SolutionFlow.png)


Note that the message from the mobile phone to the provisioning server 
may take one of two approaches. The first approach is for the mobile app to
encrypt Premises WiFi configuration (typically entered by the user)
using the appKey (depicted in blue) 
and pass just the encrypted PremWiFi (and not appKey) to the server. This 
approach is appropriate if the server in the cloud does not manage the
Premises WiFi network. 

A second approach is for the mobile app to pass
appKey to the provisioning server along with whatever additional data
may be needed for the provisioning server to determine the appropriate
PremisesWiFi configuration. The provisioning server in this case uses
the appKey to encrypt that configuration. In this second approach, the
mobile app is able to configure those settings on the Omega without knowing the 
Premises WiFi credentials. In this release, this latter approach is used. It is 
an approach more suitable for enterprise deployments.

For the sake of simplicity in the initial release, the crypto on the mobile
app side is performed in Javascript using the crypto module. A better 
approach would be to use native code to generate keys or perform other
crypto operations. 

Important Considerations
========================

There are many possible variations on the approach outlined in this project.
The provisioning server may be managed by the IoT device manufacturer or by 
some other afiliatied entity. Clearly, whichever entity is designated in the
URL of the device setup QR-code will have control over the rest of the
provisioning process. Additional layers of business logic and
relationships could be added to increase or decrease security according to
the threat model and business model of the domain and product. It is not the
purpose of this open source project to reflect all of these potential
complexities. Instead, this project is a proof point of how to achieve a 
good balance of security and ease-of-use in a practical, deployable way. By 
choosing the enterprise-centric approach of managing the Premises WiFi 
credentials in the cloud, I am able to show a setup experience with 
maximum ease-of-use (no need to manually enter WiFi settings on the mobile
device). In a later release, I intend to expand the options to support the
other approach as well. 

In similar manner, the way this project currently manages credentials and
settings in the cloud is very simplistic. Those aspects of a solution would
need to be replaced entirely in any realistic deployment. For example, public
keys should be used rather than symmetric keys, a secure backend database should
be used to store wireless configurations and device settings in the cloud, 
etc. In the interest of keeping this project as simple as possible initially, 
these aspects of a "real solution" are currently omitted. My next step in 
evolving this project will be to define some abstract interfaces corresponding
to the required backend functionality and follow a dependency injection 
approach so different implementation approaches can easily be plugged into
the solution.

