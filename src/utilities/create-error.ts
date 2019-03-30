import * as errors from "../errors";
import { IOperationMetadata } from "../model";

interface IErrorMap {
  [key: string]: typeof errors.OperationError;
}

const _errorMap: IErrorMap  = {
  "The container is already stopped": errors.AlreadyStoppedError,
  "The container is already started": errors.AlreadyStartedError,
};

export function createError(
  op: IOperationMetadata<null>,
  message?: string, innerError?: Error,
): errors.OperationError {
  const errorConstructor = _errorMap[op.err as string]  || errors.OperationError;
  return new errorConstructor(op, message, innerError);
}
