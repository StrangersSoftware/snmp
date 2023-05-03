const getRunning = (error, table) => {
    var columns = [2, 4, 6, 7];
    var indexes = [];
    var names = [];
    if (error) {
        console.error (error.toString ());
    } else {
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

module.exports = { getRunning, getInstalled };