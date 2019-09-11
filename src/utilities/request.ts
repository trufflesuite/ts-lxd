import got, { GotBodyOptions, Response } from "got";
import { Agent } from "https";
import debugLib from "debug";
import { IASyncResponseBody, IOperationMetadata, ISyncResponseBody, IErrorResponseBody } from "../model";
import { createError } from "./create-error";

const debug = debugLib("ts-lxd:request");

export interface IRequestOptions<RequestBodyType> {
  baseRequestUrl: string;
  path: string;
  body?: RequestBodyType;
  waitForOperationCompletion?: boolean;
  agent?: Agent;
}

/**
 * Performs a REST request on this client.
 * @param options
 */
export async function request<RequestBodyType, T>(
    options: IRequestOptions<RequestBodyType>,
  ): Promise<T | IOperationMetadata<T>> {

  // parse path, strip leading slash if necessary
  const route = options.path.substring(options.path.indexOf(" ") + 1).trim().replace(/^\//, "");
  const method = options.path.substring(0, options.path.indexOf(" ")).trim().toUpperCase();

  const url = options.baseRequestUrl + "1.0" + (route.length === 0 ? "" : "/") + route;

  const reqParams: GotBodyOptions<null> = {
    method,
    headers: {
      Host: "",
    },
  };

  if (["PUT", "POST", "PATCH"].includes(method)) {
    reqParams.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  type BodyType =
    ISyncResponseBody<T> | IASyncResponseBody<T> | IErrorResponseBody | IOperationMetadata<T> | T;

  if (typeof (options.body) === "object" && !Buffer.isBuffer(options.body)) {
    debug(`${method} ${url}: `, JSON.stringify(options.body, null, 2));
  } else {
    debug(`${method} ${url}`);
  }

  let res: Response<Buffer>;
  try {
    res = await got(url, reqParams);
  } catch (err) {
    logRequestError(method, url, err);
    throw err;
  }

  const body: BodyType = JSON.parse(res.body.toString("utf8"));

  // log finished request
  debug(`Response from ${url}:\n\n${JSON.stringify(body, null, 2)}`);

  if (isResponseBody(body)) {
    switch (body.type) {
      case "async":
        return await handleAsyncResponse(body, options);
      case "sync":
        return await handleSyncResponse(body);
      default:
        debug(body);
        throw new Error("unknown operation type: " + (body as any).type);
    }
  } else if (isOperationMetadata(body)) {
    return body.metadata;
  } else {
    return body;
  }
}

function isResponseBody<T>(arg: any):
  arg is (ISyncResponseBody<T> | IASyncResponseBody<T> | IErrorResponseBody) {
  return !!arg.type;
}

function isOperationMetadata<T>(arg: any):
  arg is (IOperationMetadata<T>) {
  return !!arg.id &&
    !!arg.class &&
    !!arg.created_at &&
    !!arg.updated_at &&
    !!arg.status &&
    !!arg.status_code &&
    !!arg.metadata &&
    !!arg.may_cancel;
}

function logRequestError(method: string, url: string, err: any): void {
  // otherwise we assume it's an error from got
  const res: (Response<Buffer> | undefined) = err.response;

  if (res) {
    const body: IErrorResponseBody = JSON.parse(res.body.toString("utf8"));
    const metadataDebugOutput = body.metadata ? " metadata: " + JSON.stringify(body.metadata) : "";

    debug(`${method} ${url} || ${res.statusCode} ${res.statusMessage}${metadataDebugOutput}`);
  } else {
    // we only branch here if we failed before we could get a response back from the server
    debug(`${method} ${url} || no response captured`);
  }
}

function handleSyncResponse<T>(body: ISyncResponseBody<T>): T {
  // when we call /1.0/containers/<name>/wait we can get back a sync response body that shows success
  // but the metadata contains a failure. (╯°□°)╯︵ ┻━┻
  // we handle that here.
  const metadata: (IOperationMetadata<null> | undefined) = body.metadata as any;
  if (metadata && metadata.status && metadata.status === "Failure") {
    throw createError(metadata);
  }

  return body.metadata;
}

async function handleAsyncResponse<T, RequestBodyType>(
  body: IASyncResponseBody<T>,
  options: IRequestOptions<RequestBodyType>,
): Promise<IOperationMetadata<T>> {
  // wait for operation, do this by default
  if (options.waitForOperationCompletion === undefined || options.waitForOperationCompletion) {
    const strippedOptions = Object.keys(options).reduce(
      (prev: any, key) => {
        if (key !== "path" && key !== "body") {
          prev[key] = (options as any)[key];
        }
        return prev;
      },
      {},
    );

    const newOptions: IRequestOptions<never> = {
      ...strippedOptions,
      path: "GET /operations/" + body.metadata.id + "/wait",
    };

    return await request<never, IOperationMetadata<T>>(newOptions) as IOperationMetadata<T>;
  } else {
    return body.metadata;
  }
}

export default request;
