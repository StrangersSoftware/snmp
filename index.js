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

app.get('/services', async (req, res) => res.render('pages/services', {
    oids: [],
    tagline: 'Please set service name to search in a services list',
    subTagline: ''
  })
);

app.post('/services', (req, res) => {
  const ip = req.body.ip;
  const name = req.body.name;

  const session = snmp.createSession(ip || "127.0.0.1", "public");
  var oid = "1.3.6.1.2.1.25.4.2";
  var columns = [2, 6, 7];

  const responseCb = (error, table) => {
    if (error) {
        console.error (error.toString ());
    } else {
        var indexes = [];
        for (let index in table) indexes.push (parseInt (index));
        
        const oids_data = indexes.map((index)=> ({ 
          oid: `1.3.6.1.2.1.25.4.2.1.3.${index}`, 
          resp: table[index][columns[0]], 
          runType: table[index][columns[1]],
          status: table[index][columns[2]] 
        }));

        const search_oid = indexes
          .filter((index)=> table[index][columns[0]].includes(name))
          .map((index) => ({ 
              oid: `1.3.6.1.2.1.25.4.2.1.3.${index}`, 
              resp: table[index][columns[0]], 
              runType: table[index][columns[1]],
              status: table[index][columns[2]] 
            }));

        res.render('pages/services', {
          oids: !!name ? search_oid : oids_data,
          tagline: `The following software found on requested host (${ip || "127.0.0.1"})`,
          subTagline: 'Run type: running(1), runnable(2), notRunnable(3), invalid(4); Status:  running(1), runnable(2), notRunnable(3), invalid(4)',
        });
    }
  }

  var maxRepetitions = 1;
  console.log('SERVICES TABLE');
  session.tableColumns(oid, columns, maxRepetitions, responseCb);
});


// app.post('/services', (req, res) => {
//   const ip = req.body.ip;
//   const name = req.body.name;
  
//   if (!name) {
//     res.render('pages/services', {
//       oids: [],
//       tagline: 'Error! Please enter service name or part of name.',
//       subTagline: ''
//     });

//     return;
//   }

//   let result = [];

//   const session = snmp.createSession(ip || "127.0.0.1", "public");
  
//   var oid = "1.3.6.1.2.1.25.4.2.1";

//   const doneCb = (error) => {
//     if (error) console.error(error.toString());
//     session.close();

//     const oids_data = result.map((res)=> ({ oid: res.oid, resp: res.value, status: res.status }));

//     res.render('pages/services', {
//       oids: oids_data,
//       tagline: `The following matches found on requested host (${ip || "127.0.0.1"})`,
//       subTagline: 'Statuses:  running(1), runnable(2), notRunnable(3), invalid(4)',
//     });
//   }

//   const feedCb = (varbinds) => {
//       for (var varbind of varbinds) {
//           if (snmp.isVarbindError(varbind)) console.error (snmp.varbindError(varbind));
//           if (varbind.type === 4 && Buffer.from(varbind.value).toString('utf8').includes(name)) {
//             result.push({oid: varbind.oid, value: Buffer.from(varbind.value).toString('utf8'), status: 0 }); 
//           }
//           for (var rez of result) 
//             if (varbind.oid === `1.3.6.1.2.1.25.4.2.1.7.${rez.oid.split('.').pop()}`) rez.status = varbind.value;
//       }
//   }
  
//   var maxRepetitions = 20;
//   session.subtree(oid, maxRepetitions, feedCb, doneCb);
// });

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
  var columns = [2, 7, 8];
  const responseCb = (error, table) => {
    if (error) {
        console.error (error.toString ());
    } else {
        var indexes = [];
        for (let index in table) indexes.push (parseInt (index));

        const oids_data = indexes.map((index)=> ({ 
          oid: `1.3.6.1.2.1.2.2.1.2.${index}`, 
          resp: table[index][columns[0]], 
          status: table[index][columns[1]],
          opStatus: table[index][columns[2]],
        }));
        res.render('pages/network', {
          oids: oids_data,
          tagline: `The following network adapters found on requested host (${ip || "127.0.0.1"})`,
          subTagline: `Statuses:  up(1), down(2), testing(3), unknown(4), dormant(5), notPresent(6), lowerLayerDown(7)`,
        });
    }
  }

  var maxRepetitions = 1;
  if (selected_oid)   
  {
    const varbind = [{
      oid: `1.3.6.1.2.1.2.2.1.7.${selected_oid.split('.').pop()}`,
      type: snmp.ObjectType.Integer,
      value: Number(new_status),
    }]

    console.log('SET -', varbind[0]);

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

app.get('/about', function(req, res) {
  res.render('pages/about');
});

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
