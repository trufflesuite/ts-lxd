import { after, before, describe, it } from "mocha";

import assert from "assert";
import shortid from "shortid";
import { HTTPError } from "got";

import { Client, Container } from "../src/index";

/*
 * NOTE: These tests require that an image with the alias 'ubuntu-18.04' exists
 * on your machine, though they don't really care that it's _actually_ ubuntu
 * 18.04, as long as whatever it is has bash in the usual location. You likely
 * need to pull the `ubuntu:18.04` image, and create the alias for it like so:
 *
 * $ lxc image alias create ubuntu-18.04 6700bee14eb3
 *
 */
const IMAGE_ALIAS = "ubuntu-18.04";

describe("Client", () => {
  const client = new Client();

  // Note: I don't explicitly test Container.stop and Container.delete anywhere
  // in this suite because they're exercised by literally every test. Instead I
  // add some checks to make sure that the set of containers that exists when
  // tests start is the set of containers that exists when tests end

  let preExistingContainers: Container[];
  let preExistingContainerNames: string[];
  before("capture preExistingContainers", async () => {
    preExistingContainers = await client.getAllContainers();
    preExistingContainerNames = preExistingContainers.map((container) => container.name);
  });

  describe("create", () => {
    let testStartMillis: number;
    let testStartIsoString: string;
    let containerName: string;

    before("create the client", async () => {
      const testStart = new Date();
      testStartMillis = testStart.getTime();
      testStartIsoString = testStart.toISOString();
      containerName = getContainerNames(1)[0];
    });

    it("should create a container", async function() {
      this.timeout(10000);
      const testContainer = await client.createContainer(containerName, IMAGE_ALIAS, {});

      assert(testContainer.name, "testContainer");

      /*
       * Because of some crazy witchcraft that makes no sense to me, LXD always
       * seems to be reporting a created timestamp that's around 500ms _earlier_
       * than the start of the test, even though it's running locally using the
       * same clock source.
       * (╯°□°)╯︵ ┻━┻
       * to work around that I'm adding a second to the `createdTimestamp` here.
       */
      const createdTimestampMillis = Date.parse(testContainer.metadata.created_at) + 1000;

      /*
       * We get the original timestamp as an ISO 8601 formatted string, but it's
       * localized to the computer's timezone Recreating it here gives it to us
       * in UTC.
       */
      const createdTimestamp = new Date(createdTimestampMillis);
      const createdTimestampIsoString = createdTimestamp.toISOString();

      assert(
        testStartMillis < createdTimestampMillis,
        `Container should have been created after the start of the test. ` +
        `Test started at ${testStartIsoString}. ` +
        `Container created at ${createdTimestampIsoString}, or ` +
        `${testStartMillis - createdTimestampMillis}ms before the test ` +
        `started.`,
      );
    });

    after("delete container", async () => {
      const c = await client.getContainer(containerName);
      await c.delete();
    });
  });

  describe("getContainers", () => {
    let createdContainerNames: string[];

    before("create containers", async function() {
      this.timeout(10000);
      // create four shiny new containers
      createdContainerNames = getContainerNames(4);
      await Promise.all(
        createdContainerNames.map(async (name) => {
          await client.createContainer(name, IMAGE_ALIAS);
        }),
      );
    });

    it("should fetch some containers", async () => {
      const containers = await client.getAllContainers();

      assert(containers.length === 4 + preExistingContainers.length);
      const observedContainerNames = containers.map((container) => container.name);

      for (const observedContainerName of observedContainerNames) {
        assert(
          createdContainerNames.includes(observedContainerName) ||
          preExistingContainerNames.includes(observedContainerName),
          `Container ${observedContainerName} didn't exist when the test suite was started. ` +
          `Did you create a container while the test was running?`,
        );
      }

      for (const createdContainerName of createdContainerNames) {
        assert(
          observedContainerNames.includes(createdContainerName),
          `Container ${createdContainerName} wasn't returned by client.getAllContainers`,
        );
      }
    });

    after ("remove created containers", async function() {
      this.timeout(10000);
      await Promise.all(
        createdContainerNames.map(async (name) => {
          const container = await client.getContainer(name);
          await container.delete();
        }),
      );
    });
  });

  describe("run", () => {
    const fileName = `/testfile-${shortid().replace(/-|_/g, "")}`;
    const fileData = `${shortid()}${shortid()}`;
    const errorData = `${shortid()}${shortid()}`;
    const containerName = getContainerNames(1)[0];

    let container: Container;
    before("create the container", async function() {
      this.timeout(10000);
      container = await client.createContainer(containerName, "ubuntu-18.04");
      await container.start();
    });

    it("should create a file in the container", async function() {
      const results = await container.run([
        "/bin/bash",
        "-c",
        `echo '${fileData}' > ${fileName}`,
      ]);

      assert.strictEqual(results.stdOut.trim(), "");
      assert.strictEqual(results.stdErr.trim(), "");
    });

    it("should read back a file in the container", async function() {
      const results = await container.run([
        "/bin/bash",
        "-c",
        `cat ${fileName}`,
      ]);

      assert.strictEqual(results.stdOut.trim(), fileData);
      assert.strictEqual(results.stdErr.trim(), "");
    });

    it("should get error data via stderr", async function() {
      const results = await container.run([
        "/bin/bash",
        "-c",
        `>&2 echo '${errorData}'`,
      ]);

      assert.strictEqual(results.stdOut.trim(), "");
      assert.strictEqual(results.stdErr.trim(), errorData);
    });

    after ("remove created container", async function() {
      this.timeout(10000);
      await container.delete();
    });
  });

  after("verify that only the preExistingContainers still exist", async function() {
    this.timeout(20000);
    const containers = await client.getAllContainers();
    const observedContainerNames = containers.map((container) => container.name);

    for (const observedContainerName of observedContainerNames) {
      if (!preExistingContainerNames.includes(observedContainerName)) {
        const container = await client.getContainer(observedContainerName);
        if (container.status !== "Stopping") {
          await handleBadCleanup(container);
        }
      }
    }

    for (const preExistingContainerName of preExistingContainerNames) {
      assert(
        observedContainerNames.includes(preExistingContainerName),
        `Container ${preExistingContainerName} existed before tests ran, but no longer exists. ` +
        "Did you delete a container while the test was running? If not, this test suite might have " +
        "accidentally deleted one of your previously running containers!",
      );
    }
  });
});

function getContainerNames(count: number): string[] {
  // kill the dashes here so that they're valid hostnames
  return Array.from(
    { length: count },
    () => "testcontainer-" + (shortid().replace(/-|_/g, "")).toLowerCase(),
  );
}

async function handleBadCleanup(container: Container) {
  const statuses: string[] = [container.status];
  const wasDeleted = await waitAndRetry(10, 500, async () => {
    try {
      await container.refresh();
    } catch (err) {
      if (err instanceof HTTPError && err.statusCode === 404) {
        statuses.push("[Deleted]");
        return true;
      }
      throw err;
    }

    if (container.status !== statuses.slice(-1)[0]) {
      statuses.push(container.status);
    }

    return container.status === "Stopping";
  });

  const statusMessage = `Observed status(es) : ${statuses.join(", ")}`;

  // we're gonna fail here either way, but we use `assert` to give a nice user-friendly failure message
  assert(wasDeleted, `Container ${container.name} was not cleaned up. ${statusMessage}`);
  assert(!wasDeleted, `RACE CONDITION: await container.delete() should block until container is deleted.\n` +
  `However, container ${container.name} was cleaned up after tests completed. ${statusMessage}`,
  );
}

// DO NOT USE THIS UNLESS YOU'RE POLLING FOR A STATE CHANGE
async function waitAndRetry(
  maxTries: number,
  msecBetweenTries: number,
  func: () => boolean | Promise<boolean>,
): Promise<boolean> {

  let tries = 0;

  if (maxTries <= 1) {
    throw new Error(`maxTries was ${maxTries}. I mean... really?? What's the point of calling this, then?`);
  }

  // oooh, a do..while loop! You know you've got a good idea when you're writing one of these bad boys!
  do {
    // thresholding your iterator: another surefire sign of coding success!
    if (tries > 1) {
      await _wait(msecBetweenTries);
    }
    const result = await Promise.resolve(func());
    if (result) {
      return result;
    }
    tries++;
  } while (tries < maxTries);

  // falsy failure so we don't need a try/catch
  return false;
}

// Don't use this in tests. Use `waitAndRetry`, instead.
function _wait(msec: number): Promise<void> {
  return new Promise((accept) => {
    setTimeout(accept, msec);
  });
}
