import fs from "fs";

let dir = "lib";
try {
  fs.rmdirSync(dir, { recursive: true });
  console.log(`${dir} is deleted!`);
} catch (err) {
  console.log(`${dir} is not exist.`);
}
