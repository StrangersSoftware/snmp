
const snmp = require("net-snmp");

const renderFunction = (req, res) => {
  const ip = req.body.ip;

  const session = snmp.createSession(ip || "127.0.0.1", "public");
  var oid = "1.3.6.1.2.1.2.2";
  var columns = [2, 7, 8, 6];

  const responseCb = (error, table) => {
    const rez = getAdapters(error, table);
    res.render('pages/network', {
      oids: rez,
      tagline: `The following network adapters found on requested host (${ip || "127.0.0.1"})`,
      subTagline: `Statuses:  up(1), down(2), testing(3), unknown(4), dormant(5), notPresent(6), lowerLayerDown(7)`,
    });
  }

  console.log('NETWORK TABLE');
  session.tableColumns(oid, columns, 1, responseCb);
}

const getAdapters = (error, table) => {
    var columns = [2, 7, 8, 6];
    var indexes = [];
    var mac_addresses = [];
    if (error) {
        console.error (error.toString ());
    } else {
        for (let index in table) 
        {
          if(table[index][columns[3]].length && !mac_addresses.some((item) => !Buffer.compare(item, table[index][columns[3]]))) 
          {
            indexes.push (parseInt (index));
            mac_addresses.push(table[index][columns[3]]);
          }
        }
    }

    return indexes.map((index)=> ({ 
      oid: `1.3.6.1.2.1.2.2.1.2.${index}`, 
      resp: table[index][columns[0]], 
      status: table[index][columns[1]],
      opStatus: table[index][columns[2]],
      mac: table[index][columns[3]].toString( 'hex' ).match( /.{1,2}/g ).join( ':' ).toUpperCase(),
    }));
}



const agentCheck = (error, table, session, global_net_adapters) => {
  let rez = [];
  const current = getAdapters(error, table);
  
  for(let i = 0; i < current.length; i++ ) 
    if (JSON.stringify(current[i]) !== JSON.stringify(global_net_adapters[i]))
      rez.push({...current[i], resp: current[i].resp.toString().slice(0, -1)});
  
  if  (rez.length && global_net_adapters.length) {
    console.log('AGENT REPORT: network adapters table change');

    var options = {agentAddr: '127.0.0.1'};
    var enterpriseOid = "1.3.6.1.4.1.2000.1";

    var varbinds = rez.map((item) => ({
      oid: item.oid,
      type: snmp.ObjectType.OctetString,
      value: JSON.stringify(item),
    }));

    session.trap(enterpriseOid, varbinds, options,
            function (error) {
        if (error)
            console.error (error);
    });
  }

  return [...current];
}

module.exports = { agentCheck, getAdapters, renderFunction };