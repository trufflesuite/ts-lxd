import { EventEmitter } from "events";
import { Readable, Writable, Duplex } from "stream";
import { WebSocketDuplex } from "websocket-stream";

export class Process extends EventEmitter {

  /**
   * Checks if the process is closed.
   */
  public get isClosed(): boolean {
    return this._closed;
  }
  private _stdIn: Writable;
  private _stdOut: Readable;
  private _stdErr: Readable;
  private _control: Duplex;
  private _closed: boolean;
  private _streams: WebSocketDuplex[];

  /**
   * Creates a new operation error.
   * @param container
   * @param streams
   */
  constructor(streams: WebSocketDuplex[]) {
    super();
    this._closed = false;

    this._streams = streams;

    // web sockets, if we have two it"s interactive
    // otherwise it"s pty
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

    // close
    this._control.on("close", () => {
      process.close();
    });

    // messages
    this._stdOut.on("data", (data) => {
      process.emit("data", false, data.toString("utf8").trim());
    });

    if (this._stdErr !== null) {
      this._stdErr.on("data", (data) => {
        process.emit("data", true, data.toString("utf8").trim());
      });
    }
  }

  /**
   * Closes the process.
   */
  public close(): void {
    for (const stream of this._streams) {
      stream.end();
    }
    this.emit("close");
    this._closed = true;
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
   * Resize"s the output window.
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
}

export default Process;
