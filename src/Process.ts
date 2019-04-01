import debugOutput from "debug";
import { EventEmitter } from "events";
import { Readable, Writable, Duplex } from "stream";
import { WebSocketDuplex } from "websocket-stream";
import { IExecOperationMetadata, IOperationMetadata, ISignalRequest } from "./model/index";
import { SignalNumber, SIGHUP } from "./model/signals";
import { Client, IRequestOptions } from "./Client";

const debug = debugOutput("ts-lxd:Process");

export class Process extends EventEmitter {
  private _stdIn: Writable;
  private _stdOut: Readable;
  private _stdErr: Readable;
  private _control: Duplex;
  private _closed: boolean;
  private _streams: WebSocketDuplex[];
  private _operation: IOperationMetadata<IExecOperationMetadata>;
  private _client: Client;

  /**
   * Checks if the process is closed.
   */
  public get isClosed(): boolean {
    return this._closed;
  }

  /**
   * Lets you write to the process's standard input
   */
  public get stdIn(): Writable {
    return this._stdIn;
  }

  /**
   * Lets you read from the process's standard output
   */
  public get stdOut(): Readable {
    return this._stdOut;
  }

  /**
   * Lets you read from the process's standard error
   */
  public get stdErr(): Readable {
    return this._stdErr;
  }

  /**
   * Lets you read/write from/to the process's control stream (lets you set terminal size)
   */
  public get control(): Readable {
    return this._control;
  }

  public get operation(): IOperationMetadata<IExecOperationMetadata> {
    return this._operation;
  }

  /**
   * Returns true if the process is still running, otherwise false.
   * Note that you might need to call `refreshOperation` for this data to be updated.
   */
  public get isRunning(): boolean {
    // if we don't have a return code, let's assume we're still running
    return this._operation.metadata.return === undefined || this._operation.metadata.return === null;
  }

  /**
   * Gets the process's exit code. Returns null if the process is still running.
   * Note that you might need to call `refreshOperation` for this data to be updated.
   */
  public get exitCode(): number | undefined {
    return this._operation.metadata.return;
  }

  /**
   * Creates a new operation error.
   * @param container
   * @param streams
   */
  constructor(
    operation: IOperationMetadata<IExecOperationMetadata>,
    client: Client,
    streams: WebSocketDuplex[],
  ) {
    super();
    this._closed = false;

    this._client = client;
    this._operation = operation;
    this._streams = streams;

    // web sockets, if we have two it's interactive
    // otherwise it's pty
    if (streams.length === 2) {
      this._stdIn = streams[0];
      this._stdOut = streams[0];
      this._stdErr = new Readable();
      this._control = streams[1];
    } else {
      this._stdIn = streams[0];
      this._stdOut = streams[1];
      this._stdErr = streams[2];
      this._control = streams[3];
    }

    // setup events
    const process = this;

    this._control.on("close", async () => {
      await this.refreshOperation();
      this._close(this.exitCode);
    });

    // messages
    this._stdOut.on("data", (data) => {
      data = data.toString("utf8").trim();
      debug(`stdout data: ${data}`);
      process.emit("data", false, data);
    });

    this._control.on("data", (data) => {
      data = data.toString("utf8").trim();
      try {
        // pretty print for debug
        data = JSON.stringify(JSON.parse(data), null, 2);
        // tslint:disable-next-line: no-empty
      } catch { }
      debug(`control data: ${data}`);
    });

    if (this._stdErr !== null) {
      this._stdErr.on("data", (data) => {
        data = data.toString("utf8").trim();
        debug(`stderr data: ${data}`);
        process.emit("data", true, data.toString("utf8").trim());
      });
    }
  }

  /**
   * Closes the process. Sends SIGHUP.
   *
   * @param signal Optional signal to send on termination
   */
  public close(signal: SignalNumber = SIGHUP): void {
    if (!this.isClosed) {
      if (signal !== undefined && signal !== null) {
        this.signal(signal);
        this._close(128 + signal);
      } else {
        this._close();
      }
    }
  }

  /**
   * Write some data to the process"s standard input.
   * @param data
   * @returns If the data was written.
   */
  public write(data: string | Buffer): boolean {
    if (this.isClosed) {
      return false;
    }

    this._stdIn.write(data);
    return true;
  }

  /**
   * Resize's the output window.
   * @param width
   * @param height
   */
  public resize(width: number, height: number) {
    this._control.write(JSON.stringify({
      command: "window-resize",
      width,
      height,
    }));
  }

  /**
   * Sends a signal to the process
   *
   * @param signal The numeric signal to be sent to the process
   */
  public signal(signal: SignalNumber) {
    const signalReq: ISignalRequest = {
      command: "signal",
      signal,
    };

    this._control.write(JSON.stringify(signalReq));
  }

  /**
   * Queries for updates to the operation metadata
   */
  public async refreshOperation(): Promise<void> {
    const req: IRequestOptions<never> = {
      path: `GET /operations/${this._operation.id}`,
      waitForOperationCompletion: false,
    };

    this._operation = await this._client.request(req) as IOperationMetadata<IExecOperationMetadata>;
  }

  private _close(codeOrSignal?: number): void {
    for (const stream of this._streams) {
      stream.end();
    }
    if (codeOrSignal !== null && codeOrSignal !== undefined && codeOrSignal >= 128) {
      this.emit("close", null, codeOrSignal - 128);
    } else {
      this.emit("close", codeOrSignal);
    }

    this._closed = true;
  }
}

export default Process;
