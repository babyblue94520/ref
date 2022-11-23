const fs = require('fs');
let dir = 'dist';
try {
    fs.rmdirSync(dir,{recursive:true});
    console.log(`${dir} is deleted!`);
} catch (err) {
    console.log(`${dir} is not exist.`);
}