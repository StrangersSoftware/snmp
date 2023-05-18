const express = require("express");
const bodyParser = require('body-parser');
const network = require('./utils/network');
const services = require('./utils/services');
const hardware = require('./utils/hardware');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

const port = 3000;

const snmp = require("net-snmp");

var receiverOptions = {
  accessControlModelType: snmp.AccessControlModelType.None,
  address: null,
  disableAuthorization: true,
  engineID: "8000B98380ABABABABABABABABABABABAB", // where the X's are random hex digits
  includeAuthentication: false,
  port: 162,
  transport: "udp4"
};

var receiverCallback = function (error, notification) {
  if ( error ) { console.error (error); } 
  else {
    const output = notification.pdu.varbinds.map((item) => JSON.parse(item.value))
    console.log('SERVER RECEIVE MESSAGE -', output);
  }
};

snmp.createReceiver (receiverOptions, receiverCallback);

app.get('/', async (req, res) => {
  const tagline = `Please set the IP address and OIDs (or keep it empty) to get response`;

  res.render('pages/index', {
    oids: [],
    tagline: tagline
  });
});

app.post('/', (req, res) => {
  let response = [];
  const ip = req.body.ip || "127.0.0.1";
  const raw = req.body.oids && req.body.oids.split(',');
  const oids = raw || ["1.3.6.1.2.1.1.5.0", "1.3.6.1.2.1.1.1.0", "1.3.6.1.2.1.1.3.0"];
  const session = snmp.createSession(ip, "public");
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

app.get('/hardware', async (req, res) => 
  res.render('pages/hardware', { oids: [], tagline: '',  subTagline: '' })
);

app.post('/hardware', hardware.renderFunction);

app.get('/services', async (req, res) => res.render('pages/services', {
  oids: [], tagline: 'Please set service name to search in a services list', subTagline: '' })
);

app.post('/services', services.renderFunction);

app.get('/network', async (req, res) => 
  res.render('pages/network', {oids: [], tagline: '',  subTagline: '' })
);

app.post('/network', network.renderFunction);



var global_net_adapters = [];
var global_running_apps = [];
var global_disks = [];

setInterval(() => {
  const session = snmp.createSession("127.0.0.1", "public");

  var network_oid = "1.3.6.1.2.1.2.2";
  var lan_adapter_columns = [2, 7, 8, 6];

  const checkAdapters = (error, table) => {
    global_net_adapters = [...network.agentCheck(error, table, session, global_net_adapters)];
  }

  session.tableColumns(network_oid, lan_adapter_columns, 1, checkAdapters);

  var running_apps_oid = "1.3.6.1.2.1.25.4.2";
  var apps_columns = [2, 4, 6, 7];

  const checkApps = (error, table) => {
    global_running_apps = [...services.agentCheck(error, table, session, global_running_apps)];
  }

  session.tableColumns(running_apps_oid, apps_columns, 20, checkApps);

  var disks_oid = "1.3.6.1.2.1.25.2.3";
  var disks_columns = [3, 4, 5, 6];

  const checkDisks = (error, table) => {
    global_disks = [...hardware.agentCheckDisks(error, table, session, global_disks)];
  }
  session.tableColumns(disks_oid, disks_columns, 20, checkDisks);
}, 3000);

app.get('/about', function(req, res) {
  res.render('pages/about');
});

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
