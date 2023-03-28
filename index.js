const express = require("express");
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

const port = 3000;

const snmp = require("net-snmp");

app.get('/', async (req, res) => {
  const tagline = `Please set the IP address and OIDs (or keep it empty) to get response`;

  res.render('pages/index', {
    oids: [],
    tagline: tagline
  });
});

app.post('/', (req, res) => {
  let response = [];
  const ip = req.body.ip;
  const raw = req.body.oids && req.body.oids.split(',');
  const oids = raw || ["1.3.6.1.2.1.1.5.0", "1.3.6.1.2.1.1.1.0", "1.3.6.1.2.1.1.3.0"];
  const session = snmp.createSession(ip || "127.0.0.1", "public");
  session.get(oids, function (error, oid_data) {
    if (error) {
      console.error(error);
    } else {
      for (var oid of oid_data) {
        if (snmp.isVarbindError(oid)) {
          console.error(snmp.varbindError(oid));
        } else {
          response.push(`${oid.value}`);
        }
      }
    }
    const oids_data = oids.map((oid, key)=> ({ oid, resp: response[key]}));

    const tagline = `The SNMP response of the (${ip || "127.0.0.1"}) from the following OID's:`;

    res.render('pages/index', {
      oids: oids_data,
      tagline: tagline
    });
    session.close();
  });
});

app.get('/about', function(req, res) {
  res.render('pages/about');
});

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});




// var options = {
//   port: 162,
//   disableAuthorization: true,
//   includeAuthentication: false,
//   accessControlModelType: snmp.AccessControlModelType.None,
//   engineID: "8000B98380AE1223131213318182919821", // where the X's are random hex digits
//   address: null,
//   transport: "udp4"
// };

// var callback = function (error, notification) {
//   if ( error ) {
//       console.error (error);
//   } else {
//       console.log (JSON.stringify(notification, null, 2));
//   }
// };

// receiver = snmp.createReceiver (options, callback);