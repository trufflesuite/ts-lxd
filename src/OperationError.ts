export class OperationError extends Error {
  private _message: string = "";
  private _statusCode: number = -1;
  private _status: string = "";
  private _innerError?: Error;

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
   * Creates a new operation error.
   * @param message
   * @param status
   * @param statusCode
   * @param innerError
   */
  constructor(message: string, status: string, statusCode: number, innerError?: Error) {
    super(message);
    this._message = message;
    this._status = status;
    this._statusCode = statusCode;
    this._innerError = innerError;
  }
}

export default OperationError;
