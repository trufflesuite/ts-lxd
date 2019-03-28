import fs, { ReadStream, WriteStream, BinaryData, Stats, WriteFileOptions } from "fs";
import _path from "path";
import { Client } from "./Client";
import { Process } from "./Process";
import { OperationError } from "./OperationError";
import { promisify } from "util";
import { IContainerStateMetadata, IContainerExecRequest, IExecOperationMetadata, IOperationMetadata, MetadataStatus, IContainerMetadata } from "./model";

// file system
export class ContainerFS {

  /**
   * Sets the base path.
   */
  public set base(base: string) {
    this._base = base;
  }

  /**
   * Gets the base path.
   */
  public get base(): string {
    return this.base;
  }

  /**
   * Gets the parent container.
   */
  public get container(): Container {
    return this._container;
  }
  private _container: Container;

  private _base: string;

  /**
   * Creates a new file system wrapper for a container.
   * @param container
   */
  constructor(container: Container) {
    this._container = container;
    this._base = "";
  }

  public chmod(path: string, mode: string | number): Promise<void> {
    return promisify(fs.chmod)(this.resolve(path), mode);
  }

  public chmodSync(path: string, mode: string | number): void {
    return fs.chmodSync(this.resolve(path), mode);
  }

  public chown(path: string, uid: number, gid: number): Promise<void> {
    return promisify(fs.chown)(this.resolve(path), uid, gid);
  }

  public chownSync(path: string, uid: number, gid: number): void {
    return fs.chownSync(this.resolve(path), uid, gid);
  }

  public close(fd: number): Promise<void> {
    return promisify(fs.close)(fd);
  }

  public closeSync(fd: number): void {
    return fs.closeSync(fd);
  }

  public createReadStream(path: string, options?: string | {
        flags?: string;
        encoding?: string;
        fd?: number;
        mode?: number;
        autoClose?: boolean;
        start?: number;
        end?: number;
        highWaterMark?: number;
    }): ReadStream {
    return fs.createReadStream(this.resolve(path), options);
  }

  public createWriteStream(path: string, options?: string | {
        flags?: string;
        encoding?: string;
        fd?: number;
        mode?: number;
        autoClose?: boolean;
        start?: number;
    }): WriteStream {
    return fs.createWriteStream(this.resolve(path), options);
  }

  public mkdir(path: string, mode: string | number): Promise<void> {
    return promisify(fs.mkdir)(this.resolve(path), mode);
  }

  public mkdirSync(path: string, mode: string | number): void {
    return fs.mkdirSync(this.resolve(path), mode);
  }

  public open(path: string, flags: string | number, mode: string | number): Promise<number> {
    return promisify(fs.open)(this.resolve(path), flags, mode);
  }

  public openSync(path: string, flags: string | number, mode: string | number): number {
    return fs.openSync(this.resolve(path), flags, mode);
  }

  public read(fd: number, buffer: any, offset: number, length: number, position: number | null, callback: (err: NodeJS.ErrnoException, bytesRead: number, buffer: BinaryData) => void): void {
    return fs.read(fd, buffer, offset, length, position, callback);
  }

  public readdir(path: string, options: { encoding: BufferEncoding | null; withFileTypes?: false } | BufferEncoding | undefined | null): Promise<string[]> {
    return promisify(fs.readdir)(this.resolve(path), options);
  }

  public readdirSync(path: string, options?: { encoding: BufferEncoding | null; withFileTypes?: false } | BufferEncoding | null): string[] {
    return fs.readdirSync(this.resolve(path), options);
  }

  public readFile(path: string | number, options: { encoding?: null; flag?: string; } | undefined | null): Promise<Buffer> {
    if (typeof path === "string") {
      return promisify(fs.readFile)(this.resolve(path), options);
    } else {
      return promisify(fs.readFile)(path, options);
    }
  }
  public readFileSync(file: number | string, options: { encoding?: null; flag?: string; } | undefined | null): Buffer {
    if (typeof file === "string") {
      return fs.readFileSync(this.resolve(file), options);
    } else {
      return fs.readFileSync(file, options);
    }
  }

  public readlink(path: string, options: { encoding: BufferEncoding | null; withFileTypes?: false } | BufferEncoding | undefined | null): Promise<string> {
    return promisify(fs.readlink)(this.resolve(path), options);
  }

  public readlinkSync(path: string, options: { encoding: BufferEncoding | null; withFileTypes?: false } | BufferEncoding | undefined | null): string {
    return fs.readlinkSync(this.resolve(path), options);
  }

  public readSync(fd: number, buffer: BinaryData, offset: number, length: number, position: number | null): number {
    return fs.readSync(fd, buffer, offset, length, position);
  }

  public realpath(path: string, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null): Promise<string> {
    return promisify(fs.realpath)(this.resolve(path), options);
  }

  public realpathSync(path: string, options: { encoding?: BufferEncoding | null } | BufferEncoding | undefined | null): string {
    return fs.realpathSync(this.resolve(path), options);
  }

  public rename(oldPath: string, newPath: string): Promise<void> {
    return promisify(fs.rename)(this.resolve(oldPath), this.resolve(newPath));
  }

  public renameSync(oldPath: string, newPath: string): void {
    return fs.renameSync(this.resolve(oldPath), this.resolve(newPath));
  }

  public rmdir(path: string): Promise<void> {
    return promisify(fs.rmdir)(this.resolve(path));
  }

  public rmdirSync(path: string): void {
    return fs.rmdirSync(this.resolve(path));
  }

  public stat(path: string): Promise<Stats> {
    return promisify(fs.stat)(this.resolve(path));
  }

  public statSync(path: string): Stats {
    return fs.statSync(this.resolve(path));
  }

  public truncate(path: string, len: number | undefined | null): Promise<void> {
    return promisify(fs.truncate)(this.resolve(path), len);
  }

  public truncateSync(path: string, len: number | undefined | null): void {
    return fs.truncateSync(this.resolve(path), len);
  }

  public unlink(path: string): Promise<void> {
    return promisify(fs.unlink)(this.resolve(path));
  }

  public unlinkSync(path: string): void {
    return fs.unlinkSync(this.resolve(path));
  }

  public write(
    fd: number,
    buffer: BinaryData,
    offset: number | undefined | null,
    length: number | undefined | null,
    position: number | undefined | null,
    callback: (err: NodeJS.ErrnoException, written: number, buffer: BinaryData) => void,
  ): void {
    return fs.write(fd, buffer, offset, length, position, callback);
  }

  public writeFile(file: string | number, data: any, options: WriteFileOptions): Promise<void> {
    if (typeof file === "string") {
      return promisify(fs.writeFile)(this.resolve(file), data, options);
    } else {
      return promisify(fs.writeFile)(file, data, options);
    }
  }

  public writeFileSync(file: string | number, data: any, options: WriteFileOptions): void {
    if (typeof file === "string") {
      return fs.writeFileSync(this.resolve(file), data, options);
    } else {
      return fs.writeFileSync(file, data, options);
    }
  }

  public writeSync(fd: number, buffer: BinaryData, offset?: number | null, length?: number | null, position?: number | null) {
    return fs.writeSync(fd, buffer, offset, length, position);
  }

  /**
   * Resolves an absolute container-relative path into an absolute system path.
   * @param path The path.
   */
  public resolve(path: string): string {
    let root = "/var/lib/lxd/containers/" + this._container.name + "/rootfs";

    // add extra base
    root = _path.join(root, this._base);

    // prevent sneaky attacks
    const joinedPath = _path.join(root, path);

    if (joinedPath.substr(0, root.length) !== root) {
      return root;
    }

    return joinedPath;
  }
}

export interface IExecOptions {
  env?: {
    [key: string]: string;
  };
  interactive?: boolean;
}

// tslint:disable-next-line: max-classes-per-file
export class Container {

  private _client: Client;
  private _metadata: IContainerMetadata;
  private _stateMetadata: IContainerStateMetadata;
  private _fs: ContainerFS | null;

  public get fs() {
    return this._fs;
  }

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

    // file system wrapper is local only
    this._fs = client.local ? new ContainerFS(this) : null;
  }

  /**
   * Sets the container name
   */
  public async setName(name: string): Promise<void> {
    const response = await this._client.request<{ name: string }, { name: string }>({
      path: "POST /containers/" + name,
      body: { name },
    }) as { name: string };

    this._metadata.name = response.name;
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
    // check if ip"s unavailable
    if (!this._stateMetadata.network) {
      return null;
    }

    // check if dev unavailable
    if (!this._stateMetadata.network[dev]) {
      return null;
    }

    // get ips
    const ips = this._stateMetadata.network[dev].addresses;

    for (const ip of ips) {
      if (protocol !== undefined) {
        if (ip.family === protocol) {
          return ip;
        }
      } else {
        return ip;
      }
    }

    return null;
  }

  /**
   * Gets the IPv4 address of this container.
   * @returns
   */
  public async ipv4(): Promise<string> {
    let ip = this.ip("eth0", "inet");
    if (ip) {
      return ip.address;
    }

    // refresh until IPv4 obtained
    const container = this;
    let tries = 0;

    return new Promise<string>(async (accept, reject) => {
      const retry = async () => {
        await container.refresh();
        ip = container.ip("eth0", "inet");

        if (ip) {
          return accept(ip.address);
        } else {
          tries++;
          if (tries === 15) {
            reject(new OperationError("Exceeded retries", "Failed", 400));
          }
          setTimeout(retry, 1000);
        }
      };
      retry();
    });
  }

  /**
   * Gets the IPv6 address of this container.
   * @param {function?} callback
   * @returns {string|undefined}
   */
  public async ipv6(): Promise<string> {
    let ip = this.ip("eth0", "inet6");
    if (ip) {
      return ip.address;
    }

    // refresh until IPv4 obtained
    const container = this;
    let tries = 0;

    return new Promise<string>(async (accept, reject) => {
      const retry = async () => {
        await container.refresh();
        ip = container.ip("eth0", "inet");

        if (ip) {
          return accept(ip.address);
        } else {
          tries++;
          if (tries === 15) {
            reject(new OperationError("Exceeded retries", "Failed", 400));
          }
          setTimeout(retry, 1000);
        }
      };
      retry();
    });
  }

  /**
   * Refreshes the container information.
   */
  public async refresh() {
    const metadata = await this._client.request<never, IContainerMetadata>({
      path: "GET /containers/" + this._metadata.name,
    }) as IContainerMetadata;

    this._metadata = metadata;

          // we now have to a seperate query for state information
          // which we use heavily

    const stateMetadata = await this._client.request<never, IContainerStateMetadata>({
      path: "GET /containers/" + this._metadata.name + "/state",
    }) as IContainerStateMetadata;

    this._stateMetadata = stateMetadata;
  }

  /**
   * Executes a terminal command on the container
   * @param command The command with arguments.
   * @param env The environment data, optional.
   */
  public async run(command: string[], env?: { [key: string]: string }): Promise<{ stdOut: string, stdErr: string }> {

    const proc = await this.exec(command, env ? { env } : {});

    return new Promise((accept) => {

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
        process.nextTick(() => {
          accept({
            stdOut,
            stdErr,
          });
        });
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

    const operation: IOperationMetadata<IExecOperationMetadata> = await this._client.request<IContainerExecRequest, IExecOperationMetadata>({
      path: "POST /containers/" + this.name + "/exec",
      body,
    }) as IOperationMetadata<IExecOperationMetadata>;

    return this._client.getProcess(operation, interactive);
  }

  public async stop(timeout: number = 30, force: boolean = false, stateful: boolean = false) {
    return this._setState("stop", timeout, force, stateful);
  }

  public async start(timeout: number = 30, force: boolean = false, stateful: boolean = false) {
    return this._setState("stop", timeout, force, stateful);
  }

  public async restart(timeout: number = 30, force: boolean = false) {
    return this._setState("restart", timeout, force);
  }

  public async freeze(timeout: number = 30, force: boolean = false) {
    return this._setState("freeze", timeout, force);
  }

  public async unfreeze(timeout: number = 30, force: boolean = false) {
    return this._setState("unfreeze", timeout, force);
  }

  /**
   * Delete the container.
   */
  public async delete(): Promise<void> {

    if (this._stateMetadata.status_code === 103) {
      await this.stop();
    }

    return await this._client.request<never, void>({
      path: "DELETE /containers/" + this.name,
    }) as void;
  }

  /**
   * Uploads data to a remote path on the container.
   * Container must be running.
   * @param remotePath
   * @param data
   */
  public async upload(remotePath: string, data: string | Buffer): Promise<void> {
    // create operation
    await this._client.request({
      path: "POST /containers/" + this.name + "/files?path=" + remotePath,
      body: Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8"),
    });
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
    const buff = await promisify(fs.readFile)(localPath);
    await this.upload(remotePath, buff);
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

  private async _setState(action: "start" | "stop" | "restart" | "freeze" | "unfreeze", timeout: number = 30, force: boolean = false, stateful?: boolean): Promise<void> {

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

// export
module.exports = Container;
