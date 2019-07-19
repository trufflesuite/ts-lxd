import fs from "fs";
import _path from "path";
import debugLib from "debug";
import { Client } from "./Client";
import { Process } from "./Process";
import { AlreadyStoppedError, AlreadyStartedError } from "./errors";
import { promisify } from "util";
import {
  IContainerStateMetadata,
  IContainerExecRequest,
  IExecOperationMetadata,
  IOperationMetadata,
  MetadataStatus,
  IContainerMetadata,
} from "./model";

const debug = debugLib("ts-lxd:Container");

// file system
export interface IExecOptions {
  env?: {
    [key: string]: string;
  };
  interactive?: boolean;
}

export class Container {

  private _client: Client;
  private _metadata: IContainerMetadata;
  private _stateMetadata: IContainerStateMetadata;

  /**
   * Gets the metadata for this container.
   */
  public get metadata() {
    return this._metadata;
  }

  /**
   * Gets the architecture.
   */
   public get architecture() {
    return this._metadata.architecture;
  }

  /**
   * Gets the ephemeral flag
   */
  public get ephemeral() {
    return this._metadata.ephemeral;
  }

  /**
   * Gets the stateful flag
   */
  public get stateful() {
    return this._metadata.stateful;
  }

  /**
   * Gets the status (Running/Stopped)
   */
  public get status() {
    return this._metadata.status;
  }

  /**
   * Gets the container name
   */
  public get name() {
    return this._metadata.name;
  }

  /**
   * Creates a new container.
   * @param client
   * @param metadata
   * @param state
   */
  constructor(client: Client, metadata: IContainerMetadata, state: IContainerStateMetadata) {
    this._client = client;
    this._metadata = metadata;
    this._stateMetadata = state;
  }

  /**
   * Sets the container name
   */
  public async setName(name: string): Promise<void> {
    debug(`Changing name of container '${this.name}' to ${name}`);
    try {
      const response = await this._client.request<{ name: string }, { name: string }>({
        path: "POST /containers/" + name,
        body: { name },
      }) as { name: string };

      this._metadata.name = response.name;
    } catch (err) {
      debug(`Error changing name of container '${this.name}' to ${name}: ${err}`);
      throw err;
    }
  }

  /**
   * Gets the number of running processes in this container.
   */
  public get processCount() {
    return this._stateMetadata.processes;
  }

  public get state(): MetadataStatus {
    return this._stateMetadata.status;
  }

  /**
   * Gets the interface on this container with the specified name and optional protocol.
   * @param dev
   * @param protocol
   */
  public ip(dev: string, protocol?: string) {
    // check if ips unavailable
    if (!this._stateMetadata.network) {
      return null;
    }

    // check if dev unavailable
    if (!this._stateMetadata.network[dev]) {
      return null;
    }

    protocol = protocol || "inet";

    // get ips
    const ips = this._stateMetadata.network[dev].addresses;

    for (const ip of ips) {
      if (ip.family === protocol) {
        return ip;
      }
    }

    return null;
  }

  /**
   * Gets the IPv4 address of this container.
   * @returns
   */
  public async ipv4(numRetries: number = 15, msBetweenRetries: number = 1000): Promise<string> {
    let ip = this.ip("eth0", "inet");
    if (ip) {
      return ip.address;
    }

    // refresh until IPv4 obtained
    const container = this;
    let tries = 1;

    return new Promise<string>(async (accept, reject) => {
      debug(`Getting IPv4 address of ${this.name}`);
      const retry = async () => {
        await container.refresh();
        ip = container.ip("eth0", "inet");

        if (ip) {
          return accept(ip.address);
        } else {
          tries++;
          if (tries >= numRetries) {
            debug(`IPv4 address of ${this.name} unavailable after 15 tries.`);
            reject(new Error("Exceeded retries when fetching address"));
          }
          debug(`IPv4 address of ${this.name}, retrying.`);
          setTimeout(retry, msBetweenRetries);
        }
      };
      await retry();
    });
  }

  /**
   * Gets the IPv6 address of this container.
   * @param {function?} callback
   * @returns {string|undefined}
   */
  public async ipv6(numRetries: number = 15, msBetweenRetries: number = 1000): Promise<string> {
    let ip = this.ip("eth0", "inet6");
    if (ip) {
      return ip.address;
    }

    // refresh until IPv6 obtained
    const container = this;
    let tries = 0;

    return new Promise<string>(async (accept, reject) => {
      debug(`Getting IPv6 address of ${this.name}`);
      const retry = async () => {
        await container.refresh();
        ip = container.ip("eth0", "inet6");

        if (ip) {
          return accept(ip.address);
        } else {
          tries++;
          if (tries >= numRetries) {
            debug(`IPv6 address of ${this.name} unavailable after 15 tries.`);
            reject(new Error("Exceeded retries when fetching address"));
          }
          debug(`IPv6 address of ${this.name}, retrying.`);
          setTimeout(retry, msBetweenRetries);
        }
      };
      await retry();
    });
  }

  /**
   * Refreshes the container information.
   */
  public async refresh() {
    try {
      debug(`Refreshing metadata for ${this.name}`);
      const metadata = await this._client.request<never, IContainerMetadata>({
        path: "GET /containers/" + this._metadata.name,
      }) as IContainerMetadata;

      this._metadata = metadata;
    } catch (err) {
      debug(`Error refreshing metadata for ${this.name}: ${err}`);
      throw err;
    }

    try {
      // we now have to a seperate query for state information
      // which we use heavily
      debug(`Refreshing state metadata for ${this.name}`);
      const stateMetadata = await this._client.request<never, IContainerStateMetadata>({
        path: "GET /containers/" + this._metadata.name + "/state",
      }) as IContainerStateMetadata;

      this._stateMetadata = stateMetadata;
    } catch (err) {
      debug(`Error refreshing state metadata for ${this.name}: ${err}`);
      throw err;
    }
  }

  /**
   * Executes a terminal command on the container
   * @param command The command with arguments.
   * @param env The environment data, optional.
   */
  public async run(
    command: string[],
    env?: { [key: string]: string },
  ): Promise<{ stdOut: string, stdErr: string, exitCode: number | undefined }> {

    debug("Running command '", command.join(" "), "' in container", this.name);
    let proc: Process;
    try {
      proc = await this.exec(command, env ? { env } : {});
    } catch (err) {
      debug("Error when running command '", command.join(" "), "' in container", `${this.name}:`, err);
      throw err;
    }

    return new Promise((accept, reject) => {

      // handle stdout/stderr
      let stdOut = "";
      let stdErr = "";

      proc.on("data", (isErr: boolean, msg: string) => {
        if (isErr) {
          stdErr += msg;
        } else {
          stdOut += msg;
        }
      });

      // handle close
      proc.on("close", () => {
        process.nextTick(async () => {
          accept({
            stdOut,
            stdErr,
            exitCode: proc.exitCode,
          });
        });
      });

      proc.on("error", (err: any) => {
        debug(`Error (from Process error event) when running command '${command.join(" ")}' ` +
        `in container ${this.name}:`, err);
        reject(err);
      });
    });
  }

  /**
   * Executes a terminal command on the container.
   * @param command The command with arguments.
   * @param env The options data, optional.
   */
  public async exec(command: string[], options: IExecOptions): Promise<Process> {
    const interactive = options.interactive || false;

    const body: IContainerExecRequest = {
      command,
      "environment": options.env || {},
      interactive,
      "record-output": false,
      "wait-for-websocket": true,
    };

    try {
      debug("Executing command '", command.join(" "), "' in container", this.name);
      const operation: IOperationMetadata<IExecOperationMetadata> =
        await this._client.request<IContainerExecRequest, IExecOperationMetadata>({
          path: "POST /containers/" + this.name + "/exec",
          body,
          waitForOperationCompletion: false,
        }) as IOperationMetadata<IExecOperationMetadata>;

      return await this._client.getProcess(operation, interactive);
    } catch (err) {
      debug("Error when executing command '", command.join(" "), "' in container", `${this.name}:`, err);
      throw err;
    }
  }

  public async stop(timeout: number = 30, force: boolean = false, stateful: boolean = false) {
    try {
      debug(`Stopping container ${this.name}`);
      return await this._setState("stop", timeout, force, stateful);
    } catch (err) {
      // ignore exception if the container is already stopped
      if (!(err instanceof AlreadyStoppedError)) {
        debug(`Error when stopping container ${this.name}:`, err);
        throw err;
      }
      debug(`Warning: container ${this.name} was already stopped. API error silenced.`);
    }
  }

  public async start(timeout: number = 30, force: boolean = false, stateful: boolean = false) {
    try {
      debug(`Starting container ${this.name}`);
      return await this._setState("start", timeout, force, stateful);
    } catch (err) {
      // ignore exception if the container is already started
      if (!(err instanceof AlreadyStartedError)) {
        debug(`Error when starting container ${this.name}:`, err);
        throw err;
      }
      debug(`Warning: container ${this.name} was already started. API error silenced.`);
    }
  }

  public async restart(timeout: number = 30, force: boolean = false) {
    try {
      debug(`Restarting container ${this.name}`);
      return await this._setState("restart", timeout, force);
    } catch (err) {
      debug(`Error when restarting container ${this.name}:`, err);
      throw err;
    }
  }

  public async freeze(timeout: number = 30, force: boolean = false) {
    try {
      debug(`Freezing container ${this.name}`);
      return await this._setState("freeze", timeout, force);
    } catch (err) {
      debug(`Error when freezing container ${this.name}:`, err);
      throw err;
    }
  }

  public async unfreeze(timeout: number = 30, force: boolean = false) {
    try {
      debug(`Unfreezing container ${this.name}`);
      return await this._setState("unfreeze", timeout, force);
    } catch (err) {
      debug(`Error when unfreezing container ${this.name}:`, err);
      throw err;
    }
  }

  /**
   * Delete the container.
   */
  public async delete(): Promise<void> {
    await this.stop();

    try {
      debug(`Deleting container ${this.name}`);
      return await this._client.request<never, void>({
        path: "DELETE /containers/" + this.name,
      }) as void;
    } catch (err) {
      debug(`Error when deleting container ${this.name}:`, err);
      throw err;
    }
  }

  /**
   * Uploads data to a remote path on the container.
   * Container must be running.
   * @param remotePath
   * @param data
   */
  public async upload(remotePath: string, data: string | Buffer): Promise<void> {
    // create operation
    try {
      debug(`Uploading file to container ${this.name} at remote path ${remotePath}`);
      await this._client.request({
        path: "POST /containers/" + this.name + "/files?path=" + remotePath,
        body: Buffer.isBuffer(data) ? data.toString("utf8") : data,
      });
    } catch (err) {
      debug(`Error when uploading file to container ${this.name} at remote path ${remotePath}:`, err);
      throw err;
    }
  }

  // TODO: fix this
  /*
   * Downloads data from a remote path on the container.
   * Container must be running.
   * @param remotePath
   */
  /*public async download(remotePath: string): Promise<Buffer> {

    // read the file
    return this._client.request<void, void>({
      path: "GET_RAW /containers/" + this.name + "/files?path=" + remotePath,
    });
  }*/

  /**
   * Uploads a file to a remote path on the container.
   * @param localPath
   * @param remotePath
   */
  public async uploadFile(localPath: string, remotePath: string): Promise<void> {
    try {
      debug(`Uploading file at ${localPath} to container ${this.name} at remote path ${remotePath}`);

      const buff = await promisify(fs.readFile)(localPath);
      await this.upload(remotePath, buff);
    } catch (err) {
      debug(`Error when uploading file at ${localPath} to container ${this.name} ` +
        `at remote path ${remotePath}:`, err);
      throw err;
    }
  }

  // TODO: fix this
  /*
   * Downloads a file from the remote path on the container.
   * @param remotePath
   * @param localPath
   */
  /*public async downloadFile(remotePath: string, localPath: string) {
    const data = await this.download(remotePath);
    await promisify(fs.writeFile)(localPath, data);
  }*/

  private async _setState(
    action: "start" | "stop" | "restart" | "freeze" | "unfreeze",
    timeout: number = 30,
    force: boolean = false,
    stateful?: boolean,
  ): Promise<void> {

    await this._client.request({
      path: "PUT /containers/" + this._metadata.name + "/state",
      body: {
        action,
        timeout,
        force,
        stateful,
      },
    });
    await this.refresh();
  }
}

export default Container;
