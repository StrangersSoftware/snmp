const snmp = require("net-snmp");

const renderFunction = (req, res) => {
  const ip = req.body.ip;
  const name = req.body.name;
  const installed = req.body.installed === 'clicked';

  const session = snmp.createSession(ip || "127.0.0.1", "public");
  var oid = installed ? "1.3.6.1.2.1.25.6.3" : "1.3.6.1.2.1.25.4.2";
            
  var columns = installed ? [2] : [2, 4, 6, 7];

  const responseCb = (error, table) => {
    const rez = installed ? getInstalled(error, table) : getRunning(error, table);
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
}

const getRunning = (error, table) => {
    var columns = [2, 4, 6, 7];
    var indexes = [];
    var names = [];
    if (error) { console.error (error.toString ()); } 
    else {
        for (let index in table) 
        {
          if(table[index][columns[1]].length && !names.some((item) => !Buffer.compare(item, table[index][columns[0]]))) 
          {
            indexes.push (parseInt (index));
            names.push(table[index][columns[0]]);
          }
        }
    }

    return indexes.map((index)=> ({ 
      oid: `1.3.6.1.2.1.2.2.1.7.${index}`, 
      resp: table[index][columns[0]],
      path: table[index][columns[1]],
      runType: table[index][columns[2]],
      status: table[index][columns[3]] 
    }));
}

const getInstalled = (error, table) => {
    var columns = [2];
    var indexes = [];
    var names = [];

    if (error) {
        console.error (error.toString ());
    } else {
        for (let index in table) 
        {
          indexes.push (parseInt (index));
          names.push(table[index][columns[0]].toString('binary'));
        }
    }

    return indexes.map((index, id)=> ({ 
      oid: `1.3.6.1.2.1.2.2.1.7.${index}`, 
      resp: names[id],
      path: null,
      runType: null,
      status: null, 
    }));
}


const agentCheck = (error, table, session, global_running_apps) => {
  const apps = getRunning(error, table).map(service => service.resp.toString());

  const newApps = apps.filter(element => !global_running_apps.includes(element));
  const closedApps = global_running_apps.filter(element => !apps.includes(element));

  if  ((newApps.length || closedApps.length) && global_running_apps.length) {
    console.log('AGENT REPORT: running applications change');

    const options = {agentAddr: '127.0.0.1'};
    const appOid = "1.3.6.1.4.1.2001.1";
    const message = { started: newApps, closed: closedApps }

    var appVarbind = {
      oid: appOid,
      type: snmp.ObjectType.OctetString,
      value: JSON.stringify(message),
    };

    session.trap(appOid, [appVarbind], options,
            function (error) { if (error) console.error (error); })
  }

  return [...apps];
}

module.exports = { agentCheck, getRunning, getInstalled, renderFunction };