A typescript client for communicating with a local or remote instance of linux containers. The interface is object-oriented, simple and uniform. Unrestrictive with an open MIT license.

This package was ported from Alan Doherty's [`node-lxd`](https://github.com/alandoherty/node-lxd) and updated to support TypeScript and modern async/await style code.

This package forked from `node-lxd`, but it should not be considered a drop-in replacement, as we've made several breaking changes.

# Installing

```bash
$ npm install --save node-lxd
```

## Getting Started ##

The following example connects to the local LXC instance and launches a new container.

```js
import lxd from "ts-lxd";

const client = lxd();

(async () => {
  const container = await client.createContainer("myContainer", "ubuntu");
  await container.start();
  console.log("Started " + container.name());
})();
```

## Example ##

The following example uses an express application to allow users to create containers and execute commands.

```js
// requires
import express, { Request, Response, NextFunction }  from "express";
import lxd, { Client, Container, Process } from "lxd";

const client: Client = lxd();
const app = express();

app.post("/create", function(req: Request, res: Response, _next: NextFunction): void {
  try {
    const container = await client.launchContainer(req.query.name);
    res.json({success: true, message: "Container launched"});
  } catch (err) {
    res.json({success: false, message: err.getMessage()});
  }
});

app.post("/run", async function(req: Request, res: Response, _next: NextFunction) {
  try {
    const containers: Container[] = await client.containers();

    for (const container of containers) {
      if (container.name === req.query.name) {
        let process;
          process = await container.run(req.query.cmd.split(" "));
        if (process.stdErr.length > 0) {
          res.json({success: false, message: stdErr});
        } else {
          res.json({success: true, message: stdOut});
        }
      }
    }

    res.json({success: false, message: "Container does not exist"});
  } catch (err) {
    res.json({success: false, message: err.getMessage()});
  }
});

app.listen(3000, function(err) {
  if (!err) {
    console.log("listening on port 3000");
  }
});
```