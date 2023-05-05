
const snmp = require("net-snmp");

const renderFunction = (req, res) => {
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
}

const getDisks = (error, table) => {
  var columns = [3, 4, 5, 6];
  var indexes = [];
  var names = [];
  if (error) {
      console.error (error.toString ());
  } else {
      for (let index in table) 
      {
        if(table[index][columns[0]].length && !names.some((item) => !Buffer.compare(item, table[index][columns[0]]))) 
        {
          indexes.push (parseInt (index));
          names.push(table[index][columns[0]]);
        }
      }
  }

  return indexes.map((index)=> ({ 
    oid: `1.3.6.1.2.1.2.2.1.7.${index}`, 
    resp: table[index][columns[0]],
    units: table[index][columns[1]],
    size: table[index][columns[2]],
    used: table[index][columns[3]] 
  }));
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

const agentCheckDisks = (error, table, session, global_disks) => {

  const disksTable = getDisks(error, table);
  const disks = disksTable.map(disk => disk.resp.toString());
  const disksDescription = disksTable.map(disk => 
      `${disk.resp.toString()} - used ${formatBytes(disk.used * disk.units)} of ${formatBytes(disk.size * disk.units)}`
    );

  const newDisks = disksTable.filter(disk => !global_disks
    .some(element => !Buffer.compare(disk.resp, element.resp))
  );

  // const closedDisks = global_disks.filter(element => !disks.includes(element));
  const closedDisks = global_disks.filter(disk => !disksTable
    .some(element => !Buffer.compare(disk.resp, element.resp))
  );

  if  ((newDisks.length || closedDisks.length) && global_disks.length) {
    console.log('AGENT REPORT: disks table change');

    const options = {agentAddr: '127.0.0.1'};
    const appOid = "1.3.6.1.4.1.2002.1";
    
    const message = { 
      added: newDisks.map(disk => `${disk.resp.toString()} - used ${formatBytes(disk.used * disk.units)} of ${formatBytes(disk.size * disk.units)}`),
      removed: closedDisks.map(disk => `${disk.resp.toString()} - used ${formatBytes(disk.used * disk.units)} of ${formatBytes(disk.size * disk.units)}`)
    };

    var appVarbind = {
      oid: appOid,
      type: snmp.ObjectType.OctetString,
      value: JSON.stringify(message),
    };

    session.trap(appOid, [appVarbind], options,
            function (error) { if (error) console.error (error); })
  }

  return [...disksTable];
}

module.exports = { agentCheckDisks, renderFunction };