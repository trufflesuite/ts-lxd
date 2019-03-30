import { IOperationMetadata } from "./model";

export class OperationError extends Error {
  private _message: string = "";
  private _statusCode: number = -1;
  private _status: string = "";
  private _innerError?: Error;
  private _containerName?: string;

  public get message(): string {
    return this._message;
  }

  /**
   * Gets the status code.
   */
  public get statusCode(): number {
    return this._statusCode;
  }

  /**
   * Gets the status.
   */
  public get status(): string {
    return this._status;
  }

  /**
   * Gets the inner error.
   */
  public get innerError(): Error | undefined {
    return this._innerError;
  }

  /**
   * Gets the name of the container to which this error relates
   */
  public get containerName(): string | undefined {
    return this._containerName;
  }

  /**
   * Creates a new operation error.
   * @param operation
   * @param message?
   * @param innerError?
   */
  constructor(operation: IOperationMetadata<null>, message?: string, innerError?: Error) {
    super(`${message ? message : ""} ${operation.err as string}`);

    message = `${message ? message : ""} ${operation.err as string}`;

    this._message = message;
    this._status = operation.status;
    this._statusCode = operation.status_code;
    this._innerError = innerError;
    if (operation.resources && operation.resources.containers) {
      this._containerName = operation.resources.containers[0].split("/").slice(-1)[0];
    }
  }
}

export class AlreadyStoppedError extends OperationError {
  constructor(operation: IOperationMetadata<null>, message?: string, innerError?: Error) {
    super(operation, message, innerError);
  }
}

export class AlreadyStartedError extends OperationError {
  constructor(operation: IOperationMetadata<null>, message?: string, innerError?: Error) {
    super(operation, message, innerError);
  }
}
