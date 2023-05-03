const express = require("express");
const bodyParser = require('body-parser');
const app = express();
const network = require('./utils/network')
const services = require('./utils/services')

app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

const port = 3000;

const snmp = require("net-snmp");

var receiverOptions = {
  port: 162,
  disableAuthorization: true,
  includeAuthentication: false,
  accessControlModelType: snmp.AccessControlModelType.None,
  engineID: "8000B98380ABABABABABABABABABABABAB", // where the X's are random hex digits
  address: null,
  transport: "udp4"
};

var receiverCallback = function (error, notification) {
  if ( error ) {
      console.error (error);
  } else {
      const output = notification.pdu.varbinds.map((item) => JSON.parse(item.value))
      console.log('RECEIVER MESSAGE -', output);
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

app.get('/services', async (req, res) => res.render('pages/services', {
    oids: [],
    tagline: 'Please set service name to search in a services list',
    subTagline: ''
  })
);

app.post('/services', (req, res) => {
  const ip = req.body.ip;
  const name = req.body.name;
  const installed = req.body.installed === 'clicked';

  const session = snmp.createSession(ip || "127.0.0.1", "public");
  var oid = installed ? "1.3.6.1.2.1.25.6.3" : "1.3.6.1.2.1.25.4.2";
            
  var columns = installed ? [2] : [2, 4, 6, 7];

  const responseCb = (error, table) => {
    const rez = installed ? services.getInstalled(error, table) : services.getRunning(error, table);
    const search_oid = name && rez.filter((index)=> index.resp.toString().includes(name));
    res.render('pages/services', {
      oids: name ? search_oid : rez,
      tagline: `The following software found on requested host (${ip || "127.0.0.1"})`,
      subTagline: 'Run type: unknown(1), operatingSystem(2), deviceDriver(3), application(4); \n Status:  running(1), runnable(2), notRunnable(3), invalid(4)',
    });
  }

  var maxRepetitions = 1;
  console.log(installed ? 'INSTALLED APPLICATIONS' : 'RUNNING SERVICES TABLE');
  session.tableColumns(oid, columns, maxRepetitions, responseCb);
});


app.get('/hardware', async (req, res) => {

  res.render('pages/hardware', {
    oids: [],
    tagline: '',
    subTagline: '',
  });
});

app.post('/hardware', (req, res) => {
  const ip = req.body.ip;
  const session = snmp.createSession(ip || "127.0.0.1", "public");
  var oid = "1.3.6.1.2.1.25.3.2";
  var columns = [3, 5];
  const responseCb = (error, table) => {
    if (error) {
        console.error (error.toString ());
    } else {
        var indexes = [];
        for (let index in table) indexes.push (parseInt (index));

        const oids_data = indexes.map((index)=> ({ oid: `1.3.6.1.2.1.25.3.2.${index}`, resp: table[index][columns[0]], status: table[index][columns[1]] }));
        res.render('pages/hardware', {
          oids: oids_data,
          tagline: `The following hardware found on requested host (${ip || "127.0.0.1"})`,
          subTagline: `Statuses:  up(1), down(2)`,
        });
    }
  }

  var maxRepetitions = 1;
  console.log('HARDWARE TABLE');
  session.tableColumns(oid, columns, maxRepetitions, responseCb);
});

app.get('/network', async (req, res) => {

  res.render('pages/network', {
    oids: [],
    tagline: '',
    subTagline: '',
  });
});

app.post('/network', (req, res) => {
  const ip = req.body.ip;

  const selected_oid = req.body.select;
  const new_status = req.body.set;

  const session = snmp.createSession(ip || "127.0.0.1", "public");
  var oid = "1.3.6.1.2.1.2.2";
  var columns = [2, 7, 8, 6];

  const responseCb = (error, table) => {
    const rez = network.getAdapters(error, table);
    res.render('pages/network', {
      oids: rez,
      tagline: `The following network adapters found on requested host (${ip || "127.0.0.1"})`,
      subTagline: `Statuses:  up(1), down(2), testing(3), unknown(4), dormant(5), notPresent(6), lowerLayerDown(7)`,
    });
  }

  var maxRepetitions = 1;
  if (selected_oid)   
  {
    const varbind = [{
      oid: `1.3.6.1.2.1.2.2.1.7.${selected_oid.split('.').pop()}`,
      type: snmp.ObjectType.Integer,
      value: Number(new_status),
    }]

    console.log('SET -', ip, varbind[0]);

    session.set(varbind, function (error, varbind) {
      if (error) {
        console.error (error.toString());
      } else {
        console.log(varbind[0].oid + "|" + varbind[0].value);
        if (snmp.isVarbindError (varbind)) console.error(snmp.varbindError (varbind));
      }
    });
  }
  
  console.log('NETWORK TABLE');
  session.tableColumns(oid, columns, maxRepetitions, responseCb);
});


var global_net_adapters = [];
var global_running_apps = [];

setInterval(() => {
  const session = snmp.createSession("127.0.0.1", "public");
  var network_oid = "1.3.6.1.2.1.2.2";
  var columns = [2, 7, 8, 6];
  let rez = [];

  const checkAdapters = (error, table) => {
    const current = network.getAdapters(error, table);
    
    for(let i = 0; i < current.length; i++ ) 
      if (JSON.stringify(current[i]) !== JSON.stringify(global_net_adapters[i]))
        rez.push({...current[i], resp: current[i].resp.toString().slice(0, -1)});
    
    if  (rez.length && global_net_adapters.length) {
      console.log('AGENT REPORT: network adapters table change');

      var options = {agentAddr: '127.0.0.1', upTime: 1000};
      var enterpriseOid = "1.3.6.1.4.1.2000.1";

      var varbinds = rez.map((item) => ({
        oid: item.oid,
        type: snmp.ObjectType.OctetString,
        value: JSON.stringify(item),
      }));

      session.trap (enterpriseOid, varbinds, options,
              function (error) {
          if (error)
              console.error (error);
      });
    }

    global_net_adapters = [...current];
  }
  session.tableColumns(network_oid, columns, 1, checkAdapters);

  var running_apps_oid = "1.3.6.1.2.1.25.4.2";
  var apps_columns = [2, 4, 6, 7];

  const name = 'Telegram';

  rez = [];

  const checkApps = (error, table) => {
    const apps = services.getRunning(error, table).map(service => service.resp.toString());

    const newApps = apps.filter(element => !global_running_apps.includes(element));
    const closedApps = global_running_apps.filter(element => !apps.includes(element));

    if  ((newApps.length || closedApps.length) && global_running_apps.length) {
      console.log('AGENT REPORT: running applications change');

      const options = {agentAddr: '127.0.0.1', upTime: 1000};
      
      const appOid = "1.3.6.1.4.1.2001.1";

      const message = {
        started: newApps,
        closed: closedApps,
      }

      var appVarbind = {
        oid: appOid,
        type: snmp.ObjectType.OctetString,
        value: JSON.stringify(message),
      };

      session.trap(appOid, [appVarbind], options,
              function (error) {
          if (error)
              console.error (error);
      })
    }

    global_running_apps = [...apps];
  }

  session.tableColumns(running_apps_oid, apps_columns, 1, checkApps);
}, 3000);

app.get('/about', function(req, res) {
  res.render('pages/about');
});

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
