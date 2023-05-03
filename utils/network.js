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

module.exports = { getAdapters };